"""
orderbook.py — Orderbook pricing and P&L utilities for backtesting.

Uses Kalshi API market data (pre-fetched via get_market_full()) instead of
local SQLite snapshots. The Kalshi API response includes yes_ask_dollars,
yes_bid_dollars, no_ask_dollars, no_bid_dollars, last_price_dollars,
previous_yes_ask_dollars, and previous_yes_bid_dollars.

Usage:
    from backtest.orderbook import get_yes_ask, get_yes_bid, appears_resolved_no, compute_pnl
"""

import json
from datetime import datetime, timezone
from pathlib import Path


# ── Kalshi API market data helpers ───────────────────────────────────────────

def get_yes_ask(market_data: dict | None) -> float | None:
    """Best YES ask price in dollars from Kalshi API market data.

    The YES ask is the lowest price someone is willing to sell YES at.
    In the API response, this is 'yes_ask_dollars' (a string like "0.4200").
    Falls back to 'previous_yes_ask_dollars' for settled markets.
    """
    if not market_data:
        return None
    for field in ("yes_ask_dollars", "previous_yes_ask_dollars"):
        val = market_data.get(field)
        if val is not None:
            try:
                price = float(val)
                if price > 0:
                    return price
            except (ValueError, TypeError):
                continue
    return None


def get_yes_bid(market_data: dict | None) -> float | None:
    """Best YES bid price in dollars from Kalshi API market data."""
    if not market_data:
        return None
    for field in ("yes_bid_dollars", "previous_yes_bid_dollars"):
        val = market_data.get(field)
        if val is not None:
            try:
                price = float(val)
                if price > 0:
                    return price
            except (ValueError, TypeError):
                continue
    return None


def appears_resolved_no(market_data: dict | None) -> bool:
    """True if the market appears settled to NO based on API data.

    Checks: status is 'settled' with result 'no', OR yes_bid is <= 1 cent.
    """
    if not market_data:
        return False
    # If explicitly settled NO
    status = market_data.get("status", "")
    if status == "settled":
        result = market_data.get("result")
        if result is not None:
            if isinstance(result, str) and result.lower() == "no":
                return True
            if isinstance(result, bool) and not result:
                return True
        # Also check yes_result for boolean settlement
        yes_result = market_data.get("yes_result")
        if yes_result is not None and not yes_result:
            return True
    # If bid is <= 1 cent
    bid = get_yes_bid(market_data)
    return bid is not None and bid <= 0.01


def get_settlement(market_data: dict | None) -> str | None:
    """Extract settlement result from Kalshi API market data.

    Returns 'yes', 'no', or None (unresolved).
    """
    if not market_data:
        return None
    status = market_data.get("status", "")
    if status != "settled":
        return None
    # Try 'result' field first (normalized by get_market)
    result = market_data.get("result")
    if result is not None:
        if isinstance(result, str):
            return result.lower()
        if isinstance(result, bool):
            return "yes" if result else "no"
    # Try yes_result boolean
    yes_result = market_data.get("yes_result")
    if yes_result is not None:
        return "yes" if yes_result else "no"
    return None


async def fetch_market_data(kalshi_client, tickers: list[str]) -> dict[str, dict]:
    """Pre-fetch full market data for a list of tickers.

    Runs get_market_full() for each ticker. Returns a dict mapping ticker → API response.
    Failed fetches are omitted from the result.
    """
    import asyncio

    def _fetch_one(ticker: str) -> tuple[str, dict | None]:
        return ticker, kalshi_client.get_market_full(ticker)

    loop = asyncio.get_running_loop()
    results: dict[str, dict] = {}
    # Run blocking HTTP calls in a thread pool
    tasks = [loop.run_in_executor(None, _fetch_one, t) for t in tickers]
    done = await asyncio.gather(*tasks)
    for ticker, data in done:
        if data:
            results[ticker] = data
    return results


# ── P&L computation ─────────────────────────────────────────────────────────

def compute_pnl(fill_price: float, dollar_amount: float, resolution: str | None,
                resolution_price: float | None = None) -> dict:
    """Compute P&L for a single trade."""
    if fill_price is None or fill_price <= 0:
        fill_price = 0.50  # fallback when no pricing data
    contracts = dollar_amount / fill_price

    if resolution == "yes":
        payout = contracts * 1.0  # each contract pays $1
        pnl = payout - dollar_amount
    elif resolution == "no":
        pnl = -dollar_amount  # contracts worth $0
    else:
        pnl = 0  # unresolved — no settlement

    return {
        "fill_price": fill_price,
        "contracts": contracts,
        "dollar_amount": dollar_amount,
        "resolution": resolution or "unresolved",
        "pnl": pnl,
    }


# ── Timestamp conversion ────────────────────────────────────────────────────

def compute_stream_start(session_dir: Path) -> float | None:
    """Compute absolute Unix timestamp of the Deepgram stream start.

    Uses the first dg_*.json file with word data.
    """
    dg_dir = session_dir / "deepgram_responses"
    if not dg_dir.is_dir():
        return None

    for f in sorted(dg_dir.glob("dg_*.json")):
        try:
            data = json.loads(f.read_text())
            if data.get("type") != "Results":
                continue
            words = data.get("channel", {}).get("alternatives", [{}])[0].get("words", [])
            if not words:
                continue
            ts_ns = int(f.stem.split("_")[1])
            return ts_ns / 1e9 - words[0]["start"]
        except (json.JSONDecodeError, IndexError, KeyError, ValueError):
            continue
    return None


def signal_to_iso(signal_timestamp: float, stream_start_unix: float) -> str:
    """Convert a signal's stream-relative timestamp to ISO 8601 UTC string.
    Kept for compatibility; not used in the new API-based path."""
    abs_unix = stream_start_unix + signal_timestamp
    dt = datetime.fromtimestamp(abs_unix, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"
