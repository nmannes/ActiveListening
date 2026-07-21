"""
signal_handler.py — BacktestSignalHandler for time-synced P&L backtesting.

Replaces RecordingSignalHandler during backtest runs. Evaluates the full
trading gate suite (including orderbook checks via Kalshi API data and
session loss cap) and computes P&L per-signal from market resolutions.

Usage:
    from backtest.signal_handler import BacktestSignalHandler

    handler = BacktestSignalHandler(
        trade_processor, virtual_time,
        market_data={"TICKER-YES": {...api response...}},
        market=market_json,
        gate_config={...},
    )
"""

from pylib.ordering_config import get_dollar_amount
from backtest.orderbook import (
    get_yes_ask, get_yes_bid, appears_resolved_no,
    get_settlement, compute_pnl,
)


class BacktestSignalHandler:
    """Full-gate signal handler for P&L backtesting.

    Evaluates all seven trading gates in the same order as the real
    SignalHandler.handle_signal(), using pre-fetched Kalshi API market data
    for orderbook checks and settlement resolution.

    Implements the same trading_speakers interface as RecordingSignalHandler
    so TradeProcessor.add_trading_speaker() and the identification pipeline
    work without modification.
    """

    def __init__(
        self,
        trade_processor,
        virtual_time: list[float],
        *,
        market_data: dict[str, dict] | None = None,
        market: dict | None = None,
        gate_config: dict | None = None,
    ):
        self._tp = trade_processor
        self._virtual_time = virtual_time
        self._market_data = market_data or {}   # ticker → Kalshi API response
        self.market = market or {}
        self.signals: list = []  # TradeSignal objects
        self.trading_speakers: set[str] = set()
        self.current_firing_index: int = 0
        self.session_cost_total: float = 0.0

        # Gate configuration
        cfg = gate_config or {}
        self.min_confidence = cfg.get("min_confidence", 0.80)
        self.min_yes_ask_price = cfg.get("min_yes_ask_price", 0.02)
        self.max_session_loss = cfg.get("max_session_loss", 100.0)

    # ── trading_speakers interface (mirrors RecordingSignalHandler) ──────

    def set_trading_speakers(self, speaker_ids: list[str]):
        self.trading_speakers = set(str(s) for s in speaker_ids)

    def add_trading_speaker(self, speaker_id: str) -> bool:
        sid = str(speaker_id)
        if sid in self.trading_speakers:
            return False
        self.trading_speakers.add(sid)
        return True

    # ── signal handling ──────────────────────────────────────────────────

    async def handle_signal(self, match: dict, speaker_id: str, token: dict):
        """Evaluate all seven trading gates and compute P&L if they pass."""
        # Lazy import to avoid circular dependency at module level
        from pylib.replay_runner import TradeSignal

        ticker = match["value"]
        keyword = match["key"]
        confidence = match.get("min_confidence", token.get("confidence", 0))
        whitelisted = speaker_id in self.trading_speakers

        signal = TradeSignal(
            elapsed_secs=self._virtual_time[0],
            keyword=keyword,
            ticker=ticker,
            speaker_id=speaker_id,
            word_confidence=round(confidence, 3),
            speaker_whitelisted=whitelisted,
            would_trade=False,
            blocked_by="",
            firing_index=self.current_firing_index,
        )

        # ── Gate evaluation (same order as SignalHandler.handle_signal()) ──

        # Gate 1: Speaker whitelist
        if not whitelisted:
            signal.blocked_by = "speaker_not_whitelisted"
            self.signals.append(signal)
            return

        # Gate 2: Dollar amount
        dollar_amount = get_dollar_amount(self.market, keyword)
        if dollar_amount <= 0:
            signal.blocked_by = f"dollar_amount_{dollar_amount}"
            self.signals.append(signal)
            return

        # Gate 3: Confidence threshold
        if confidence < self.min_confidence:
            signal.blocked_by = f"low_confidence_{confidence:.3f}"
            self.signals.append(signal)
            return

        # Look up market data from pre-fetched Kalshi API responses
        md = self._market_data.get(ticker)

        # Gate 4: Orderbook — resolve YES check (best ask <= min threshold)
        ask = get_yes_ask(md)
        if ask is not None and ask <= self.min_yes_ask_price:
            signal.blocked_by = f"yes_ask_{ask:.2f}_le_{self.min_yes_ask_price:.2f}"
            self.signals.append(signal)
            return

        # Gate 5: Orderbook — appears resolved NO
        if appears_resolved_no(md):
            bid = get_yes_bid(md)
            signal.blocked_by = f"resolved_no_bid_{bid}"
            self.signals.append(signal)
            return

        # Gate 6: Session loss cap
        if self.session_cost_total + dollar_amount > self.max_session_loss:
            signal.blocked_by = (
                f"session_cap_{self.session_cost_total:.2f}+{dollar_amount:.2f}"
                f"_>{self.max_session_loss:.0f}"
            )
            self.signals.append(signal)
            return

        # ── All gates passed ────────────────────────────────────────────

        fill_price = ask if ask is not None and ask > 0 else 0.50
        resolution = get_settlement(md)

        result = compute_pnl(fill_price, dollar_amount, resolution)
        self.session_cost_total += dollar_amount

        signal.would_trade = True
        signal.fill_price = round(fill_price, 4)
        signal.dollar_amount = dollar_amount
        signal.contracts = round(result["contracts"], 2)
        signal.pnl = round(result["pnl"], 2)
        signal.resolution = result["resolution"]

        self.signals.append(signal)
