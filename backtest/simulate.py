#!/usr/bin/env python3
"""
simulate.py — Run detected signals through trading gates and compute P&L.

Reads signals.jsonl, reconstructs the orderbook at each signal timestamp from
market_tracking/*.db, applies the same gates as SignalHandler, simulates fills,
and computes P&L from cached resolutions.

Usage:
    PYTHONPATH=. python backtest/simulate.py backtest_data/kxnbamention-26apr28phibos/signals.jsonl
    PYTHONPATH=. python backtest/simulate.py backtest_data/kxnbamention-26apr28phibos/signals.jsonl --db market_tracking/kxnbamention-26apr28phibos.db --market scheduled/kxnbamention-26apr28phibos.json

Gate defaults (override with env vars):
    MIN_CONFIDENCE=0.80        Skip trades below this confidence
    MIN_YES_ASK_PRICE=0.02     Skip when YES ask <= 2¢ (market resolved NO)
    MAX_SESSION_LOSS=100.0     Cap cumulative session cost
"""

import argparse
import json
import os
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pylib.ordering_config import get_dollar_amount, is_keyword_blocked, BLOCKED_KEYWORDS

CACHE_DIR = REPO_ROOT / "cache"
RESOLUTIONS_FILE = CACHE_DIR / "resolutions.json"

# Gate defaults (overridable via env / CLI)
_gate_cfg: dict[str, float] = {
    "min_confidence": float(os.environ.get("MIN_CONFIDENCE", "0.80")),
    "min_yes_ask_price": float(os.environ.get("MIN_YES_ASK_PRICE", "0.02")),
    "max_session_loss": float(os.environ.get("MAX_SESSION_LOSS", "100.0")),
}


# ── Orderbook reconstruction ────────────────────────────────────────────

def book_at(db_path: str, ticker: str, ts: str) -> dict | None:
    """Reconstruct the orderbook at an ISO timestamp for a specific ticker.

    Returns {yes: {price_cents: qty}, no: {price_cents: qty}} or None.
    Port of lib/orderbook_analysis.js bookAt().
    """
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    try:
        row = db.execute(
            "SELECT * FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1",
            [ticker, ts],
        ).fetchone()
        if not row:
            return None

        yes = {}
        no = {}
        for price, qty in json.loads(row["yes"] or "[]"):
            yes[price] = qty
        for price, qty in json.loads(row["no"] or "[]"):
            no[price] = qty

        deltas = db.execute(
            "SELECT * FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC",
            [ticker, row["ts"], ts],
        ).fetchall()
        for d in deltas:
            side_map = yes if d["side"] == "yes" else no
            cur = side_map.get(d["price"], 0)
            upd = cur + d["delta"]
            if upd <= 0:
                side_map.pop(d["price"], None)
            else:
                side_map[d["price"]] = upd

        return {"yes": yes, "no": no}
    finally:
        db.close()


def best_yes_ask(book: dict | None) -> float | None:
    """Lowest YES ask price in dollars. Equivalent to min NO bid price."""
    if not book or not book["no"]:
        return None
    return min(book["no"].keys()) / 100.0


def best_yes_bid(book: dict | None) -> float | None:
    """Highest YES bid price in dollars."""
    if not book or not book["yes"]:
        return None
    return max(book["yes"].keys()) / 100.0


def appears_resolved_no(book: dict | None) -> bool:
    """True if the YES bid is missing or <= 1 cent."""
    bid = best_yes_bid(book)
    return bid is None or bid <= 0.01


# ── Gate evaluation ─────────────────────────────────────────────────────

def evaluate_gates(signal: dict, market: dict, book: dict | None,
                   session_cost_total: float) -> tuple[bool, str, float | None]:
    """Apply trading gates in the same order as SignalHandler.handle_signal().

    Returns (passed, reason, fill_price).
    """
    keyword = signal["keyword"]
    ticker = signal["ticker"]

    # Gate 1: Blocked keyword
    if is_keyword_blocked(keyword):
        return False, f"blocked keyword: {keyword}", None

    dollar_amount = get_dollar_amount(market, keyword)
    if dollar_amount <= 0:
        return False, f"dollar amount is {dollar_amount}", None

    # Gate 2: Confidence threshold
    confidence = signal["confidence"]
    if confidence < _gate_cfg["min_confidence"]:
        return False, f"confidence {confidence:.3f} < {_gate_cfg['min_confidence']}", None

    # Gate 3: Resolved-YES check (best ask <= 2¢ → market likely resolved NO)
    ask = best_yes_ask(book)
    if ask is not None and ask <= _gate_cfg["min_yes_ask_price"]:
        return False, f"YES ask ${ask:.2f} <= ${_gate_cfg['min_yes_ask_price']:.2f} (market resolved)", None

    # Gate 4: Resolved-NO check
    if appears_resolved_no(book):
        bid = best_yes_bid(book)
        return False, f"appears resolved NO (best YES bid: {bid})", None

    # Gate 5: Session loss cap
    if session_cost_total + dollar_amount > _gate_cfg["max_session_loss"]:
        return False, f"session cap: ${session_cost_total:.2f} + ${dollar_amount:.2f} > ${_gate_cfg['max_session_loss']:.0f}", None

    # All gates passed
    fill_price = ask  # may be None if no orderbook data
    return True, "passed", fill_price


