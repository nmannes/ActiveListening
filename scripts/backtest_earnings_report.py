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

The headline sweep uses the raw transcript baseline (the strategy as run).
An isotonic (monotone) recalibration of P(word said) is fit on markets
closing before --cutoff and both variants are evaluated on both sides of the
cutoff (temporal holdout), so the test rows are fully out-of-sample and the
two baselines can be compared honestly. Pass --calibrate to make the
calibrated variant the headline.

Output: stdout summary + earnings-backtest.md (calibration table, temporal
holdout, threshold sweep, per-company aggregation, full trade list).

Usage:
    PYTHONPATH=. python scripts/backtest_earnings_report.py
    PYTHONPATH=. python scripts/backtest_earnings_report.py --use-ask --cutoff 2026-01-01
"""

import argparse
import json
import re
import sys
from bisect import bisect_left
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

# Temporal holdout boundary: the baseline calibration is fit only on markets
# closing before this date, then evaluated on both sides. Transcript coverage
# only starts around Sep 2025 and is sparse before 2026, so the split needs
# to sit inside the baselined window to leave enough training data.
DEFAULT_CUTOFF = "2026-07-01"


def fit_isotonic(xs: List[float], ys: List[int]):
    """Monotone non-decreasing calibration map via pool-adjacent violators.

    Fits P(said) as a non-decreasing step function of the raw baseline.
    Returns a callable mapping any baseline probability to its calibrated
    value; inputs outside the fitted range clamp to the nearest block.
    """
    blocks = []  # [x_max, count, sum_y]; block covers (prev x_max, x_max]
    for x, y in sorted(zip(xs, ys)):
        blocks.append([x, 1, y])
        while len(blocks) >= 2 and \
                blocks[-1][2] * blocks[-2][1] < blocks[-2][2] * blocks[-1][1]:
            b = blocks.pop()
            blocks[-1] = [b[0], blocks[-1][1] + b[1], blocks[-1][2] + b[2]]
    bounds = [b[0] for b in blocks]
    vals = [b[2] / b[1] for b in blocks]

    def calibrate(p: float) -> float:
        return vals[min(bisect_left(bounds, p), len(vals) - 1)]

    return calibrate


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
             presence: Optional[dict] = None,
             calibrator=None, collect: bool = False) -> tuple:
    """Tradable candidates + coverage counts. Side = the one whose edge
    (calibrated baseline vs its executable price: YES ask for YES, NO ask =
    1 − YES bid for NO) is positive and larger; trades with no positive edge
    on either side are skipped, and trades whose chosen side costs more than
    max_price are excluded. Threshold filtering happens in the sweep so one
    pass covers all thresholds. `calibrator` maps the raw baseline to a
    recalibrated probability before edges are computed. With `collect=True`
    the raw (p, result, close date) of every baselined market is returned as
    a third element so a calibrator can be fit on a date slice. `presence`
    serves word-presence vectors from the disk cache (pylib/word_presence)
    instead of rescanning transcript text."""
    trades: List[dict] = []
    candidates: List[tuple] = []
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

        present_in, n_prior, said_last, p = word_baseline(r["word"], docs,
                                                          code=r["code"],
                                                          presence=presence,
                                                          full_docs=full_docs)
        if p is None:
            continue
        if collect and r.get("result") in ("yes", "no"):
            candidates.append((p, r["result"],
                               (r.get("close_time_iso") or "")[:10]))
        if calibrator is not None:
            p = calibrator(p)

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
            "present_in": present_in, "n_prior": n_prior,
            "said_last": said_last,
        })
    coverage["n_tradable"] = len(trades)
    if collect:
        return trades, coverage, candidates
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
           fee_rate: float, max_price: Optional[float] = None,
           cutoff_iso: str = DEFAULT_CUTOFF, cal_rows: Optional[List[dict]] = None,
           holdout: Optional[List[dict]] = None,
           split_cov: Optional[dict] = None,
           calibrate: bool = False) -> str:
    cal_note = (" then recalibrated by an isotonic fit of P(word said) vs "
                "realized outcomes on markets closing before the holdout "
                "cutoff (no lookahead past it). The "
                if calibrate else
                "; an isotonic recalibration of P(word said) (fit on train "
                "markets only) is also evaluated as an experiment — see the "
                "Temporal holdout table for the verdict. The ")
    lines = ["# Earnings Backtest",
             "",
             f"Generated {date.today().isoformat()}",
             "",
             "## Strategy",
             "",
             f"For each finalized word market: a transcript baseline P is "
             f"computed from calls before the event{cal_note}"
             "baseline is compared to the executable price ~24h before the "
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
    if split_cov:
        for name in ("train", "test"):
            lines.append(f"- {split_cov[name][0]['n_baseline']} {name} markets "
                         f"with a baseline ({name} = closing "
                         f"{'before' if name == 'train' else 'on/after'} "
                         f"{cutoff_iso})")
        lines.append("")

    if cal_rows:
        lines += ["## Calibration",
                  "",
                  "Isotonic (monotone) fit of P(word said) vs the raw "
                  f"transcript baseline, fit on train markets (closing before "
                  f"{cutoff_iso}) only and applied everywhere below. A "
                  "well-calibrated baseline would match Realized in every row; "
                  "the gaps between Realized and the raw baseline are where "
                  "the naive strategy's worst losses came from.",
                  "",
                  "| Baseline | n | Realized | Calibrated |",
                  "|---|---|---|---|"]
        for r in cal_rows:
            lines.append(f"| {r['bucket']} | {r['n']} | "
                         f"{100 * r['realized']:.0f}% | "
                         f"{100 * r['calibrated']:.0f}% |")
        lines.append("")

    title = ("## Threshold sweep (min |gap|, calibrated baseline)" if calibrate
             else "## Threshold sweep (min |gap|, raw baseline)")
    lines += [title,
              "",
              "Net if always YES / always NO shows the same candidates traded "
              "on one fixed side — the benchmark the side selection must beat. "
              + ("Calibration is fit on train only; " if calibrate else "") +
              "See Temporal holdout for the out-of-sample view.",
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

    if holdout:
        lines += ["## Temporal holdout",
                  "",
                  f"Same strategy evaluated on each side of the cutoff "
                  f"({cutoff_iso}), with and without calibration. The "
                  "calibration is always fit on train only, so the test rows "
                  "are fully out-of-sample.",
                  "",
                  "| Min \\|gap\\| | Split | Calibrated | Trades | Wins | "
                  "Win rate | Net |",
                  "|---|---|---|---|---|---|---|"]
        for r in holdout:
            wr = f"{100 * r['wins'] / r['n']:.0f}%" if r["n"] else "-"
            lines.append(f"| {r['threshold']:.2f} | {r['split']} | "
                         f"{'yes' if r['calibrated'] else 'no'} | {r['n']} | "
                         f"{r['wins']} | {wr} | {r['net']:+.2f} |")
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
              "| Event | Company | Word | Prior | Last | Baseline | Price | Gap | Side | Result | Gross | Net |",
              "|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for x in sorted(trades, key=lambda t: (t["event_date"], t["code"])):
        if abs(x["gap"]) < 0.10:
            continue
        last = "✅" if x["said_last"] else "❌"
        lines.append(f"| {x['event_date']} | {x['code']} | {x['word']} | "
                     f"{x['present_in']}/{x['n_prior']} | {last} | "
                     f"{100 * x['baseline']:.0f}% | {x['price']:.2f} | "
                     f"{100 * x['gap']:+.0f} | {x['side']} | {x['result']} | "
                     f"{x['pnl_gross']:+.2f} | {x['pnl_net']:+.2f} |")
    lines += ["",
              "*Prior = calls that said the word / prior calls on record. "
              "Last = the most recent pre-event call said the word (✅) or "
              "not (❌) — it drives the baseline's transition prior "
              "(0.67 vs 0.243).*",
              ""]
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
    ap.add_argument("--cutoff", default=DEFAULT_CUTOFF,
                    help="Temporal holdout boundary (YYYY-MM-DD): calibration "
                         "is fit on markets closing before this date")
    ap.add_argument("--calibrate", action="store_true",
                    help="Use the isotonic-recalibrated baseline for the "
                         "headline sweep/per-company/trades (default: raw "
                         "baseline; both variants are always shown in the "
                         "temporal holdout)")
    args = ap.parse_args()

    history = load_history(args.history)
    docs_by_ticker = load_transcripts()
    call_dates = load_call_dates(MENTIONS)
    presence = load_presence()

    # Pass 1: gather every baselined market (raw p + outcome + close date) so
    # the calibrator can be fit on the pre-cutoff slice only.
    _, _, candidates = simulate(history, docs_by_ticker, call_dates,
                                args.fee_rate, args.use_ask, args.max_price,
                                presence=presence, collect=True)
    train_cand = [c for c in candidates if c[2] and c[2] < args.cutoff]
    calibrator = fit_isotonic([c[0] for c in train_cand],
                              [1 if c[1] == "yes" else 0 for c in train_cand])

    trades, coverage = simulate(history, docs_by_ticker, call_dates,
                                args.fee_rate, args.use_ask, args.max_price,
                                presence=presence,
                                calibrator=calibrator if args.calibrate else None)
    save_presence(presence)
    rows = sweep(trades, SWEEP_THRESHOLDS)

    # Temporal holdout: same strategy on each side of the cutoff.
    hist_train = [r for r in history
                  if (r.get("close_time_iso") or "")[:10] < args.cutoff]
    hist_test = [r for r in history
                 if (r.get("close_time_iso") or "")[:10] >= args.cutoff]
    holdout = []
    split_cov = {}
    for name, h in (("train", hist_train), ("test", hist_test)):
        tr_raw, cov_raw = simulate(h, docs_by_ticker, call_dates, args.fee_rate,
                                   args.use_ask, args.max_price, presence=presence)
        tr_cal, cov_cal = simulate(h, docs_by_ticker, call_dates, args.fee_rate,
                                   args.use_ask, args.max_price, presence=presence,
                                   calibrator=calibrator)
        split_cov[name] = (cov_raw, cov_cal)
        for cal_on, tr in ((False, tr_raw), (True, tr_cal)):
            for th in SWEEP_THRESHOLDS:
                sub = [x for x in tr if abs(x["gap"]) >= th]
                holdout.append({"threshold": th, "split": name,
                                "calibrated": cal_on, "n": len(sub),
                                "wins": sum(1 for x in sub if x["win"]),
                                "net": sum(x["pnl_net"] for x in sub)})

    # Calibration summary (train only): realized vs fitted rate per decile.
    cal_rows = None
    if args.calibrate:
        buckets = defaultdict(list)
        for p, result, _ in train_cand:
            buckets[int(p * 10) / 10].append((p, result == "yes"))
        cal_rows = []
        for b in sorted(buckets):
            n = len(buckets[b])
            mean_p = sum(x[0] for x in buckets[b]) / n
            realized = sum(x[1] for x in buckets[b]) / n
            cal_rows.append({"bucket": f"{b:.1f}–{b + 0.1:.1f}", "n": n,
                             "realized": realized,
                             "calibrated": calibrator(mean_p)})

    text = render(trades, coverage, rows, args.fee_rate, args.max_price,
                  cutoff_iso=args.cutoff, cal_rows=cal_rows,
                  holdout=holdout, split_cov=split_cov,
                  calibrate=args.calibrate)
    args.out.write_text(text)

    print(f"Wrote {args.out}")
    print(f"history {coverage['n_history']} · with price {coverage['n_price']} · "
          f"with baseline {coverage['n_baseline']} · tradable {coverage['n_tradable']}"
          + (f" · capped {coverage['n_capped']}" if args.max_price is not None else ""))
    if args.calibrate:
        print(f"calibration fit on {len(train_cand)} pre-{args.cutoff} markets")
    for r in holdout:
        if r["threshold"] == 0.10:
            wr = f"{100 * r['wins'] / r['n']:.0f}%" if r["n"] else "-"
            tag = "calibrated" if r["calibrated"] else "raw"
            print(f"holdout {r['split']} [{tag}]: |gap| >= 0.10 -> "
                  f"{r['n']} trades, {r['wins']} wins ({wr}), "
                  f"net {r['net']:+.2f}")
    for r in rows:
        wr = f"{100 * r['win_rate']:.0f}%" if r["win_rate"] is not None else "-"
        print(f"|gap| >= {r['threshold']:.2f}: {r['n']} trades, {r['wins']} wins "
              f"({wr}), net {r['net']:+.2f} (always YES {r['net_yes']:+.2f} / "
              f"always NO {r['net_no']:+.2f})")


if __name__ == "__main__":
    main()
