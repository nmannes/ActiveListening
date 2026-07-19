#!/usr/bin/env python3
"""
backtest.py — Replay historical signals through the trading gates and compute P&L.

Reads:
  - app-prod.log          → signal detections (JSON lines from Pino logger)
  - market_tracking/*.db  → orderbook snapshots + deltas at signal time
  - cache/resolutions.json → per-ticker settlement results

Simulates the same gates as SignalHandler.handle_signal():
  1. Speaker whitelist   (not enforced — speaker data not in logs)
  2. trade_for_real       (irrelevant for backtest)
  3. Blocked keywords     (ordering_config.BLOCKED_KEYWORDS)
  4. Min confidence       (0.80 default — but logs lack numeric confidence)
  5. Min YES ask price    (skip if YES ask ≤ 2¢ → market likely resolved YES)
  6. Resolved-NO check    (skip if YES bid missing or ≤ 1¢)
  7. Session loss cap     (default $100)
  8. Order pricing        (fill at best YES ask from orderbook at signal time)

Outputs:
  - Per-trade table with word, ticker, fill price, contracts, outcome, P&L
  - Summary: total trades, win rate, total P&L, sessions capped
"""

import json
import os
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

# Project root
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from pylib.ordering_config import BLOCKED_KEYWORDS, get_dollar_amount


# ── Config (mirrors config.yaml / server.Config) ──────────────────────────

MIN_CONFIDENCE = float(os.environ.get("MIN_CONFIDENCE", "0.80"))
MIN_YES_ASK_PRICE = float(os.environ.get("MIN_YES_ASK_PRICE", "0.02"))
MAX_SESSION_LOSS = float(os.environ.get("MAX_SESSION_LOSS", "100"))


# ── Signal parsing ────────────────────────────────────────────────────────

def parse_signals(log_path: Path) -> list[dict]:
    """Parse app-prod.log for SIGNAL entries. Returns list of {ts, word, ticker, session}."""
    signals = []
    if not log_path.exists():
        print(f"WARNING: {log_path} not found")
        return signals

    with open(log_path) as f:
        for line in f:
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            msg = entry.get("msg", "")
            if "[SIGNAL]" not in msg:
                continue

            # Format: "[SIGNAL][word] Ticker: TICKER"
            # or: "[session][SIGNAL] ..."
            # Extract word from first bracket after SIGNAL
            import re
            word_match = re.search(r'\[SIGNAL\]\[(\S+?)\]', msg)
            ticker_match = re.search(r'Ticker:\s*(\S+)', msg)

            if not word_match or not ticker_match:
                continue

            word = word_match.group(1).lower()
            ticker = ticker_match.group(1)

            # Extract session slug from ticker prefix
            # e.g., KXNCAABMENTION-26FEB17TTUASU-DRAF → kxncaabmention-26feb17ttuasu
            parts = ticker.split("-")
            session = "-".join(parts[:-1]).lower() if len(parts) >= 2 else "unknown"

            signals.append({
                "ts_ms": entry.get("time", 0),
                "word": word,
                "ticker": ticker,
                "session": session,
            })

    return signals


# ── Orderbook reconstruction ──────────────────────────────────────────────

def open_tracking_db(session_slug: str) -> sqlite3.Connection | None:
    """Open the market_tracking DB for a session slug."""
    db_path = ROOT / "market_tracking" / f"{session_slug}.db"
    if not db_path.exists():
        return None
    return sqlite3.connect(str(db_path))


def get_tickers(db: sqlite3.Connection) -> list[str]:
    rows = db.execute("SELECT DISTINCT ticker FROM snapshots").fetchall()
    return [r[0] for r in rows]


def yes_ask_price_at(db: sqlite3.Connection, ticker: str, ts_iso: str) -> float | None:
    """
    Reconstruct the best YES ask price (in dollars) at a given ISO timestamp.

    The YES ask is 1.0 - (best NO bid price). On Kalshi, selling YES = buying NO,
    so the lowest NO bid price gives the lowest YES ask = 1.0 - NO_price/100.
    """
    snapshot = db.execute(
        "SELECT ts, no, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1",
        (ticker, ts_iso),
    ).fetchone()

    if not snapshot:
        return None

    snap_ts, no_json, snap_seq = snapshot
    book_no: dict[int, int] = {}
    try:
        for price_cents, qty in json.loads(no_json or "[]"):
            book_no[price_cents] = qty
    except json.JSONDecodeError:
        pass

    # Apply deltas between snapshot time and target time
    deltas = db.execute(
        "SELECT side, price, delta, seq FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC",
        (ticker, snap_ts, ts_iso),
    ).fetchall()

    for side, price, delta_qty, _seq in deltas:
        if side != "no":
            continue
        cur = book_no.get(price, 0)
        upd = cur + delta_qty
        if upd <= 0:
            book_no.pop(price, None)
        else:
            book_no[price] = upd

    if not book_no:
        return None

    best_no_bid_cents = min(book_no.keys())
    yes_ask_dollars = 1.0 - (best_no_bid_cents / 100.0)
    return yes_ask_dollars


