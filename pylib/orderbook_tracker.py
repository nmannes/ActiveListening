import asyncio
import json
import logging
import time
import websockets
import websockets.asyncio.client

from pylib.kalshi_client import KalshiClient

logger = logging.getLogger("remote_server")

WS_PROD_URL = "wss://api.elections.kalshi.com/trade-api/ws/v2"
WS_DEMO_URL = "wss://demo-api.kalshi.co/trade-api/ws/v2"
PING_INTERVAL_SECS = 10
RECONNECT_DELAY_SECS = 3


class Orderbook:
    __slots__ = ("yes", "no")
    yes: dict[int, int]  # price_cents -> quantity
    no: dict[int, int]

    def __init__(self):
        self.yes = {}
        self.no = {}


class OrderbookTracker:
    """Tracks Kalshi orderbooks over WebSocket for a set of tickers.

    Maintains in-memory orderbooks from orderbook_delta snapshots and updates.
    Provides get_best_yes_ask() for pre-trade price checks.

    Kalshi multi-venue event (MVE) tickers don't carry their own orderbooks;
    the liquidity lives on their leg markets (listed in custom_strike.Associated
    Markets). Pass ``mve_to_legs`` to map MVE tickers → their leg tickers so
    that ``appears_resolved_no`` checks the leg orderbooks instead.
    """

    def __init__(
        self,
        tickers: list[str],
        kalshi: KalshiClient,
        environment: str = "prod",
        mve_to_legs: dict[str, list[str]] | None = None,
    ):
        self._tickers = list(tickers)
        self._kalshi = kalshi
        self._ws_url = WS_PROD_URL if environment == "prod" else WS_DEMO_URL
        self._books: dict[str, Orderbook] = {}
        self._mve_to_legs: dict[str, list[str]] = mve_to_legs or {}
        self._ws = None
        self._stopped = False
        self._cmd_id = 1
        self._ready = asyncio.Event()

    # ── Public API ──────────────────────────────────────────────────────

    def get_best_yes_ask(self, ticker: str) -> float | None:
        """Lowest YES ask price in dollars, or None if no asks on the book."""
        book = self._books.get(ticker)
        if not book or not book.no:
            return None
        return min(book.no.keys()) / 100.0

    def get_best_yes_bid(self, ticker: str) -> float | None:
        """Highest YES bid price in dollars, or None if no bids on the book."""
        book = self._books.get(ticker)
        if not book or not book.yes:
            return None
        return max(book.yes.keys()) / 100.0

    def appears_resolved_no(self, ticker: str) -> bool:
        """True if the best YES bid is <= 1 cent — market looks settled to NO.

        Requires positive evidence (an actual bid at near-zero). An empty
        orderbook or missing YES side is NOT treated as resolved — many
        Kalshi markets have no resting liquidity.

        For MVE tickers, checks the leg markets' orderbooks since MVEs
        don't carry their own liquidity.
        """
        targets = self._mve_to_legs.get(ticker, [ticker])
        for t in targets:
            if not self.has_book(t):
                return False
            bid = self.get_best_yes_bid(t)
            if bid is None:
                return False  # no YES bids — can't judge
            if bid > 0.01:
                return False  # at least one leg still has healthy bids
        # All legs (or the single market) show YES bids <= 1 cent
        return len(targets) > 0

    def has_book(self, ticker: str) -> bool:
        return ticker in self._books

    async def wait_ready(self, timeout: float = 15.0):
        """Wait until at least one snapshot has been received."""
        try:
            await asyncio.wait_for(self._ready.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            logger.warning("[orderbook] Timed out waiting for initial snapshot")

    # ── Lifecycle ───────────────────────────────────────────────────────

    async def run(self):
        if not self._tickers:
            logger.warning("[orderbook] No tickers to track")
            return

        while not self._stopped:
            try:
                await self._connect()
            except Exception:
                logger.exception("[orderbook] Connection error")
            if not self._stopped:
                await asyncio.sleep(RECONNECT_DELAY_SECS)

    def stop(self):
        self._stopped = True

    # ── Internal ────────────────────────────────────────────────────────

    async def _connect(self):
        headers = self._kalshi.get_ws_auth_headers()
        async with websockets.asyncio.client.connect(
            self._ws_url,
            additional_headers=headers,
            ping_interval=None,  # we handle pings ourselves
        ) as ws:
            self._ws = ws
            logger.info(
                "[orderbook] Connected — subscribing to %d tickers",
                len(self._tickers),
            )

            await self._subscribe()
            asyncio.create_task(self._ping_loop())

            async for raw in ws:
                if self._stopped:
                    break
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type", "")
                if msg_type == "orderbook_snapshot":
                    self._handle_snapshot(data)
                elif msg_type == "orderbook_delta":
                    self._handle_delta(data)

    async def _subscribe(self):
        msg = {
            "id": self._cmd_id,
            "cmd": "subscribe",
            "params": {
                "channels": ["orderbook_delta"],
                "market_tickers": self._tickers,
            },
        }
        self._cmd_id += 1
        await self._ws.send(json.dumps(msg))

    async def _ping_loop(self):
        while self._ws and not self._stopped:
            try:
                await asyncio.sleep(PING_INTERVAL_SECS)
                if self._ws:
                    await self._ws.ping()
            except Exception:
                break

    def _handle_snapshot(self, data: dict):
        msg = data.get("msg", data)
        ticker = msg.get("market_ticker", "")
        if not ticker:
            return

        book = Orderbook()

        yes_levels = msg.get("yes_dollars_fp") or []
        for price_str, qty_str in yes_levels:
            price_cents = round(float(price_str) * 100)
            book.yes[price_cents] = round(float(qty_str))

        no_levels = msg.get("no_dollars_fp") or []
        for price_str, qty_str in no_levels:
            price_cents = round(float(price_str) * 100)
            book.no[price_cents] = round(float(qty_str))

        self._books[ticker] = book
        logger.info(
            "[orderbook] Snapshot for %s: %d yes, %d no levels",
            ticker, len(book.yes), len(book.no),
        )

        if not self._ready.is_set():
            self._ready.set()

    def _handle_delta(self, data: dict):
        msg = data.get("msg", data)
        ticker = msg.get("market_ticker", "")
        side = msg.get("side", "")
        if not ticker or side not in ("yes", "no"):
            return

        price = msg.get("price")
        if price is None and "price_dollars" in msg:
            price = round(float(msg["price_dollars"]) * 100)

        delta_qty = msg.get("delta")
        if delta_qty is None and "delta_fp" in msg:
            delta_qty = int(float(msg["delta_fp"]))

        if price is None or delta_qty is None:
            return

        book = self._books.get(ticker)
        if not book:
            return

        side_map = book.yes if side == "yes" else book.no
        current = side_map.get(price, 0)
        updated = current + delta_qty
        if updated <= 0:
            side_map.pop(price, None)
        else:
            side_map[price] = updated
