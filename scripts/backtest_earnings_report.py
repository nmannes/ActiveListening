#!/usr/bin/env python
"""
backtest_earnings_report.py — Backtest the earnings-report gap strategy.

For every finalized earnings-mention market with (a) a transcript baseline
computed from calls BEFORE the event and (b) a last traded price ~24h before
resolution (data/market_history.jsonl): bet the side that is undervalued
relative to the baseline — YES when baseline > YES price, NO when
1 − baseline > NO price — and settle at the actual resolution result.
Markets where neither side is undervalued are skipped.

The baseline uses only transcripts dated before the event's call date (no
lookahead); the latest pre-event call counts as "said last call".

Output: stdout summary + earnings-backtest.md (threshold sweep, per-company
aggregation, full trade list).

Usage:
    PYTHONPATH=. python scripts/backtest_earnings_report.py
    PYTHONPATH=. python scripts/backtest_earnings_report.py --threshold 0.15 --use-ask
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.generate_earnings_report import (  # noqa: E402
    load_transcripts,
    pre_event_docs,
    word_baseline,
)
from pylib.word_presence import load_presence, save_presence  # noqa: E402
from scripts.fetch_market_history import MENTIONS, OUT_FILE  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HISTORY_FILE = OUT_FILE
OUT_REPORT = ROOT / "earnings-backtest.md"

SWEEP_THRESHOLDS = [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30]

_OLD_EVENT_RE = re.compile(r"KXEARNINGSMENTION[A-Z]+-\d{2}[A-Z]{3}$")


def pnl(side: str, cost: float, result: str, fee_rate: float) -> tuple:
    """(gross, net) P&L per $1 staked. Winners collect $1; the fee is
    charged on profit only (Kalshi's ~3% of winnings)."""
    win = (result == "yes") == (side == "YES")
    gross = 1.0 - cost if win else -cost
    net = gross - fee_rate * max(gross, 0.0)
    return gross, net


def load_history(path: Path) -> List[dict]:
    rows = []
    for line in path.open():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def load_call_dates(path: Path) -> Dict[str, str]:
    out = {}
    for line in path.open():
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("event_ticker") and ev.get("call_date"):
            out[ev["event_ticker"]] = ev["call_date"]
    return out


def simulate(history: List[dict], docs_by_ticker: Dict[str, List[dict]],
             call_dates: Dict[str, str], fee_rate: float,
             use_ask: bool, max_price: Optional[float] = None,
             presence: Optional[dict] = None) -> tuple:
    """Tradable candidates + coverage counts. Side = the one whose edge
    (baseline vs its executable price: YES ask for YES, NO ask = 1 − YES bid
    for NO) is positive and larger; trades with no positive edge on either
    side are skipped, and trades whose chosen side costs more than max_price
    are excluded. Threshold filtering happens in the sweep so one pass
    covers all thresholds. `presence` serves word-presence vectors from the
    disk cache (pylib/word_presence) instead of rescanning transcript text."""
    trades: List[dict] = []
    coverage = {"n_history": len(history), "n_price": 0, "n_baseline": 0,
                "n_tradable": 0, "n_old_format": 0, "n_capped": 0}
    for r in history:
        price = r.get("price_24h")
        if price is None:
            continue
        coverage["n_price"] += 1

        full_docs = docs_by_ticker.get(r["code"], [])
        ev_date = call_dates.get(r.get("event_ticker") or "")
        if not ev_date:
            continue
        docs = pre_event_docs(full_docs, ev_date)
        if not docs:
            continue
        coverage["n_baseline"] += 1
        if _OLD_EVENT_RE.match(r.get("event_ticker") or ""):
            coverage["n_old_format"] += 1

        _, _, _, p = word_baseline(r["word"], docs, code=r["code"],
                                   presence=presence, full_docs=full_docs)
        if p is None:
            continue

        yes_cost = price
        no_cost = round(1.0 - price, 2)
        if use_ask:
            if r.get("yes_ask_24h") is not None:
                yes_cost = r["yes_ask_24h"]
            if r.get("yes_bid_24h") is not None:
                no_cost = round(1.0 - r["yes_bid_24h"], 2)

        edge_yes = p - yes_cost          # P − YES price
        edge_no = (1.0 - p) - no_cost    # (1−P) − NO price
        side = "YES" if edge_yes >= edge_no else "NO"
        gap = edge_yes if side == "YES" else edge_no
        cost = yes_cost if side == "YES" else no_cost
        if gap <= 0:
            continue                     # neither side undervalued
        if max_price is not None and cost > max_price:
            coverage["n_capped"] += 1
            continue
        gross, net = pnl(side, cost, r["result"], fee_rate)
        _, net_yes = pnl("YES", yes_cost, r["result"], fee_rate)
        _, net_no = pnl("NO", no_cost, r["result"], fee_rate)
        trades.append({
            "ticker": r["ticker"], "code": r["code"], "word": r["word"],
            "event_date": ev_date, "close_time_iso": r.get("close_time_iso"),
            "baseline": p, "price": cost, "gap": gap, "side": side,
            "cost": cost, "result": r["result"], "win": gross > 0,
            "pnl_gross": gross, "pnl_net": net,
            "net_yes": net_yes, "net_no": net_no,
        })
    coverage["n_tradable"] = len(trades)
    return trades, coverage


def sweep(trades: List[dict], thresholds: List[float]) -> List[dict]:
    rows = []
    for t in thresholds:
        sub = [x for x in trades if abs(x["gap"]) >= t]
        n = len(sub)
        wins = sum(1 for x in sub if x["win"])
        gross = sum(x["pnl_gross"] for x in sub)
        net = sum(x["pnl_net"] for x in sub)
        by_side = {}
        for side in ("YES", "NO"):
            s = [x for x in sub if x["side"] == side]
            by_side[side] = (len(s), sum(1 for x in s if x["win"]),
                             sum(x["pnl_net"] for x in s))
        rows.append({"threshold": t, "n": n, "wins": wins,
                     "win_rate": wins / n if n else None,
                     "gross": gross, "net": net, "by_side": by_side,
                     "net_yes": sum(x["net_yes"] for x in sub),
                     "net_no": sum(x["net_no"] for x in sub)})
    return rows


def render(trades: List[dict], coverage: dict, sweep_rows: List[dict],
           fee_rate: float, max_price: Optional[float] = None) -> str:
    lines = ["# Earnings Backtest",
             "",
             f"Generated {date.today().isoformat()}",
             "",
             "## Strategy",
             "",
             "For each finalized word market: baseline P from transcripts of "
             "calls before the event vs the executable price ~24h before the "
             "market resolved (the YES ask, or last trade without orderbook "
             "data). Bet the undervalued side: YES when baseline > YES price, "
             "NO when 1 − baseline > NO price; skip when neither side is "
             "undervalued; settle at the actual resolution. Gap = edge on the "
             "chosen side.",
             "",
             "## Coverage",
             "",
             f"- {coverage['n_history']} finalized markets with history fetched",
             f"- {coverage['n_price']} with a price ~24h before resolution",
             f"- {coverage['n_baseline']} with a transcript baseline (pre-event calls)",
             f"- {coverage['n_tradable']} tradable (both price and baseline)"]
    if max_price is not None:
        lines.append(f"- {coverage['n_capped']} excluded by the max-price cap")
    lines += [f"- fee: {100 * fee_rate:.0f}% on profit" if fee_rate else "- fee: 0",
              ""]
    if coverage["n_old_format"]:
        lines.append(f"- {coverage['n_old_format']} trades use day-less event "
                     "tickers (e.g. -25MAY) whose call date is approximated as "
                     "the 1st of the month")
        lines.append("")

    lines += ["## Threshold sweep (min |gap|)",
              "",
              "Net if always YES / always NO shows the same candidates traded "
              "on one fixed side — the benchmark the side selection must beat.",
              "",
              "| Min \\|gap\\| | Trades | Wins | Win rate | Gross | Net | "
              "YES (n/wins/net) | NO (n/wins/net) | Always YES | Always NO |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for r in sweep_rows:
        wr = f"{100 * r['win_rate']:.0f}%" if r["win_rate"] is not None else "-"
        y = r["by_side"]["YES"]
        n = r["by_side"]["NO"]
        lines.append(f"| {r['threshold']:.2f} | {r['n']} | {r['wins']} | {wr} | "
                     f"{r['gross']:+.2f} | {r['net']:+.2f} | "
                     f"{y[0]} / {y[1]} / {y[2]:+.2f} | {n[0]} / {n[1]} / {n[2]:+.2f} | "
                     f"{r['net_yes']:+.2f} | {r['net_no']:+.2f} |")
    lines.append("")

    lines += ["## Per company (min |gap| 0.10)",
              "",
              "| Company | Trades | Wins | Net |",
              "|---|---|---|---|"]
    by_co = defaultdict(lambda: [0, 0, 0.0])
    for x in trades:
        if abs(x["gap"]) < 0.10:
            continue
        c = by_co[x["code"]]
        c[0] += 1
        c[1] += x["win"]
        c[2] += x["pnl_net"]
    for code in sorted(by_co):
        n, w, net = by_co[code]
        lines.append(f"| {code} | {n} | {w} | {net:+.2f} |")
    lines.append("")

    lines += ["## Trades (min |gap| 0.10)",
              "",
              "| Event | Company | Word | Baseline | Price | Gap | Side | Result | Gross | Net |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for x in sorted(trades, key=lambda t: (t["event_date"], t["code"])):
        if abs(x["gap"]) < 0.10:
            continue
        lines.append(f"| {x['event_date']} | {x['code']} | {x['word']} | "
                     f"{100 * x['baseline']:.0f}% | {x['price']:.2f} | "
                     f"{100 * x['gap']:+.0f} | {x['side']} | {x['result']} | "
                     f"{x['pnl_gross']:+.2f} | {x['pnl_net']:+.2f} |")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main():
    ap = argparse.ArgumentParser(description="Backtest the earnings-report gap strategy")
    ap.add_argument("--history", type=Path, default=HISTORY_FILE)
    ap.add_argument("--out", type=Path, default=OUT_REPORT)
    ap.add_argument("--fee-rate", type=float, default=0.03,
                    help="Fee as a share of profit (default 0.03)")
    ap.add_argument("--use-ask", action="store_true",
                    help="Trade at the 24h-before ask/bid instead of last trade")
    ap.add_argument("--max-price", type=float, default=None,
                    help="Only take bets whose chosen side costs at most this "
                         "much (e.g. 0.30 = 30¢ contracts only)")
    args = ap.parse_args()

    history = load_history(args.history)
    docs_by_ticker = load_transcripts()
    call_dates = load_call_dates(MENTIONS)
    presence = load_presence()

    trades, coverage = simulate(history, docs_by_ticker, call_dates,
                                args.fee_rate, args.use_ask, args.max_price,
                                presence=presence)
    save_presence(presence)
    rows = sweep(trades, SWEEP_THRESHOLDS)
    text = render(trades, coverage, rows, args.fee_rate, args.max_price)
    args.out.write_text(text)

    print(f"Wrote {args.out}")
    print(f"history {coverage['n_history']} · with price {coverage['n_price']} · "
          f"with baseline {coverage['n_baseline']} · tradable {coverage['n_tradable']}"
          + (f" · capped {coverage['n_capped']}" if args.max_price is not None else ""))
    for r in rows:
        wr = f"{100 * r['win_rate']:.0f}%" if r["win_rate"] is not None else "-"
        print(f"|gap| >= {r['threshold']:.2f}: {r['n']} trades, {r['wins']} wins "
              f"({wr}), net {r['net']:+.2f} (always YES {r['net_yes']:+.2f} / "
              f"always NO {r['net_no']:+.2f})")


if __name__ == "__main__":
    main()