def yes_bid_price_at(db: sqlite3.Connection, ticker: str, ts_iso: str) -> float | None:
    """Reconstruct the best YES bid price (in dollars) at a given ISO timestamp."""
    snapshot = db.execute(
        "SELECT ts, yes, seq FROM snapshots WHERE ticker = ? AND ts <= ? ORDER BY ts DESC LIMIT 1",
        (ticker, ts_iso),
    ).fetchone()

    if not snapshot:
        return None

    snap_ts, yes_json, snap_seq = snapshot
    book_yes: dict[int, int] = {}
    try:
        for price_cents, qty in json.loads(yes_json or "[]"):
            book_yes[price_cents] = qty
    except json.JSONDecodeError:
        pass

    deltas = db.execute(
        "SELECT side, price, delta, seq FROM deltas WHERE ticker = ? AND ts > ? AND ts <= ? ORDER BY seq ASC, ts ASC",
        (ticker, snap_ts, ts_iso),
    ).fetchall()

    for side, price, delta_qty, _seq in deltas:
        if side != "yes":
            continue
        cur = book_yes.get(price, 0)
        upd = cur + delta_qty
        if upd <= 0:
            book_yes.pop(price, None)
        else:
            book_yes[price] = upd

    if not book_yes:
        return None

    best_yes_bid_cents = max(book_yes.keys())
    return best_yes_bid_cents / 100.0


# ── Resolution loading ────────────────────────────────────────────────────

def load_resolutions() -> dict[str, dict]:
    """Load cache/resolutions.json → {ticker: {status, result}}."""
    path = ROOT / "cache" / "resolutions.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


# ── Fuzzy ticker matching (port of fuzzyMatchTicker from signal_analysis.js) ──

def fuzzy_match_ticker(keyword: str, tickers: list[str]) -> str | None:
    """Match a spoken keyword to a ticker suffix."""
    kw = keyword.upper().replace("_", "")

    # Exact 4-char prefix match
    prefix4 = kw[:4]
    for t in tickers:
        if t.split("-")[-1] == prefix4:
            return t

    # 3-char prefix
    prefix3 = kw[:3] if len(kw) >= 3 else kw
    for t in tickers:
        if t.split("-")[-1] == prefix3:
            return t

    # Prefix/suffix overlap
    for t in tickers:
        suffix = t.split("-")[-1]
        if len(suffix) >= 3 and kw.startswith(suffix):
            return t
        if len(kw) >= 3 and suffix.startswith(kw[: min(4, len(kw))]):
            return t

    # Special case map
    special = {
        "ARTIFICIALINTELLIGENCE": "AI",
        "MVP": "MVP", "AI": "AI", "FDA": "FDA", "TSA": "TSA",
        "ICE": "ICE", "EV": "EV", "NIO": "NIO", "MSG": "MSG",
        "DJ": "DJ", "JD": "JD",
    }
    mapped = special.get(kw)
    if mapped:
        for t in tickers:
            if t.split("-")[-1] == mapped:
                return t

    return None


# ── Main backtest ─────────────────────────────────────────────────────────

