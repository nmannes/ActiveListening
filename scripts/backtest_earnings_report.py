#!/usr/bin/env python
"""
backtest_earnings_report.py — Backtest the earnings-report gap strategy.

For every finalized earnings-mention market with (a) a transcript baseline
computed from calls BEFORE the event and (b) an entry price sampled at a
lead of L hours before resolution (default L=24; data/market_history_leads.
jsonl holds price_<L>h at leads 96/72/48/36/24/18/12/6/3/1): bet the side
that is undervalued relative to the baseline — YES when baseline > YES
price, NO when 1 − baseline > NO price — and settle at the actual
resolution result. Markets where neither side is undervalued are skipped.

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
import datetime
import json
import math
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
from backtest.capacity import (  # noqa: E402
    PARTICIPATION,
    capacity_curve,
    net_per_contract,
)

ROOT = Path(__file__).resolve().parent.parent
# Enriched per-lead history (data/market_history_leads.jsonl) supersedes the
# legacy single-lead file when it exists; the refresh pipeline fetches into
# the leads file, so the default tracks it and falls back to the old file.
HISTORY_FILE = ROOT / "data" / "market_history_leads.jsonl"
if not HISTORY_FILE.exists():
    HISTORY_FILE = OUT_FILE
OUT_REPORT = ROOT / "earnings-backtest.md"

SWEEP_THRESHOLDS = [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30]

# Order sizes for the capacity curve, and the sizes the worked/taker comparison
# is shown at. N=1 is the reference row: one contract per trade is small enough
# that the flow cap almost never binds, so it is the closest the capacity model
# gets to the unlimited-fill headline.
CAPACITY_SIZES = [1, 10, 25, 50, 100, 250, 500, 1000]
CAPACITY_EXEC_SIZES = [1, 10, 100, 1000]
CAPACITY_REF_SIZE = 1
VALIDITY_SIZE = 100
CAPACITY_THRESHOLD = 0.10

_OLD_EVENT_RE = re.compile(r"KXEARNINGSMENTION[A-Z]+-\d{2}[A-Z]{3}$")

# Temporal holdout boundary: the baseline calibration is fit only on markets
# closing before this date, then evaluated on both sides. Transcript coverage
# only starts around Sep 2025 and is sparse before 2026, so the split needs
# to sit inside the baselined window to leave enough training data.
DEFAULT_CUTOFF = "2026-07-01"


def paired_t(diffs: List[float]) -> Optional[float]:
    """t-statistic of the mean of `diffs` (paired per-trade differences).

    The comparison against a fixed-side benchmark runs over the same trades,
    so the samples are paired and the paired test is the right one — the
    unpaired variance of trade P&L is far larger and would hide a real effect.
    Returns None when there are too few trades or no variance to divide by.
    """
    n = len(diffs)
    if n < 2:
        return None
    mean = sum(diffs) / n
    var = sum((d - mean) ** 2 for d in diffs) / (n - 1)
    se = math.sqrt(var / n)
    return mean / se if se > 0 else None


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


_SUBTITLE_DATE_RE = re.compile(r"(?:On\s+)?([A-Z][a-z]{2}) (\d{1,2}), (\d{4})")


def sub_title_date(sub_title: Optional[str]) -> Optional[str]:
    """The earnings-call date Kalshi prints on the event, as YYYY-MM-DD.

    sub_title reads "On Oct 23, 2025" (sometimes without the "On"). It names
    the call itself. The event's `call_date` field does not always: it is
    derived from the event ticker's date code, and for the "-26JUN30" batch
    that code is the *contract* date, 110-154 days after the real call.
    Trusting call_date there put the answer inside the baseline — the
    transcript filter passed every call up to the contract date, which
    includes the call the market was predicting.
    """
    m = _SUBTITLE_DATE_RE.search(sub_title or "")
    if not m:
        return None
    try:
        return datetime.datetime.strptime(
            f"{m.group(1)} {m.group(2)} {m.group(3)}", "%b %d %Y").date().isoformat()
    except ValueError:
        return None


def load_call_dates(path: Path,
                    history: Optional[List[dict]] = None) -> Dict[str, str]:
    """event_ticker -> the date of the earnings call it prices.

    Neither field on the event is trustworthy on its own. For the "-26JUN30"
    batch both sub_title and call_date carry the *contract* date, up to five
    months after the market actually resolved — ACI-26JUN30 closed 2026-01-07
    while both fields say 2026-06-30.

    A market resolves immediately after the call it prices, so its close date
    bounds the call date from above. Taking min(printed date, earliest close)
    therefore keeps the printed date when it is right and falls back to the
    close when the printed date is the contract date. Erring earlier only ever
    drops a transcript the strategy could legitimately have used; erring later
    feeds it the answer.
    """
    out = {}
    for line in path.open():
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        et = ev.get("event_ticker")
        if not et:
            continue
        printed = sub_title_date(ev.get("sub_title")) or ev.get("call_date")
        if printed:
            out[et] = printed

    if history:
        closes: Dict[str, str] = {}
        for r in history:
            et = r.get("event_ticker")
            c = (r.get("close_time_iso") or "")[:10]
            if et and c and (et not in closes or c < closes[et]):
                closes[et] = c          # earliest close bounds the call date
        for et, c in closes.items():
            if et not in out or c < out[et]:
                out[et] = c
    return out


def simulate(history: List[dict], docs_by_ticker: Dict[str, List[dict]],
             call_dates: Dict[str, str], fee_rate: float,
             use_ask: bool, max_price: Optional[float] = None,
             presence: Optional[dict] = None,
             calibrator=None, collect: bool = False,
             lead: int = 24) -> tuple:
    """Tradable candidates + coverage counts. Side = the one whose edge
    (calibrated baseline vs its executable price: YES ask for YES, NO ask =
    1 − YES bid for NO) is positive and larger; trades with no positive edge
    on either side are skipped, and trades whose chosen side costs more than
    max_price are excluded. Threshold filtering happens in the sweep so one
    pass covers all thresholds. `lead` is the entry horizon: the price field
    used is price_{lead}h / yes_ask_{lead}h / yes_bid_{lead}h — the last
    traded hourly candle at or before close − lead. `calibrator` maps the
    raw baseline to a recalibrated probability before edges are computed.
    With `collect=True` the raw (p, result, close date) of every baselined
    market is returned as a third element so a calibrator can be fit on a
    date slice. `presence` serves word-presence vectors from the disk cache
    (pylib/word_presence) instead of rescanning transcript text."""
    trades: List[dict] = []
    candidates: List[tuple] = []
    coverage = {"n_history": len(history), "n_price": 0, "n_baseline": 0,
                "n_tradable": 0, "n_old_format": 0, "n_capped": 0}
    for r in history:
        price = r.get(f"price_{lead}h")
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
            ask = r.get(f"yes_ask_{lead}h")
            bid = r.get(f"yes_bid_{lead}h")
            if ask is not None:
                yes_cost = ask
            if bid is not None:
                no_cost = round(1.0 - bid, 2)

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
            # Liquidity at the entry lead, for the capacity model. Absent for
            # history rows fetched before the volume schema, hence .get().
            "vol_entry": r.get(f"vol_{lead}h"),
            "volcum": r.get(f"volcum_{lead}h"),
            "oi_entry": r.get(f"oi_{lead}h"),
            "fallback_entry": r.get(f"fallback_{lead}h"),
            # Kalshi's real taker schedule, charged win or lose, alongside the
            # flat winners-only model in pnl_net so both can be compared.
            "pnl_net_kalshi": net_per_contract(side, cost, r["result"],
                                               fee_model="taker"),
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


def capacity_view(trades: List[dict]) -> List[dict]:
    """Re-key the active lead's volume onto the names backtest/capacity.py
    budgets on (vol_24h / volcum_24h). Without this a --lead 48 run would feed
    the 48h window to a module that believes it is looking at 24h."""
    out = []
    for t in trades:
        c = dict(t)
        c["vol_24h"] = t.get("vol_entry")
        c["volcum_24h"] = t.get("volcum")
        out.append(c)
    return out


def _fillable(view: List[dict], size: float, model: str,
              participation: float) -> float:
    """Total contracts actually filled across `view` at order size `size`.

    Kept separate from capacity_curve (which reports dollars, not contracts)
    so the fill-rate column has a single definition: orders are capped at
    participation x flow, so nothing fills past the market's own traded size.
    """
    from backtest.capacity import fill_for_trade
    return sum(fill_for_trade(t, size, model=model,
                              participation=participation)["filled"]
               for t in view)


def build_capacity_rows(trades: List[dict], sizes: List[float], model: str,
                        participation: float, fee_model: str, fee_rate: float,
                        threshold: float = 0.10) -> List[dict]:
    """One row per position size, for the report's capacity table."""
    view = capacity_view(trades)
    selected = [t for t in view if abs(t.get("gap") or 0.0) >= threshold]
    rows = capacity_curve(view, sizes, model=model, participation=participation,
                          fee_model=fee_model, fee_rate=fee_rate,
                          threshold=threshold)
    for r in rows:
        want = len(selected) * r["size"]
        got = _fillable(selected, r["size"], model, participation)
        r["requested"] = want
        r["filled"] = got
        r["fill_pct"] = got / want if want else None
    return rows


