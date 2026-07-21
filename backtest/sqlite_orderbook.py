"""
sqlite_orderbook.py — Orderbook reconstruction from SQLite snapshots + deltas.

Used by the legacy backtest/simulate.py path. For the new unified backtest,
see backtest/orderbook.py which uses Kalshi API market data.

Port of lib/orderbook_analysis.js bookAt().
"""

import json
import sqlite3


def book_at(db_path: str, ticker: str, ts: str) -> dict | None:
    """Reconstruct the orderbook at an ISO timestamp for a specific ticker.

    Returns {yes: {price_cents: qty}, no: {price_cents: qty}} or None.
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
