#!/usr/bin/env python
"""
backtest_earnings_report.py — Backtest the earnings-report gap strategy.

For every finalized earnings-mention market with (a) a transcript baseline
computed from calls BEFORE the event and (b) a last traded price ~24h before
resolution (data/market_history.jsonl): buy YES when baseline > price, NO
when baseline < price, and settle at the actual resolution result.

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
    word_baseline,
)
from scripts.fetch_market_history import MENTIONS, OUT_FILE  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HISTORY_FILE = OUT_FILE
OUT_REPORT = ROOT / "earnings-backtest.md"

SWEEP_THRESHOLDS = [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30]

_OLD_EVENT_RE = re.compile(r"KXEARNINGSMENTION[A-Z]+-\d{2}[A-Z]{3}$")


def pre_event_docs(docs: List[dict], event_date: str) -> List[dict]:
    """Transcripts with call_date strictly before the event (no lookahead;
    same-day transcripts are excluded — they cover the call being predicted)."""
    return [d for d in docs if (d.get("call_date") or "") < event_date]


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
             use_ask: bool) -> tuple:
    """Tradable candidates (|gap| >= 0) + coverage counts. Threshold
    filtering happens in the sweep so one pass covers all thresholds."""
    trades: List[dict] = []
    coverage = {"n_history": len(history), "n_price": 0, "n_baseline": 0,
                "n_tradable": 0, "n_old_format": 0}
    for r in history:
        price = r.get("price_24h")
        if price is None:
            continue
        coverage["n_price"] += 1

        docs = docs_by_ticker.get(r["code"], [])
        ev_date = call_dates.get(r.get("event_ticker") or "")
        if not ev_date:
            continue
        docs = pre_event_docs(docs, ev_date)
        if not docs:
            continue
        coverage["n_baseline"] += 1
        if _OLD_EVENT_RE.match(r.get("event_ticker") or ""):
            coverage["n_old_format"] += 1

        _, _, _, p = word_baseline(r["word"], docs)
        if p is None:
            continue

        yes_cost = price
        no_cost = round(1.0 - price, 2)
        if use_ask:
            if r.get("yes_ask_24h") is not None:
                yes_cost = r["yes_ask_24h"]
            if r.get("yes_bid_24h") is not None:
                no_cost = round(1.0 - r["yes_bid_24h"], 2)

        gap = p - yes_cost
        side = "YES" if gap > 0 else "NO"
        cost = yes_cost if side == "YES" else no_cost
        gross, net = pnl(side, cost, r["result"], fee_rate)
        trades.append({
            "ticker": r["ticker"], "code": r["code"], "word": r["word"],
            "event_date": ev_date, "close_time_iso": r.get("close_time_iso"),
            "baseline": p, "price": yes_cost, "gap": gap, "side": side,
            "cost": cost, "result": r["result"], "win": gross > 0,
            "pnl_gross": gross, "pnl_net": net,
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
                     "gross": gross, "net": net, "by_side": by_side})
    return rows


def render(trades: List[dict], coverage: dict, sweep_rows: List[dict],
           fee_rate: float) -> str:
    lines = ["# Earnings Backtest",
             "",
             f"Generated {date.today().isoformat()}",
             "",
             "## Strategy",
             "",
             "For each finalized word market: baseline P from transcripts of "
             "calls before the event vs the last traded YES price ~24h before "
             "the market resolved. Buy YES when baseline > price, NO when "
             "baseline < price; settle at the actual resolution. Gap = "
             "baseline − price.",
             "",
             "## Coverage",
             "",
             f"- {coverage['n_history']} finalized markets with history fetched",
             f"- {coverage['n_price']} with a price ~24h before resolution",
             f"- {coverage['n_baseline']} with a transcript baseline (pre-event calls)",
             f"- {coverage['n_tradable']} tradable (both price and baseline)",
             f"- fee: {100 * fee_rate:.0f}% on profit" if fee_rate else "- fee: 0",
             ""]
    if coverage["n_old_format"]:
        lines.append(f"- {coverage['n_old_format']} trades use day-less event "
                     "tickers (e.g. -25MAY) whose call date is approximated as "
                     "the 1st of the month",
                     "")

    lines += ["## Threshold sweep (min |gap|)",
              "",
              "| Min |gap| | Trades | Wins | Win rate | Gross | Net | YES (n/wins/net) | NO (n/wins/net) |",
              "|---|---|---|---|---|---|---|---|"]
    for r in sweep_rows:
        wr = f"{100 * r['win_rate']:.0f}%" if r["win_rate"] is not None else "-"
        y = r["by_side"]["YES"]
        n = r["by_side"]["NO"]
        lines.append(f"| {r['threshold']:.2f} | {r['n']} | {r['wins']} | {wr} | "
                     f"{r['gross']:+.2f} | {r['net']:+.2f} | "
                     f"{y[0]} / {y[1]} / {y[2]:+.2f} | {n[0]} / {n[1]} / {n[2]:+.2f} |")
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
    args = ap.parse_args()

    history = load_history(args.history)
    docs_by_ticker = load_transcripts()
    call_dates = load_call_dates(MENTIONS)

    trades, coverage = simulate(history, docs_by_ticker, call_dates,
                                args.fee_rate, args.use_ask)
    rows = sweep(trades, SWEEP_THRESHOLDS)
    text = render(trades, coverage, rows, args.fee_rate)
    args.out.write_text(text)

    print(f"Wrote {args.out}")
    print(f"history {coverage['n_history']} · with price {coverage['n_price']} · "
          f"with baseline {coverage['n_baseline']} · tradable {coverage['n_tradable']}")
    for r in rows:
        wr = f"{100 * r['win_rate']:.0f}%" if r["win_rate"] is not None else "-"
        print(f"|gap| >= {r['threshold']:.2f}: {r['n']} trades, {r['wins']} wins "
              f"({wr}), net {r['net']:+.2f}")


if __name__ == "__main__":
    main()