def run_backtest():
    log_path = ROOT / "app-prod.log"
    signals = parse_signals(log_path)
    if not signals:
        print("No signals found in app-prod.log")
        return

    print(f"Loaded {len(signals)} signals from app-prod.log")

    resolutions = load_resolutions()
    print(f"Loaded {len(resolutions)} resolutions from cache/resolutions.json")

    # Open DBs per session (lazy)
    dbs: dict[str, sqlite3.Connection | None] = {}

    trades: list[dict] = []
    session_costs: dict[str, float] = defaultdict(float)
    sessions_capped: set[str] = set()

    skipped_blocked = 0
    skipped_confidence = 0
    skipped_resolved_yes = 0
    skipped_resolved_no = 0
    skipped_cap = 0
    skipped_no_book = 0
    skipped_no_match = 0

    for sig in signals:
        word = sig["word"]
        ticker = sig["ticker"]
        session_slug = sig["session"]
        ts_ms = sig["ts_ms"]
        ts_iso = f"{ts_ms // 1000}.{ts_ms % 1000:03d}Z" if ts_ms else None

        # ── Gate: blocked keyword ─────────────────────────────────────
        if word in BLOCKED_KEYWORDS:
            skipped_blocked += 1
            continue

        # ── Gate: confidence ──────────────────────────────────────────
        # Logs don't include numeric confidence; assume pass
        # (could parse orderbook-annotated signal lines for confidence)

        # ── Get orderbook ─────────────────────────────────────────────
        if session_slug not in dbs:
            dbs[session_slug] = open_tracking_db(session_slug)
        db = dbs[session_slug]

        if db is None:
            skipped_no_book += 1
            continue

        # Try to match word to a ticker in the DB if the logged ticker isn't found
        db_tickers = get_tickers(db)
        matched_ticker = ticker if ticker in db_tickers else fuzzy_match_ticker(word, db_tickers)
        if matched_ticker is None:
            skipped_no_match += 1
            continue

        if ts_iso is None:
            continue

        yes_ask = yes_ask_price_at(db, matched_ticker, ts_iso)
        yes_bid = yes_bid_price_at(db, matched_ticker, ts_iso)

        # ── Gate: resolved YES (ask ≤ 2¢) ────────────────────────────
        if yes_ask is not None and yes_ask <= MIN_YES_ASK_PRICE:
            skipped_resolved_yes += 1
            continue

        # ── Gate: resolved NO (bid missing or ≤ 1¢) ──────────────────
        if yes_bid is None or yes_bid <= 0.01:
            skipped_resolved_no += 1
            continue

        # ── Gate: session cap ─────────────────────────────────────────
        dollar_amount = get_dollar_amount({"slug": session_slug}, word)
        if dollar_amount <= 0:
            skipped_blocked += 1
            continue

        if session_costs[session_slug] + dollar_amount > MAX_SESSION_LOSS:
            skipped_cap += 1
            sessions_capped.add(session_slug)
            continue

        # ── Simulate fill ─────────────────────────────────────────────
        fill_price = yes_ask  # price paid per YES contract, in dollars
        contracts = max(1, int(dollar_amount / fill_price)) if fill_price and fill_price > 0 else 0
        fill_cost = contracts * fill_price

        session_costs[session_slug] += fill_cost

        # ── Resolution ────────────────────────────────────────────────
        resolution = resolutions.get(matched_ticker, {})
        result = resolution.get("result")
        if result == "yes":
            pnl = contracts * (1.0 - fill_price)  # revenue - cost
        elif result == "no":
            pnl = -fill_cost
        else:
            pnl = None  # pending / unknown

        trades.append({
            "ts_ms": ts_ms,
            "word": word,
            "ticker": matched_ticker,
            "session": session_slug,
            "fill_price": fill_price,
            "contracts": contracts,
            "cost": fill_cost,
            "resolution": result,
            "pnl": pnl,
        })

    # Close DBs
    for db in dbs.values():
        if db:
            db.close()

    # ── Print results ──────────────────────────────────────────────────
    print(f"\n{'=' * 80}")
    print(f"BACKTEST RESULTS")
    print(f"{'=' * 80}")

    print(f"\nGate skips:")
    print(f"  Blocked keywords:     {skipped_blocked:>5}")
    print(f"  Confidence < {MIN_CONFIDENCE:.2f}:       {skipped_confidence:>5}")
    print(f"  Resolved YES (ask ≤ {MIN_YES_ASK_PRICE:.2f}): {skipped_resolved_yes:>5}")
    print(f"  Resolved NO:          {skipped_resolved_no:>5}")
    print(f"  Session cap:          {skipped_cap:>5}  ({len(sessions_capped)} sessions capped)")
    print(f"  No orderbook data:    {skipped_no_book:>5}")
    print(f"  No ticker match:      {skipped_no_match:>5}")

    resolved_trades = [t for t in trades if t["pnl"] is not None]
    pending_trades = [t for t in trades if t["pnl"] is None]
    wins = [t for t in resolved_trades if t["pnl"] > 0]
    losses = [t for t in resolved_trades if t["pnl"] <= 0]

    total_pnl = sum(t["pnl"] for t in resolved_trades)
    total_cost = sum(t["cost"] for t in trades)

    print(f"\nTrades:")
    print(f"  Total executed:       {len(trades):>5}")
    print(f"  Resolved:             {len(resolved_trades):>5}")
    print(f"  Pending/unknown:      {len(pending_trades):>5}")
    if resolved_trades:
        print(f"  Wins:                 {len(wins):>5}  ({len(wins)/len(resolved_trades)*100:.1f}%)")
        print(f"  Losses:               {len(losses):>5}  ({len(losses)/len(resolved_trades)*100:.1f}%)")
    print(f"  Total cost:           ${total_cost:>8.2f}")
    if resolved_trades:
        print(f"  Total P&L:            ${total_pnl:>+8.2f}")
        print(f"  ROI:                  {total_pnl/total_cost*100:>+8.1f}%" if total_cost > 0 else "  ROI: N/A")

    print(f"\nSession totals:")
    for slug, cost in sorted(session_costs.items()):
        flag = " [CAPPED]" if slug in sessions_capped else ""
        print(f"  {slug}: ${cost:.2f}{flag}")

    # ── Per-trade detail ───────────────────────────────────────────────
    if trades:
        print(f"\n{'─' * 90}")
        print(f"{'Time':<12} {'Word':<16} {'Fill':>7} {'Qty':>5} {'Cost':>8} {'Res':>6} {'P&L':>8}")
        print(f"{'─' * 90}")
        for t in trades:
            ts_str = str(t["ts_ms"])[-6:] if t["ts_ms"] else "?"
            fp = f"${t['fill_price']:.3f}" if t["fill_price"] else "?"
            res = t["resolution"] or "?"
            pnl_str = f"${t['pnl']:+.2f}" if t["pnl"] is not None else "?"
            print(f"{ts_str:<12} {t['word']:<16} {fp:>7} {t['contracts']:>5} ${t['cost']:>7.2f} {res:>6} {pnl_str:>8}")


if __name__ == "__main__":
    run_backtest()