# ── P&L computation ─────────────────────────────────────────────────────

def compute_pnl(fill_price: float, dollar_amount: float, resolution: str | None,
                resolution_price: float | None = None) -> dict:
    """Compute P&L for a single trade."""
    if fill_price is None or fill_price <= 0:
        fill_price = 0.50  # fallback when no orderbook data
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


# ── Timestamp conversion ────────────────────────────────────────────────

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
    """Convert a signal's stream-relative timestamp to ISO 8601 UTC string."""
    abs_unix = stream_start_unix + signal_timestamp
    dt = datetime.fromtimestamp(abs_unix, tz=timezone.utc)
    # SQLite timestamps use 'T' separator with milliseconds
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# ── Main ────────────────────────────────────────────────────────────────

def load_signals(signals_path: Path) -> list[dict]:
    signals = []
    with open(signals_path) as f:
        for line in f:
            line = line.strip()
            if line:
                signals.append(json.loads(line))
    return signals


def load_resolutions() -> dict:
    if RESOLUTIONS_FILE.exists():
        return json.loads(RESOLUTIONS_FILE.read_text())
    return {}


def main():
    parser = argparse.ArgumentParser(
        description="Simulate trading gates and compute P&L from detected signals"
    )
    parser.add_argument("signals_path", help="Path to signals.jsonl")
    parser.add_argument("--db", help="Path to orderbook SQLite database (e.g. market_tracking/<slug>.db)")
    parser.add_argument("--market", help="Path to market JSON (for dollar_amount rules)")
    parser.add_argument("--session-dir", help="Path to original session directory (for stream start time calculation)")
    parser.add_argument("--resolutions", help="Path to resolutions.json (default: cache/resolutions.json)")
    parser.add_argument("--min-confidence", type=float, default=_gate_cfg["min_confidence"])
    parser.add_argument("--min-yes-ask-price", type=float, default=_gate_cfg["min_yes_ask_price"])
    parser.add_argument("--max-session-loss", type=float, default=_gate_cfg["max_session_loss"])
    parser.add_argument("--default-fill", type=float, default=0.50,
                        help="Default fill price when no orderbook data (default: 0.50)")
    args = parser.parse_args()

    # Override defaults from CLI
    _gate_cfg["min_confidence"] = args.min_confidence
    _gate_cfg["min_yes_ask_price"] = args.min_yes_ask_price
    _gate_cfg["max_session_loss"] = args.max_session_loss

    signals_path = Path(args.signals_path)
    if not signals_path.exists():
        print(f"ERROR: {args.signals_path} not found")
        sys.exit(1)

    signals = load_signals(signals_path)
    print(f"Loaded {len(signals)} signals")

    # Load market JSON
    market: dict = {}
    if args.market:
        market_path = Path(args.market)
        if not market_path.is_absolute():
            market_path = REPO_ROOT / market_path
        if market_path.exists():
            market = json.loads(market_path.read_text())
            print(f"Loaded market: {market.get('title', market_path.stem)}")
    else:
        # Try to auto-detect from signals_path
        slug = signals_path.parent.name
        market_candidate = REPO_ROOT / "scheduled" / f"{slug}.json"
        if not market_candidate.exists():
            # Check s3 dirs
            for d in (REPO_ROOT / "s3").iterdir():
                if d.is_dir() and d.name.startswith(slug):
                    candidate2 = d / f"{slug}.json"
                    if candidate2.exists():
                        market_candidate = candidate2
                        break
        if market_candidate.exists():
            market = json.loads(market_candidate.read_text())
            print(f"Auto-detected market: {market.get('title', slug)}")

    # Load resolutions
    resolutions = load_resolutions()
    if resolutions:
        print(f"Loaded {len(resolutions)} cached resolutions")

    # Compute stream start for timestamp conversion
    stream_start_unix: float | None = None
    if args.session_dir:
        session_dir = Path(args.session_dir)
        if not session_dir.is_absolute():
            session_dir = REPO_ROOT / session_dir
        stream_start_unix = compute_stream_start(session_dir)
    if stream_start_unix is None:
        # Fall back to eventStartTime from market JSON
        est = market.get("eventStartTime")
        if est:
            stream_start_unix = datetime.fromisoformat(est.replace("Z", "+00:00")).timestamp()
        else:
            print("WARNING: Cannot determine stream start time. Using signal timestamps as-is.")
            stream_start_unix = 0

    # Determine DB path
    db_path: str | None = None
    if args.db:
        db_path = str(Path(args.db) if Path(args.db).is_absolute() else REPO_ROOT / args.db)
    else:
        # Auto-detect from signals_path
        slug = signals_path.parent.name
        candidate = REPO_ROOT / "market_tracking" / f"{slug}.db"
        if candidate.exists():
            db_path = str(candidate)

    if db_path and Path(db_path).exists():
        print(f"Using orderbook DB: {db_path}")
    elif db_path:
        print(f"WARNING: Orderbook DB not found at {db_path}")
        db_path = None
    else:
        print("No orderbook DB available — using default fill prices")

    print(f"\nGates: min_confidence={_gate_cfg['min_confidence']}, min_yes_ask_price={_gate_cfg['min_yes_ask_price']}, max_session_loss={_gate_cfg['max_session_loss']}\n")

    # ── Process signals ──────────────────────────────────────────────

    session_cost_total = 0.0
    trades: list[dict] = []
    gate_skips: dict[str, int] = defaultdict(int)

    for i, signal in enumerate(signals):
        ticker = signal["ticker"]
        keyword = signal["keyword"]
        timestamp = signal["timestamp"]

        # Reconstruct orderbook at signal time
        book = None
        if db_path:
            iso_ts = signal_to_iso(timestamp, stream_start_unix)
            book = book_at(db_path, ticker, iso_ts)

        passed, reason, fill_price = evaluate_gates(signal, market, book, session_cost_total)

        if not passed:
            gate_skips[reason.split(":")[0].split(" (")[0]] += 1
            continue

        # Determine dollar amount
        dollar_amount = get_dollar_amount(market, keyword)

        # Simulate fill
        if fill_price is None:
            fill_price = args.default_fill

        resolution_info = resolutions.get(ticker, {})
        resolution = resolution_info.get("result")
        if resolution and resolution.lower() in ("yes", "no"):
            resolution = resolution.lower()

        result = compute_pnl(fill_price, dollar_amount, resolution)
        session_cost_total += dollar_amount

        trades.append({
            **signal,
            "fill_price": round(fill_price, 4),
            "contracts": round(result["contracts"], 2),
            "dollar_amount": dollar_amount,
            "resolution": result["resolution"],
            "pnl": round(result["pnl"], 2),
            "iso_timestamp": signal_to_iso(timestamp, stream_start_unix) if stream_start_unix else "",
        })

    # ── Output ────────────────────────────────────────────────────────

    print("=" * 90)
    print(f"{'Time':>8s}  {'Keyword':<20s} {'Ticker':<40s} {'Fill':>7s} {'Qty':>7s} {'Cost':>7s} {'Res':>5s} {'P&L':>8s}")
    print("-" * 90)

    total_pnl = 0.0
    total_cost = 0.0
    wins = 0
    losses = 0

    for t in trades:
        ts_display = f"{t['timestamp']:.1f}s" if t['timestamp'] < 3600 else f"{t['timestamp']/60:.1f}m"
        is_win = t["pnl"] > 0
        is_loss = t["pnl"] < 0
        if is_win:
            wins += 1
        if is_loss:
            losses += 1
        total_pnl += t["pnl"]
        total_cost += t["dollar_amount"]

        print(f"{ts_display:>8s}  {t['keyword']:<20s} {t['ticker']:<40s} "
              f"${t['fill_price']:<6.4f} {t['contracts']:>7.1f} "
              f"${t['dollar_amount']:<6.2f} {t['resolution']:>5s} "
              f"${t['pnl']:>+8.2f}")

    print("-" * 90)

    # Summary
    resolved = wins + losses
    win_rate = (wins / resolved * 100) if resolved > 0 else 0
    roi = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Total signals:       {len(signals)}")
    print(f"  Trades executed:     {len(trades)}")
    print(f"  Wins:                {wins}")
    print(f"  Losses:              {losses}")
    print(f"  Unresolved:          {len(trades) - resolved}")
    print(f"  Win rate:            {win_rate:.1f}%")
    print(f"  Total cost:          ${total_cost:.2f}")
    print(f"  Total P&L:           ${total_pnl:+.2f}")
    print(f"  ROI:                 {roi:+.1f}%")

    if gate_skips:
        print(f"\n  Gate skips:")
        for reason, count in sorted(gate_skips.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {count}")

    print(f"\n  Session cost: ${session_cost_total:.2f} / ${_gate_cfg['max_session_loss']:.0f}")


if __name__ == "__main__":
    main()