def build_exec_rows(trades: List[dict], sizes: List[float], participation: float,
                    fee_model: str, fee_rate: float,
                    threshold: float = 0.10) -> List[dict]:
    """Worked vs taker side by side at a few sizes."""
    out = []
    for size in sizes:
        row = {"size": size}
        for model in ("worked", "taker"):
            r = build_capacity_rows(trades, [size], model, participation,
                                    fee_model, fee_rate, threshold)[0]
            row[model] = r
        out.append(row)
    return out


def build_validity_rows(trades: List[dict], size: float, participation: float,
                        fee_model: str, fee_rate: float,
                        threshold: float = 0.10) -> List[dict]:
    """P&L split by whether the entry price was a real trade or a stale
    carry-forward. A stale entry is a price nobody transacted at, so it is the
    honest place to look for the fill assumption doing the work."""
    sel = [t for t in trades if abs(t.get("gap") or 0.0) >= threshold]
    # A stale entry and a zero-volume entry are the same set by construction:
    # pick_price_at only falls back when the entry candle had no trade, and a
    # candle with no trade has no volume. One row, not two.
    groups = [
        ("genuinely traded", lambda t: t.get("fallback_entry") is False),
        ("stale carry-forward", lambda t: t.get("fallback_entry") is True),
        ("all", lambda t: True),
    ]
    view = capacity_view(sel)
    out = []
    for label, pred in groups:
        sub = [t for t in sel if pred(t)]
        if not sub:
            continue
        subview = [t for t in view if pred(t)]
        row = {"label": label, "n": len(sub),
               "wins": sum(1 for t in sub if t["win"]),
               "net_unlimited": sum(t["pnl_net"] for t in sub)}
        r = build_capacity_rows(subview, [size], "worked", participation,
                                fee_model, fee_rate, 0.0)[0]
        row.update({"net_capped": r["net"], "roi": r["roi"],
                    "fill_pct": r["fill_pct"]})
        out.append(row)
    return out


def build_fee_rows(trades: List[dict], thresholds: List[float]) -> List[dict]:
    """Flat 3%-of-profit vs Kalshi's real 7% taker fee, unlimited fill so the
    comparison is not confounded by capacity."""
    out = []
    for th in thresholds:
        sub = [t for t in trades if abs(t["gap"]) >= th]
        if not sub:
            continue
        flat = sum(t["pnl_net"] for t in sub)
        kalshi = sum(t["pnl_net_kalshi"] for t in sub)
        stake = sum(t["cost"] for t in sub)
        out.append({"threshold": th, "n": len(sub), "stake": stake,
                    "flat": flat, "kalshi": kalshi, "delta": kalshi - flat,
                    "roi_flat": flat / stake if stake else None,
                    "roi_kalshi": kalshi / stake if stake else None})
    return out


def render(trades: List[dict], coverage: dict, sweep_rows: List[dict],
           fee_rate: float, max_price: Optional[float] = None,
           cutoff_iso: str = DEFAULT_CUTOFF, cal_rows: Optional[List[dict]] = None,
           holdout: Optional[List[dict]] = None,
           split_cov: Optional[dict] = None,
           calibrate: bool = False,
           lead: int = 24,
           lead_rows: Optional[List[dict]] = None,
           capacity: Optional[dict] = None,
           basis_note: Optional[str] = None) -> str:
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
             f"baseline is compared to the executable price at the "
             f"{lead}h-before-close lead (the last traded hourly candle at or "
             f"before close − {lead}h; the YES ask/bid where orderbook data "
             f"exists). Bet the undervalued side: YES when baseline > YES "
             "price, NO when 1 − baseline > NO price; skip when neither side "
             "is undervalued; settle at the actual resolution. Gap = edge on "
             "the chosen side.",
             "",
             "The call date — the cutoff deciding which transcripts count — is "
             "the earlier of the date Kalshi prints on the event and the "
             "market's own close date. A market resolves immediately after the "
             "call it prices, so its close bounds the call from above. For the "
             "\"-26JUN30\" batch both printed fields carry the *contract* date, "
             "up to five months late, and trusting either one scored a quarter "
             "of the trades using a transcript of the very call the market was "
             "predicting. Erring earlier only drops a transcript the strategy "
             "could legitimately have used; erring later feeds it the answer.",
             "",
             "## Coverage",
             "",
             f"- {coverage['n_history']} finalized markets with history fetched",
             f"- {coverage['n_price']} with a price at the {lead}h lead "
             f"(close − {lead}h)",
             f"- {coverage['n_baseline']} with a transcript baseline (pre-event calls)",
             f"- {coverage['n_tradable']} tradable (both price and baseline)"]
    if max_price is not None:
        lines.append(f"- {coverage['n_capped']} excluded by the max-price cap")
    if basis_note:
        lines.append(f"- **entry-price basis: {basis_note}**")
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
                  "are fully out-of-sample. Edge vs NO is the net minus what "
                  "the same candidates return if every one of them is bet NO "
                  "regardless of the baseline — the bar any side selection has "
                  "to clear, and the one that decides whether the baseline is "
                  "adding information or just re-deriving the base rate. "
                  "t (edge) is the paired t-statistic of that difference — the "
                  "benchmark uses the same trades, so the comparison is "
                  "paired. |t| below about 2 means the edge is not "
                  "distinguishable from zero at this sample size, however "
                  "healthy the net looks.",
                  "",
                  "| Min \\|gap\\| | Split | Calibrated | Trades | Wins | "
                  "Win rate | Net | Always NO | Edge vs NO | t (edge) |",
                  "|---|---|---|---|---|---|---|---|---|---|"]
        for r in holdout:
            wr = f"{100 * r['wins'] / r['n']:.0f}%" if r["n"] else "-"
            # Always NO is the benchmark the side selection has to beat: the
            # same candidates at the same costs, bet NO unconditionally. Most
            # word markets resolve NO, so a strategy can post a healthy ROI
            # while adding nothing over that fixed side.
            no = r.get("net_no")
            no_s = f"{no:+.2f}" if no is not None else "-"
            edge = f"{r['net'] - no:+.2f}" if no is not None else "-"
            t = r.get("edge_t")
            t_s = f"{t:+.2f}" if t is not None else "-"
            lines.append(f"| {r['threshold']:.2f} | {r['split']} | "
                         f"{'yes' if r['calibrated'] else 'no'} | {r['n']} | "
                         f"{r['wins']} | {wr} | {r['net']:+.2f} | "
                         f"{no_s} | {edge} | {t_s} |")
        lines.append("")

    if lead_rows:
        lines += ["## Edge by entry time (raw baseline, min |gap| 0.10)",
                  "",
                  f"Same strategy entered at different horizons: at each lead "
                  f"the entry price is the last traded hourly candle at or "
                  f"before close − lead hours (markets that were not live or "
                  f"untraded that far out have no price and drop out — see "
                  f"With price). Train/test are the temporal split above "
                  f"(closing before/after {cutoff_iso}); test is "
                  "out-of-sample. The headline rows are lead 24h.",
                  "",
                  "| Lead (h) | With price | Tradable | Train trades | Train net | "
                  "Test trades | Test wins | Win rate | Test net |",
                  "|---|---|---|---|---|---|---|---|---|"]
        for r in lead_rows:
            star = "**" if r["lead"] == lead else ""
            wr = f"{100 * r['test_wins'] / r['test_n']:.0f}%" if r["test_n"] else "-"
            lines.append(f"| {star}{r['lead']}{star} | {r['n_price']} | "
                         f"{r['n_tradable']} | {r['train_n']} | "
                         f"{r['train_net']:+.2f} | {r['test_n']} | "
                         f"{r['test_wins']} | {wr} | {r['test_net']:+.2f} |")
        lines.append("")

    if capacity:
        def pct(v, digits=0):
            return f"{100 * v:.{digits}f}%" if v is not None else "-"

        crows = capacity["curve_rows"]
        lines += ["## Capacity",
                  "",
                  capacity["note"],
                  "",
                  "| Position N | Contracts wanted | Filled | Fill rate | Net | "
                  "ROI | Capital deployed | Avg slippage | Trades filled | "
                  "Partially filled |",
                  "|---|---|---|---|---|---|---|---|---|---|"]
        for r in crows:
            star = "**" if r["size"] == capacity["ref_size"] else ""
            lines.append(f"| {star}{r['size']:.0f}{star} | {r['requested']:.0f} | "
                         f"{r['filled']:.0f} | {pct(r['fill_pct'])} | "
                         f"{r['net']:+.2f} | {pct(r['roi'], 1)} | "
                         f"{r['capital']:.2f} | {r['avg_slippage']:+.3f} | "
                         f"{r['n_filled']} | {r['n_partial']} |")
        lines.append("")

        lines += ["## Execution model: worked vs taker",
                  "",
                  "**worked** rests a limit order at the entry price across the "
                  "whole entry-to-close window and is filled by the flow that "
                  "trades through it: the fill price is the posted price, so "
                  "slippage is zero and the only cost is unfilled size. "
                  "**taker** crosses the spread at entry, so only the entry "
                  "hour's flow is available and the ladder's VWAP sets the "
                  "cost. Worked is the headline; taker is the conservative "
                  "lower bound.",
                  "",
                  "| Position N | Worked fill | Worked net | Worked ROI | "
                  "Taker fill | Taker net | Taker ROI | Taker slippage |",
                  "|---|---|---|---|---|---|---|---|"]
        for r in capacity["exec_rows"]:
            w, t = r["worked"], r["taker"]
            lines.append(f"| {r['size']:.0f} | {pct(w['fill_pct'])} | "
                         f"{w['net']:+.2f} | {pct(w['roi'], 1)} | "
                         f"{pct(t['fill_pct'])} | {t['net']:+.2f} | "
                         f"{pct(t['roi'], 1)} | {t['avg_slippage']:+.3f} |")
        lines.append("")

        if capacity["validity_rows"]:
            n_ref = capacity["validity_size"]
            lines += ["## Execution validity",
                      "",
                      "The entry price is the last traded hourly candle at or "
                      "before the entry lead; where that candle never traded it "
                      "falls back to an older close (up to "
                      "36h stale). A stale entry is a price nobody transacted "
                      "at, so this split shows how much of the headline rests "
                      "on the fill assumption rather than on a real quote. "
                      f"Net @N={n_ref:.0f} is the worked model at a "
                      f"{100 * capacity['participation']:.0f}% participation rate.",
                      "",
                      "| Entry | Trades | Wins | Net (unlimited) | "
                      f"Net @N={n_ref:.0f} | ROI | Fill rate |",
                      "|---|---|---|---|---|---|---|"]
            for r in capacity["validity_rows"]:
                lines.append(f"| {r['label']} | {r['n']} | {r['wins']} | "
                             f"{r['net_unlimited']:+.2f} | {r['net_capped']:+.2f} | "
                             f"{pct(r['roi'], 1)} | {pct(r['fill_pct'])} |")
            lines.append("")

        lines += ["## Fees: flat 3% of profit vs Kalshi 0.07·C·P·(1−P)",
                  "",
                  "The flat model charges only winners; Kalshi's taker schedule "
                  "charges every fill, losers included, and is rounded up to the "
                  "cent per order. Unlimited fill, so the fee effect is not "
                  "confounded with capacity.",
                  "",
                  "| Min \\|gap\\| | Trades | Stake | Net (flat 3%) | "
                  "Net (Kalshi 7%) | Delta | ROI (flat) | ROI (Kalshi) |",
                  "|---|---|---|---|---|---|---|---|"]
        for r in capacity["fee_rows"]:
            lines.append(f"| {r['threshold']:.2f} | {r['n']} | {r['stake']:.2f} | "
                         f"{r['flat']:+.2f} | {r['kalshi']:+.2f} | "
                         f"{r['delta']:+.2f} | {pct(r['roi_flat'], 1)} | "
                         f"{pct(r['roi_kalshi'], 1)} |")
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
                    help="Trade at the ask/bid at the entry lead instead of last trade")
    ap.add_argument("--lead", type=int, default=24,
                    help="Entry horizon in hours before close (uses the "
                         "price_{lead}h fields from the history file)")
    ap.add_argument("--traded-only", action="store_true",
                    help="Restrict to entries whose price came from a candle "
                         "that actually traded within the lead, dropping the "
                         "carry-forward prices nobody transacted at. Halves "
                         "the headline P&L, because roughly half of the "
                         "default set's entries are carry-forwards")
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
    ap.add_argument("--capacity", action="store_true",
                    help="Add the order-depth capacity sections. Needs the "
                         "volume/OI fields in the history file (the fetcher "
                         "backfills them in place); without them every trade "
                         "reports zero fillable size")
    ap.add_argument("--participation", type=float, default=PARTICIPATION,
                    help="Share of observed flow our own orders capture "
                         f"(default {PARTICIPATION}). Not a fitted parameter — "
                         "nothing in this repo pins it down")
    ap.add_argument("--fee-model", choices=("flat", "kalshi"), default="flat",
                    help="Fee model used for the capacity sections (default: "
                         "flat, matching the headline sweep)")
    args = ap.parse_args()

    history = load_history(args.history)
    if args.traded_only:
        before = len(history)
        # `is False`, not falsy: a row carrying no flag has unknown provenance
        # (fetched before the flag existed) and is dropped rather than assumed
        # good. pick_price_at sets fallback=True exactly when the entry
        # candle's own close was absent, i.e. when it carried a previous close
        # forward. Checked against 5,598 markets x 10 leads: fallback=True
        # holds iff the entry candle's volume is 0, with no counterexamples —
        # so this predicate is precisely "a trade actually printed here".
        history = [r for r in history
                   if r.get(f"fallback_{args.lead}h") is False]
        print(f"traded-only: {len(history)}/{before} markets kept, "
              f"{before - len(history)} dropped for a carry-forward "
              f"{args.lead}h entry price", flush=True)
    basis_note = (
        f"restricted to the {len(history)} markets whose {args.lead}h entry "
        "price came from a candle that actually traded — a real print, not a "
        "carried-forward close. Everything below, including the coverage "
        "counts and the holdout, is computed on this basis only, so the "
        "Execution-validity split is degenerate by construction"
        if args.traded_only else None)
    docs_by_ticker = load_transcripts()
    call_dates = load_call_dates(MENTIONS, history)
    presence = load_presence()

    # Pass 1: gather every baselined market (raw p + outcome + close date) so
    # the calibrator can be fit on the pre-cutoff slice only.
    _, _, candidates = simulate(history, docs_by_ticker, call_dates,
                                args.fee_rate, args.use_ask, args.max_price,
                                presence=presence, collect=True,
                                lead=args.lead)
    train_cand = [c for c in candidates if c[2] and c[2] < args.cutoff]
    calibrator = fit_isotonic([c[0] for c in train_cand],
                              [1 if c[1] == "yes" else 0 for c in train_cand])

    trades, coverage = simulate(history, docs_by_ticker, call_dates,
                                args.fee_rate, args.use_ask, args.max_price,
                                presence=presence,
                                calibrator=calibrator if args.calibrate else None,
                                lead=args.lead)
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
                                   args.use_ask, args.max_price, presence=presence,
                                   lead=args.lead)
        tr_cal, cov_cal = simulate(h, docs_by_ticker, call_dates, args.fee_rate,
                                   args.use_ask, args.max_price, presence=presence,
                                   calibrator=calibrator, lead=args.lead)
        split_cov[name] = (cov_raw, cov_cal)
        for cal_on, tr in ((False, tr_raw), (True, tr_cal)):
            for th in SWEEP_THRESHOLDS:
                sub = [x for x in tr if abs(x["gap"]) >= th]
                holdout.append({"threshold": th, "split": name,
                                "calibrated": cal_on, "n": len(sub),
                                "wins": sum(1 for x in sub if x["win"]),
                                "net": sum(x["pnl_net"] for x in sub),
                                "net_yes": sum(x["net_yes"] for x in sub),
                                "net_no": sum(x["net_no"] for x in sub),
                                "edge_t": paired_t([x["pnl_net"] - x["net_no"]
                                                    for x in sub])})

    # Edge-by-entry-time sweep: same raw strategy at every lead present in
    # the history file, so the report shows where in time the edge lives.
    lead_rows = []
    leads = sorted({int(k[len("price_"):-1]) for r in history
                    for k in r if k.startswith("price_") and k.endswith("h")})
    for ld in leads:
        tr_all, cov_all = simulate(history, docs_by_ticker, call_dates,
                                   args.fee_rate, args.use_ask, args.max_price,
                                   presence=presence, lead=ld)
        tr_tr, _ = simulate(hist_train, docs_by_ticker, call_dates,
                            args.fee_rate, args.use_ask, args.max_price,
                            presence=presence, lead=ld)
        tr_te, _ = simulate(hist_test, docs_by_ticker, call_dates,
                            args.fee_rate, args.use_ask, args.max_price,
                            presence=presence, lead=ld)

        def agg(t):
            s = [x for x in t if abs(x["gap"]) >= 0.10]
            return (len(s), sum(1 for x in s if x["win"]),
                    sum(x["pnl_net"] for x in s))

        tn, tw, tnet = agg(tr_tr)
        en, ew, enet = agg(tr_te)
        lead_rows.append({"lead": ld, "n_price": cov_all["n_price"],
                          "n_tradable": cov_all["n_tradable"],
                          "train_n": tn, "train_net": tnet,
                          "test_n": en, "test_wins": ew, "test_net": enet})

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

    cap = None
    if args.capacity:
        sel = [t for t in trades if abs(t["gap"]) >= CAPACITY_THRESHOLD]
        n_novol = sum(1 for t in sel if not t.get("volcum"))
        pct_novol = 100 * n_novol / len(sel) if sel else 0.0
        # Under --traded-only every entry is a genuine print, so the
        # traded-vs-stale split has one non-empty group and says nothing.
        validity = ([] if args.traded_only else
                    build_validity_rows(trades, VALIDITY_SIZE,
                                        args.participation, args.fee_model,
                                        args.fee_rate, CAPACITY_THRESHOLD))
        curve = build_capacity_rows(trades, CAPACITY_SIZES, "worked",
                                    args.participation, args.fee_model,
                                    args.fee_rate, CAPACITY_THRESHOLD)
        roi_small, roi_big = curve[0]["roi"], curve[-1]["roi"]
        stale_pct = 100 * sum(1 for t in sel
                              if t.get("fallback_entry")) / max(len(sel), 1)
        if args.traded_only:
            # The worked model's blind spot is directional, not just a matter
            # of stale prices: it cannot tell a fill that happened because the
            # market moved toward the quote from one that happened because it
            # moved away. Restricting to real prints removes the worst
            # amplification of that, but not the skew itself.
            stale_clause = (
                "see. This basis removes the largest amplification of it — "
                "every entry here is a price that actually traded, so a fill "
                "at the posted price is at least a fill at a real price — but "
                "the directional skew is untouched: the model still cannot "
                "distinguish a fill that happened because the market moved "
                "toward the quote from one that happened because it moved away.")
        else:
            stale_clause = (
                f"see, and that effect is largest exactly where it matters "
                f"most: {stale_pct:.0f}% of these entries are stale "
                f"carry-forwards, i.e. prices nobody traded at.")
        note = (
            f"Fillable size is capped at **{100 * args.participation:.0f}% of "
            f"the market's own traded volume**. Depth is bounded by *flow* "
            f"rather than by a modelled book because the entry-time book is "
            f"not observable: at the 24h lead the entry hour never traded at "
            f"all for most of these markets, so any resting depth quoted there "
            f"would be invented. The worked model spends the volume traded "
            f"between entry and close; the taker model only the entry hour. "
            f"Participation is a flag, not a fitted parameter — nothing in "
            f"this repo pins it down. {n_novol} of {len(sel)} "
            f"({pct_novol:.0f}%) of these trades saw no volume at all between "
            f"entry and close and never fill under any size.\n\n"
            f"**The worked model is the optimistic bound, not a forecast.** It "
            f"fills at the posted price no matter which way the market moved, "
            f"but a resting order is filled precisely when someone chooses to "
            f"trade against it — flow dries up when the price moves away from "
            f"your quote and arrives when it moves through it. Real fills "
            f"therefore skew toward the losing side in a way this model cannot "
            f"{stale_clause} Read the worked column as \"is there enough flow?\" "
            f"(yes, comfortably) and the taker column as \"what if the order "
            f"has to cross?\" (it collapses). The taker slippage uses the "
            f"*shape* of live books captured around earnings calls — call-time "
            f"is the most liquid moment, so those depths are an upper bound on "
            f"entry-regime depth and the taker fill rates are the optimistic "
            f"end of that assumption.\n\n"
            f"**ROI rises slightly with size rather than decaying** "
            f"({100 * roi_small:.1f}% at N={CAPACITY_SIZES[0]:.0f} to "
            f"{100 * roi_big:.1f}% at N={CAPACITY_SIZES[-1]:.0f}). That is "
            f"compositional, not extra edge: the participation cap bites "
            f"hardest on low-volume markets, so a larger order concentrates "
            f"its fill on high-volume markets — which are also the ones whose "
            f"entry price was genuinely traded rather than stale, and those "
            f"carry the higher ROI. The curve is bounded by the capital the "
            f"universe can absorb, not by the edge decaying."
        )
        cap = {
            "note": note,
            "curve_rows": curve,
            "exec_rows": build_exec_rows(
                trades, CAPACITY_EXEC_SIZES, args.participation,
                args.fee_model, args.fee_rate, CAPACITY_THRESHOLD),
            "validity_rows": validity,
            "fee_rows": build_fee_rows(trades, SWEEP_THRESHOLDS),
            "ref_size": CAPACITY_REF_SIZE,
            "validity_size": VALIDITY_SIZE,
            "participation": args.participation,
        }

    text = render(trades, coverage, rows, args.fee_rate, args.max_price,
                  cutoff_iso=args.cutoff, cal_rows=cal_rows,
                  holdout=holdout, split_cov=split_cov,
                  calibrate=args.calibrate, lead=args.lead,
                  lead_rows=lead_rows, capacity=cap, basis_note=basis_note)
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
    if cap:
        print(f"capacity (worked, participation {100 * args.participation:.0f}%, "
              f"fee {args.fee_model}):")
        for r in cap["curve_rows"]:
            roi = f"{100 * r['roi']:+.1f}%" if r["roi"] is not None else "-"
            print(f"  N={r['size']:>4.0f}: filled {r['filled']:8.0f} / "
                  f"{r['requested']:.0f} ({100 * r['fill_pct']:5.1f}%), "
                  f"net {r['net']:+8.2f}, ROI {roi}")


if __name__ == "__main__":
    main()
