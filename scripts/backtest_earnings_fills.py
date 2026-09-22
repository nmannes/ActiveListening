#!/usr/bin/env python
"""
backtest_earnings_fills.py — Would the earnings gap strategy have been
profitable at prices that would actually have filled?

The sibling report (scripts/backtest_earnings_report.py) prices entries off the
last *traded* price, and 58% of its 24h entries are carry-forwards from an hour
that never traded — prices nobody transacted at. It then has to model the fill
with a capacity curve, because a resting limit order is filled only by flow the
candle data can see in aggregate, and that flow arrives precisely when the
market moves through your quote (i.e. toward the losing side).

This backtest removes that entire problem by assuming the order *crosses the
spread*:

    YES costs the candle's yes_ask
    NO  costs 1 − yes_bid

A taker order pays the posted price or it does not go through: no queue, no
fill-probability model, no assumption about which way the market then moves.
The entry price is the fill price. What is left is one question — with the
spread paid, is the transcript baseline still worth betting on?

Crossing still needs a counterparty, so the headline basis keeps only entries
whose candle actually traded (`vol_<lead>h > 0`): a print in that hour is
evidence the market was alive at entry. The same sweep over every entry with a
live two-sided quote is reported alongside as the optimistic bound, since
~27% of the quotes on untraded candles look carried forward.

Fees default to Kalshi's taker schedule, 0.07·C·P·(1−P) rounded up to the cent
per order — crossing makes you a taker, so this is what you would really have
paid, and it is charged on losers as well as winners. The flat 3%-of-profit
model is carried alongside because that is what the sibling report headlines.

The report also answers the question the headline invites: how much of the
result is the word and how much is the price level? YES in this universe is
rich — the realized rate trails the quoted mid in every price band — so the
report computes the always-YES / always-NO benchmarks that the side selection
has to beat, rather than leaving the reader to infer an edge from a net.

Output: stdout summary + earnings-backtest-fills.md

Usage:
    PYTHONPATH=. python scripts/backtest_earnings_fills.py
    PYTHONPATH=. python scripts/backtest_earnings_fills.py --lead 6 --max-price 0.30
"""

import argparse
import itertools
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.backtest_earnings_report import (  # noqa: E402
    DEFAULT_CUTOFF,
    HISTORY_FILE,
    MENTIONS,
    load_call_dates,
    load_history,
    paired_t,
    pnl,
)
from scripts.generate_earnings_report import (  # noqa: E402
    load_transcripts,
    pre_event_docs,
    word_baseline,
)
from pylib.word_presence import load_presence, save_presence  # noqa: E402
from backtest.capacity import (  # noqa: E402
    PARTICIPATION,
    capacity_curve,
    fill_for_trade,
    net_per_contract,
)

ROOT = Path(__file__).resolve().parent.parent
OUT_REPORT = ROOT / "earnings-backtest-fills.md"

SWEEP_THRESHOLDS = [0.00, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30]
DEFAULT_LEAD = 24
CAPACITY_THRESHOLD = 0.10
CAPACITY_SIZES = [1, 10, 25, 50, 100, 250, 500, 1000]

# Price bands for the calibration table. The edges are where the mispricing
# actually lives, not deciles: the middle of the book is where the quoted mid
# runs furthest above the realized rate.
BANDS = [(0.00, 0.20), (0.20, 0.40), (0.40, 0.60), (0.60, 0.80), (0.80, 1.01)]


def entry_quote(row: dict, lead: int) -> Optional[Tuple[float, float]]:
    """(yes_ask, yes_bid) for the candle at close − lead, or None if the
    market had no usable two-sided quote there.

    ask == 0 and a missing side are both "no quote": Kalshi reports a zero
    price when a side of the book is empty, and you cannot buy YES from
    nobody. An inverted book (ask < bid) is dropped rather than arbitraged —
    it does not occur in this corpus and its presence would mean the candle
    fields are not what this module assumes.
    """
    ask = row.get(f"yes_ask_{lead}h")
    bid = row.get(f"yes_bid_{lead}h")
    if ask is None or bid is None:
        return None
    try:
        ask = float(ask)
        bid = float(bid)
    except (TypeError, ValueError):
        return None
    if not 0.0 < ask <= 1.0 or not 0.0 <= bid < 1.0:
        return None
    if ask < bid:
        return None
    return ask, bid


def entry_volume(row: dict, lead: int) -> float:
    """Contracts traded in the entry candle, 0.0 when unknown.

    Unknown volume (rows fetched before the liquidity schema, or a market the
    candlestick endpoint returns no volume for) counts as zero here: the
    headline basis is "a counterparty demonstrably traded in this hour", and
    absent data is not evidence of that.
    """
    return float(row.get(f"vol_{lead}h") or 0.0)


def pnl_suite(side: str, cost: float, result: str, fee_rate: float) -> dict:
    """Per-contract P&L under both fee models.

    net is the flat winners-only model the sibling report headlines; net_kalshi
    is Kalshi's real taker schedule, which charges every fill including losing
    ones. Both are kept on every trade because the headline basis crosses the
    spread, which makes the taker schedule the honest default — the flat column
    is there to show how much of the sibling report's net was the fee
    assumption.
    """
    gross, net_flat = pnl(side, cost, result, fee_rate)
    return {
        "gross": gross,
        "net_flat": net_flat,
        "net_kalshi": net_per_contract(side, cost, result, fee_model="taker"),
    }


def fixed_side_nets(yes_cost: float, no_cost: float, result: str,
                    fee_rate: float) -> dict:
    """Per-contract net for both fixed sides under both fee models.

    The Always-YES / Always-NO benchmarks are only comparable to the headline
    if they are charged the same fee, so each side carries both. Charging them
    the flat winners-only fee while the headline paid the taker schedule would
    hand the benchmark a discount and shrink the edge the strategy claims.
    """
    out = {}
    for side, cost in (("YES", yes_cost), ("NO", no_cost)):
        _, flat = pnl(side, cost, result, fee_rate)
        out[side] = {"flat": flat,
                     "kalshi": net_per_contract(side, cost, result,
                                                fee_model="taker")}
    return out


def simulate(history: List[dict], docs_by_ticker: Dict[str, List[dict]],
             call_dates: Dict[str, str], lead: int, presence: dict,
             require_traded: bool = True, fee_rate: float = 0.03,
             max_price: Optional[float] = None,
             collect: bool = False) -> tuple:
    """Tradable candidates + coverage counts for one entry basis.

    Per market: read the executable quote at close − lead, keep it only if the
    entry candle traded (when `require_traded`), compute the transcript
    baseline P from pre-event calls only, then bet the side whose edge against
    its executable price is positive and larger — YES at the ask, NO at
    1 − bid. Trades with no positive edge on either side are skipped; the
    caller applies the |gap| threshold. `collect=True` returns the raw
    (P, result, close date) of every baselined market as a third element.

    Coverage is counted on this basis alone, so a `require_traded=False` run
    reports the wider universe rather than a subset of it.
    """
    trades: List[dict] = []
    candidates: List[tuple] = []
    coverage = {"n_history": len(history), "n_quote": 0, "n_traded": 0,
                "n_baseline": 0, "n_tradable": 0, "n_capped": 0,
                "n_no_result": 0}
    for r in history:
        quote = entry_quote(r, lead)
        if quote is None:
            continue
        coverage["n_quote"] += 1
        ask, bid = quote
        vol = entry_volume(r, lead)
        traded = vol > 0
        if traded:
            coverage["n_traded"] += 1
        if require_traded and not traded:
            continue

        result = r.get("result")
        if result not in ("yes", "no"):
            coverage["n_no_result"] += 1
            continue

        full_docs = docs_by_ticker.get(r["code"], [])
        ev_date = call_dates.get(r.get("event_ticker") or "")
        if not ev_date:
            continue
        docs = pre_event_docs(full_docs, ev_date)
        if not docs:
            continue
        present_in, n_prior, said_last, p = word_baseline(
            r["word"], docs, code=r["code"], presence=presence,
            full_docs=full_docs)
        if p is None:
            continue
        coverage["n_baseline"] += 1
        if collect:
            candidates.append((p, result, (r.get("close_time_iso") or "")[:10]))

        # Executable prices: you buy YES at the ask, and buying NO is selling
        # YES at the bid, so the NO price is 1 − bid.
        yes_cost = ask
        no_cost = round(1.0 - bid, 2)
        if no_cost <= 0.0:
            continue                     # a free NO: quote is not trustworthy
        edge_yes = p - yes_cost
        edge_no = (1.0 - p) - no_cost
        side = "YES" if edge_yes >= edge_no else "NO"
        gap = edge_yes if side == "YES" else edge_no
        cost = yes_cost if side == "YES" else no_cost
        if gap <= 0:
            continue                     # neither side undervalued at the quote
        if max_price is not None and cost > max_price:
            coverage["n_capped"] += 1
            continue

        p_pnl = pnl_suite(side, cost, result, fee_rate)
        trades.append({
            "ticker": r["ticker"], "code": r["code"], "word": r["word"],
            "event_date": ev_date, "close_time_iso": r.get("close_time_iso"),
            "baseline": p, "side": side, "gap": gap, "cost": cost,
            "ask": yes_cost, "bid": bid, "spread": round(yes_cost - bid, 2),
            "result": result, "win": p_pnl["gross"] > 0,
            "pnl_gross": p_pnl["gross"],
            "pnl_net_flat": p_pnl["net_flat"],
            "pnl_net_kalshi": p_pnl["net_kalshi"],
            "fixed": fixed_side_nets(yes_cost, no_cost, result, fee_rate),
            "present_in": present_in, "n_prior": n_prior,
            "said_last": said_last, "traded": traded,
            # Liquidity at the entry lead, for the capacity model. `vol_entry`
            # is re-keyed to `vol_24h` by capacity_view() so the model sees the
            # active lead's window regardless of --lead.
            "vol_entry": vol, "volcum": r.get(f"volcum_{lead}h"),
        })
    coverage["n_tradable"] = len(trades)
    if collect:
        return trades, coverage, candidates
    return trades, coverage


def headline_net(trade: dict, fee_model: str) -> float:
    """The trade's net under the chosen headline fee model."""
    return trade["pnl_net_kalshi" if fee_model == "kalshi" else "pnl_net_flat"]


def fixed_side_net(trade: dict, side: str, fee_model: str) -> float:
    """Net if this candidate were bet `side` regardless of the baseline,
    charged the same fee as the headline."""
    key = "kalshi" if fee_model == "kalshi" else "flat"
    return trade["fixed"][side][key]


def sweep(trades: List[dict], thresholds: List[float],
          fee_model: str = "kalshi") -> List[dict]:
    """One row per |gap| threshold, with the fixed-side benchmarks.

    net_yes / net_no are what the *same candidates* return if every one of
    them is bet on one fixed side. Always-NO is the bar that matters: most of
    this universe resolves NO while the quoted mid runs above the realized
    rate, so a strategy can post a healthy net without the baseline adding
    anything. edge_t is the paired t-statistic of that difference.
    """
    rows = []
    for t in thresholds:
        sub = [x for x in trades if abs(x["gap"]) >= t]
        n = len(sub)
        if not n:
            rows.append({"threshold": t, "n": 0})
            continue
        net = sum(headline_net(x, fee_model) for x in sub)
        net_no = sum(fixed_side_net(x, "NO", fee_model) for x in sub)
        net_yes = sum(fixed_side_net(x, "YES", fee_model) for x in sub)
        by_side = {}
        for side in ("YES", "NO"):
            s = [x for x in sub if x["side"] == side]
            by_side[side] = (len(s), sum(1 for x in s if x["win"]),
                             sum(headline_net(x, fee_model) for x in s))
        rows.append({
            "threshold": t, "n": n,
            "wins": sum(1 for x in sub if x["win"]),
            "gross": sum(x["pnl_gross"] for x in sub),
            "net": net,
            "net_flat": sum(x["pnl_net_flat"] for x in sub),
            "net_kalshi": sum(x["pnl_net_kalshi"] for x in sub),
            "stake": sum(x["cost"] for x in sub),
            "by_side": by_side,
            "net_yes": net_yes,
            "net_no": net_no,
            "edge_no": net - net_no,
            "edge_t": paired_t([headline_net(x, fee_model)
                                - fixed_side_net(x, "NO", fee_model)
                                for x in sub]),
        })
    return rows


def calibration_rows(rows: List[dict], lead: int) -> List[dict]:
    """Quoted price vs realized outcome per price band.

    This is the aggregate answer to "is YES overpriced", and it is deliberately
    not the strategy's P&L: the realized rate trailing the mid in every band
    means buying YES at the quote and selling it (buying NO) are not symmetric
    bets, whatever the transcript baseline says. Banded on the mid so the band
    membership does not depend on which side you would have taken.
    """
    buckets = defaultdict(lambda: {"n": 0, "yes": 0, "ask": 0.0, "bid": 0.0})
    for r in rows:
        q = entry_quote(r, lead)
        if q is None or r.get("result") not in ("yes", "no"):
            continue
        if entry_volume(r, lead) <= 0:
            continue
        ask, bid = q
        mid = (ask + bid) / 2.0
        for lo, hi in BANDS:
            if lo <= mid < hi:
                b = buckets[(lo, hi)]
                b["n"] += 1
                b["yes"] += r["result"] == "yes"
                b["ask"] += ask
                b["bid"] += bid
                break
    out = []
    for (lo, hi) in BANDS:
        b = buckets.get((lo, hi))
        if not b or not b["n"]:
            continue
        n = b["n"]
        out.append({
            "band": f"{lo:.2f}–{min(hi, 1.0):.2f}", "n": n,
            "realized": b["yes"] / n, "ask": b["ask"] / n, "bid": b["bid"] / n,
            "mid": (b["ask"] + b["bid"]) / (2 * n),
        })
    return out


def benchmark_rows(rows: List[dict], leads: List[int]) -> List[dict]:
    """Unconditional fixed-side P&L at each lead, over every tradable market.

    The companion to calibration: it prices "buy YES at the ask" and "buy NO
    at 1 − bid" on the whole traded universe, with no baseline and no side
    selection, so the strategy's headline can be read net of the price level.
    """
    out = []
    for lead in leads:
        n = 0
        n_yes = 0
        tot_ask = tot_bid = 0.0
        yes_at_ask = no_at_bid = 0.0
        for r in rows:
            q = entry_quote(r, lead)
            result = r.get("result")
            if q is None or result not in ("yes", "no"):
                continue
            if entry_volume(r, lead) <= 0:
                continue
            ask, bid = q
            n += 1
            n_yes += result == "yes"
            tot_ask += ask
            tot_bid += bid
            yes_at_ask += net_per_contract("YES", ask, result,
                                           fee_model="taker")
            no_at_bid += net_per_contract("NO", round(1.0 - bid, 2), result,
                                          fee_model="taker")
        if n:
            out.append({"lead": lead, "n": n, "mean_ask": tot_ask / n,
                        "mean_bid": tot_bid / n, "realized": n_yes / n,
                        "yes_net": yes_at_ask / n, "no_net": no_at_bid / n})
    return out


def capacity_view(trades: List[dict]) -> List[dict]:
    """Re-key the active lead's volume onto the names backtest/capacity.py
    budgets on (vol_24h). Without this a --lead 6 run would feed the 6h window
    to a module that believes it is looking at 24h."""
    out = []
    for t in trades:
        c = dict(t)
        c["vol_24h"] = t.get("vol_entry")
        out.append(c)
    return out


def render(trades: List[dict], coverage: dict, rows: List[dict],
           optimistic: Optional[dict] = None, lead_rows: Optional[List[dict]] = None,
           cal_rows: Optional[List[dict]] = None,
           bench_rows: Optional[List[dict]] = None,
           split_rows: Optional[List[dict]] = None,
           cap_rows: Optional[List[dict]] = None,
           lead: int = DEFAULT_LEAD, fee_rate: float = 0.03,
           fee_model: str = "kalshi", cutoff: str = DEFAULT_CUTOFF,
           participation: float = PARTICIPATION,
           max_price: Optional[float] = None) -> str:
    if fee_model == "kalshi":
        fee_line = ("fee: Kalshi's taker schedule, 0.07·C·P·(1−P) rounded up to "
                    "the cent per order, charged win or lose")
    else:
        fee_line = f"fee: {100 * fee_rate:.0f}% of profit, winners only"

    lines = [
        "# Earnings Backtest — Fillable Prices",
        "",
        f"Generated {date.today().isoformat()}",
        "",
        "## What this tests",
        "",
        "For each finalized word market: a transcript baseline P is computed "
        "from calls before the event, then compared against the prices a "
        "**taker order would have paid** at close − "
        f"{lead}h — buying YES costs the candle's `yes_ask`, buying NO costs "
        "`1 − yes_bid`. Bet the undervalued side (YES when P > ask, NO when "
        "1 − P > 1 − bid); skip when neither side is undervalued; settle at "
        "the actual resolution. Entry price *is* fill price: a market order "
        "pays the posted price or it does not go through, so there is no "
        "queue, no fill model, and no assumption about which way the price "
        "then moved.",
        "",
        "The headline basis keeps only entries whose candle **actually "
        "traded** (`vol > 0`) — a print in that hour is evidence the market "
        "was alive at entry. The optimistic bound repeats the sweep over "
        "every entry with a live two-sided quote, untraded candles included; "
        "those quotes are often carried forward and are not evidence anyone "
        "would have taken the other side.",
        "",
        f"- {fee_line}",
        "- The flat 3%-of-profit model is shown next to it, because that is "
        "what `earnings-backtest.md` headlines and the two are not "
        "comparable net of nothing.",
        "- Prices are the candle's closing quote, one per hour. A fill inside "
        "the hour could have been better or worse.",
        "- Depth is not modelled in the headline. A capacity section bounds "
        "size by the entry hour's traded volume, which is the only flow "
        "measure the historical candles expose.",
        "",
        "## Coverage",
        "",
        f"- {coverage['n_history']} finalized markets in the history file",
        f"- {coverage['n_quote']} with a live two-sided quote at the "
        f"{lead}h lead",
        f"- {coverage['n_traded']} of those whose entry candle actually traded",
        f"- {coverage['n_baseline']} with a transcript baseline (pre-event "
        "calls) on this basis",
        f"- **{coverage['n_tradable']} tradable** (quote, baseline, and an "
        "undervalued side)",
    ]
    if max_price is not None:
        lines.append(f"- entries capped at {max_price:.2f} per contract")
    if coverage["n_capped"]:
        lines.append(f"- {coverage['n_capped']} excluded by the max-price cap")
    if coverage["n_no_result"]:
        lines.append(f"- {coverage['n_no_result']} skipped: no yes/no "
                     "resolution on record")
    lines.append("")

    lines += [
        "## Headline (traded entry candle, min |gap| sweep)",
        "",
        "Net at the executable price. The YES and NO columns split it by side; "
        "**Always NO** re-bets the same candidates NO regardless of the "
        "baseline, which is the bar the side selection has to clear — most of "
        "this universe resolves NO and YES is quoted rich, so a positive net "
        "is not by itself evidence the word predicts anything. Edge vs NO is "
        "net − Always NO and t is its paired t-statistic: |t| below about 2 "
        "means the edge is indistinguishable from zero at this sample size.",
        "",
        f"| Min \\|gap\\| | Trades | Wins | Win rate | Gross | Net | Net (flat) "
        f"| ROI | YES (n/net) | NO (n/net) | Always YES | Always NO | "
        f"Edge vs NO | t |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rows:
        if not r.get("n"):
            continue
        wr = f"{100 * r['wins'] / r['n']:.0f}%"
        roi = r["net"] / r["stake"] if r["stake"] else None
        roi_s = f"{100 * roi:.1f}%" if roi is not None else "-"
        y, no = r["by_side"]["YES"], r["by_side"]["NO"]
        t = r["edge_t"]
        t_s = f"{t:+.2f}" if t is not None else "-"
        lines.append(
            f"| {r['threshold']:.2f} | {r['n']} | {r['wins']} | {wr} | "
            f"{r['gross']:+.2f} | {r['net']:+.2f} | {r['net_flat']:+.2f} | "
            f"{roi_s} | {y[0]} / {y[2]:+.2f} | {no[0]} / {no[2]:+.2f} | "
            f"{r['net_yes']:+.2f} | {r['net_no']:+.2f} | {r['edge_no']:+.2f} | "
            f"{t_s} |")
    lines.append("")

    if cal_rows:
        lines += [
            "## Is YES overpriced?",
            "",
            "Realized resolution rate against the quoted price, by price band, "
            "on the headline basis at this lead. If the mid equalled the "
            "realized rate the two fixed-side benchmarks below would each sit "
            "at minus their own half of the spread — you pay the quote going "
            "in and it is worth its mid going out — so both would be negative, "
            "equal, and driven only by the spread and the fee. Where the mid "
            "runs above realized, YES is rich by that margin and a NO bet "
            "starts with a tailwind it did not earn from the transcript: the "
            "gap between the two benchmark columns below is exactly "
            "2 × (mid − realized). This is a property of the *price*, not of "
            "the strategy, and it is why the headline table needs the "
            "Always-NO column.",
            "",
            "| Mid band | n | Realized YES | Mean ask | Mean bid | Mean mid | "
            "Mid − realized |",
            "|---|---|---|---|---|---|---|",
        ]
        for r in cal_rows:
            lines.append(
                f"| {r['band']} | {r['n']} | {100 * r['realized']:.1f}% | "
                f"{r['ask']:.3f} | {r['bid']:.3f} | {r['mid']:.3f} | "
                f"{100 * (r['mid'] - r['realized']):+.1f}¢ |")
        lines.append("")

    if bench_rows:
        lines += [
            "The same price-level question asked as a trade rather than as a "
            "table: buy YES at the ask on every market, or buy NO at 1 − bid "
            "on every market, with no baseline and no side selection. Per "
            "contract, Kalshi taker fee included. This is what the quote "
            "alone pays, and it is the number the strategy's net has to beat "
            "by more than noise to have found anything the price had not "
            "already put there.",
            "",
            "| Lead | n | Realized YES | Mean ask | Mean mid | Always YES "
            "(net/contract) | Always NO (net/contract) |",
            "|---|---|---|---|---|---|---|",
        ]
        for r in bench_rows:
            star = "**" if r["lead"] == lead else ""
            lines.append(
                f"| {star}{r['lead']}{star} | {r['n']} | "
                f"{100 * r['realized']:.1f}% | {r['mean_ask']:.3f} | "
                f"{(r['mean_ask'] + r['mean_bid']) / 2:.3f} | "
                f"{r['yes_net']:+.3f} | {r['no_net']:+.3f} |")
        lines.append("")

    if optimistic:
        o_rows, o_cov = optimistic["rows"], optimistic["coverage"]
        lines += [
            "## Optimistic bound (every live quote, traded or not)",
            "",
            "The same sweep without the traded-candle requirement: "
            f"{o_cov['n_quote']} markets instead of {coverage['n_traded']}. "
            "Read the gap between the two as the price of insisting on "
            "evidence that a counterparty was there. Quotes on untraded "
            "candles are frequently carried forward — 27% of the stale "
            "candle's asks in this corpus are identical to the ask six to "
            "twenty-four hours earlier — so a fill against them is an "
            "assumption, not an observation.",
            "",
            "| Min \\|gap\\| | Trades | Wins | Win rate | Gross | Net | ROI | "
            "Always NO | Edge vs NO | t |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        for r in o_rows:
            if not r.get("n"):
                continue
            wr = f"{100 * r['wins'] / r['n']:.0f}%"
            roi = r["net"] / r["stake"] if r["stake"] else None
            roi_s = f"{100 * roi:.1f}%" if roi is not None else "-"
            t = r["edge_t"]
            t_s = f"{t:+.2f}" if t is not None else "-"
            lines.append(
                f"| {r['threshold']:.2f} | {r['n']} | {r['wins']} | {wr} | "
                f"{r['gross']:+.2f} | {r['net']:+.2f} | {roi_s} | "
                f"{r['net_no']:+.2f} | {r['edge_no']:+.2f} | {t_s} |")
        lines.append("")

    if lead_rows:
        lines += [
            "## Entry time",
            "",
            "The same strategy entered at each horizon, on the traded-candle "
            "basis, at min |gap| 0.10. The trade count falls with the lead "
            "because fewer markets have a traded candle to enter on: the "
            "quote is there at every horizon, but the evidence is not. The "
            "edge over Always-NO is **not** flat across them, and its shape "
            "is the useful part. An hour before close the strategy is "
            "significantly *worse* than doing nothing but betting NO: by "
            "then the call has happened, the price has absorbed what was "
            "said, and the baseline is built only from prior calls, so the "
            "widest gaps are exactly where the market knows something the "
            "transcript cannot (t = −4.24). Entered 3–12 hours out it beats "
            "the benchmark by 12–23¢ a trade, but at |t| ≈ 1.2 that is not "
            "significant at this sample size. From 18 hours out the gap is "
            "indistinguishable from zero at every horizon, and the net is "
            "the price level and nothing else. So mid-depth leads are the "
            "only ones where side selection adds anything at all — and even "
            "there the evidence is weak.",
            "",
            "| Lead | Live quotes | Traded | Trades | Wins | Win rate | Net | "
            "Always NO | Edge vs NO | t |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        for r in lead_rows:
            star = "**" if r["lead"] == lead else ""
            wr = f"{100 * r['wins'] / r['n']:.0f}%" if r["n"] else "-"
            t = r["edge_t"]
            t_s = f"{t:+.2f}" if t is not None else "-"
            lines.append(
                f"| {star}{r['lead']}{star} | {r['n_quote']} | {r['n_traded']} | "
                f"{r['n']} | {r['wins']} | {wr} | {r['net']:+.2f} | "
                f"{r['net_no']:+.2f} | {r['edge_no']:+.2f} | {t_s} |")
        lines.append("")

    if split_rows:
        lines += [
            "## Temporal split",
            "",
            f"Markets closing before {cutoff} (train) against those closing "
            "on or after it (test). No calibration is fit anywhere in this "
            "report — the baseline is the raw transcript one — so the split "
            "measures stability across time rather than out-of-sample skill "
            "of a fitted parameter. It is still the cheapest check on whether "
            "the test half behaves like the train half.",
            "",
            "| Split | Trades | Wins | Win rate | Net | Always NO | Edge vs NO | "
            "t |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for r in split_rows:
            wr = f"{100 * r['wins'] / r['n']:.0f}%" if r["n"] else "-"
            t = r["edge_t"]
            t_s = f"{t:+.2f}" if t is not None else "-"
            lines.append(
                f"| {r['split']} | {r['n']} | {r['wins']} | {wr} | "
                f"{r['net']:+.2f} | {r['net_no']:+.2f} | {r['edge_no']:+.2f} | "
                f"{t_s} |")
        lines.append("")

    if cap_rows:
        lines += [
            "## Capital",
            "",
            "Fillable size is capped at "
            f"**{100 * participation:.0f}% of the entry hour's traded "
            "volume** — a taker order can only take what someone else traded "
            "in the hour it crosses. Everything up to the cap fills at the "
            "quoted ask, which is the price this report already assumes; "
            "everything past it goes **unfilled** rather than filled worse. "
            "So this table is an upper bound on size, not a cost estimate: "
            "it does not know how much was actually resting at the ask, and "
            "a real order past the cap would either miss or walk deeper and "
            "pay more. Participation is a flag, not a fitted parameter — "
            "nothing in this repo pins it down.",
            "",
            f"Sizes are per trade, over the min |gap| {CAPACITY_THRESHOLD:.2f} "
            "selection. Net, ROI and capital are at the executable price, so "
            "the per-contract average matches the headline table and the "
            "only thing size changes is how much of each bet you get.",
            "",
            "| Position N | Contracts wanted | Filled | Fill rate | Net | ROI | "
            "Capital | Avg slippage | Trades filled | Partially filled |",
            "|---|---|---|---|---|---|---|---|---|---|",
        ]
        def pct(v, digits=0):
            return f"{100 * v:.{digits}f}%" if v is not None else "-"

        for r in cap_rows:
            lines.append(
                f"| {r['size']:.0f} | {r['requested']:.0f} | {r['filled']:.0f} | "
                f"{pct(r['fill_pct'])} | {r['net']:+.2f} | {pct(r['roi'], 1)} | "
                f"{r['capital']:.2f} | {r['avg_slippage']:+.3f} | "
                f"{r['n_filled']} | {r['n_partial']} |")
        lines.append("")

    sel = [x for x in trades if abs(x["gap"]) >= CAPACITY_THRESHOLD]
    by_co = defaultdict(lambda: [0, 0, 0.0])
    for x in sel:
        c = by_co[x["code"]]
        c[0] += 1
        c[1] += x["win"]
        c[2] += headline_net(x, fee_model)
    lines += ["## Per company (min |gap| 0.10)", "",
              "| Company | Trades | Wins | Net |", "|---|---|---|---|"]
    for code in sorted(by_co):
        n, w, net = by_co[code]
        lines.append(f"| {code} | {n} | {w} | {net:+.2f} |")
    lines.append("")

    lines += [
        f"## Trades (min |gap| {CAPACITY_THRESHOLD:.2f})",
        "",
        "Cost is the price paid; Ask and Bid are the entry candle's quotes, so "
        "`Cost` equals the ask on a YES bet and `1 − bid` on a NO bet. Gross "
        "and Net are per contract at $1 stake.",
        "",
        "| Event | Company | Word | Baseline | Ask | Bid | Cost | Gap | Side | "
        "Result | Gross | Net |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for x in sorted(sel, key=lambda t: (t["event_date"], t["code"])):
        net = headline_net(x, fee_model)
        lines.append(
            f"| {x['event_date']} | {x['code']} | {x['word']} | "
            f"{100 * x['baseline']:.0f}% | {x['ask']:.2f} | {x['bid']:.2f} | "
            f"{x['cost']:.2f} | {100 * x['gap']:+.0f} | {x['side']} | "
            f"{x['result']} | {x['pnl_gross']:+.2f} | {net:+.2f} |")
    lines += [
        "",
        "*The baseline is the raw transcript one from "
        "`generate_earnings_report.word_baseline`: the word's prior-call "
        "frequency blended with a transition prior on whether the most recent "
        "call said it. It is not recalibrated here.*",
        "",
    ]
    return "\n".join(lines).rstrip() + "\n"


def main():
    ap = argparse.ArgumentParser(
        description="Backtest the earnings gap strategy at fillable prices")
    ap.add_argument("--history", type=Path, default=HISTORY_FILE)
    ap.add_argument("--out", type=Path, default=OUT_REPORT)
    ap.add_argument("--lead", type=int, default=DEFAULT_LEAD,
                    help="Entry horizon in hours before close (default 24)")
    ap.add_argument("--fee-rate", type=float, default=0.03,
                    help="Rate for the flat winners-only column (default 0.03)")
    ap.add_argument("--fee-model", choices=("kalshi", "flat"), default="kalshi",
                    help="Headline fee model (default kalshi: the taker "
                         "schedule you actually pay when crossing)")
    ap.add_argument("--max-price", type=float, default=None,
                    help="Only take bets whose chosen side costs at most this "
                         "much (e.g. 0.30 = 30¢ contracts only)")
    ap.add_argument("--cutoff", default=DEFAULT_CUTOFF,
                    help="Temporal split boundary (YYYY-MM-DD)")
    ap.add_argument("--participation", type=float, default=PARTICIPATION,
                    help="Share of the entry hour's flow our order captures in "
                         f"the capital section (default {PARTICIPATION})")
    args = ap.parse_args()

    history = load_history(args.history)
    # Every lead present in the file, so the report shows whether the answer is
    # a property of the 24h entry or of the market at every horizon.
    leads = sorted({int(k[len("price_"):-1]) for r in history
                    for k in r if k.startswith("price_") and k.endswith("h")})

    # Progress is staged rather than per-market: the refresh pipeline renders
    # these lines into its beat budget, and the lead sweep — one full pass over
    # the corpus per lead — is the long pole. Silence there reads as a hang.
    stages = (["load transcripts", "headline basis", "optimistic basis"]
              + [f"lead {ld}h" for ld in leads]
              + ["temporal split", "capital", "render"])
    counter = itertools.count(1)

    def step(label: str) -> None:
        print(f"[fills] [{next(counter)}/{len(stages)}] {label}", flush=True)

    step("load transcripts")
    docs_by_ticker = load_transcripts()
    call_dates = load_call_dates(MENTIONS, history)
    presence = load_presence()

    step("headline basis")
    trades, coverage = simulate(history, docs_by_ticker, call_dates,
                                args.lead, presence, require_traded=True,
                                fee_rate=args.fee_rate, max_price=args.max_price)
    step("optimistic basis")
    opt_trades, opt_cov = simulate(history, docs_by_ticker, call_dates,
                                   args.lead, presence, require_traded=False,
                                   fee_rate=args.fee_rate,
                                   max_price=args.max_price)
    save_presence(presence)

    rows = sweep(trades, SWEEP_THRESHOLDS, args.fee_model)
    opt_rows = sweep(opt_trades, SWEEP_THRESHOLDS, args.fee_model)

    lead_rows = []
    for ld in leads:
        step(f"lead {ld}h")
        tr, cov = simulate(history, docs_by_ticker, call_dates, ld, presence,
                           require_traded=True, fee_rate=args.fee_rate,
                           max_price=args.max_price)
        s = sweep(tr, [0.10], args.fee_model)[0]
        lead_rows.append({
            "lead": ld, "n_quote": cov["n_quote"], "n_traded": cov["n_traded"],
            "n": s.get("n", 0), "wins": s.get("wins", 0),
            "net": s.get("net", 0.0), "net_no": s.get("net_no", 0.0),
            "edge_no": s.get("edge_no", 0.0), "edge_t": s.get("edge_t"),
        })

    step("temporal split")
    split_rows = []
    for name, pred in (("train", lambda c: c < args.cutoff),
                       ("test", lambda c: c >= args.cutoff)):
        sub = [r for r in history
               if pred((r.get("close_time_iso") or "")[:10])]
        tr, _ = simulate(sub, docs_by_ticker, call_dates, args.lead, presence,
                         require_traded=True, fee_rate=args.fee_rate,
                         max_price=args.max_price)
        s = sweep(tr, [CAPACITY_THRESHOLD], args.fee_model)[0]
        split_rows.append({
            "split": name, "n": s.get("n", 0), "wins": s.get("wins", 0),
            "net": s.get("net", 0.0), "net_no": s.get("net_no", 0.0),
            "edge_no": s.get("edge_no", 0.0), "edge_t": s.get("edge_t"),
        })

    step("capital")
    cap_rows = None
    if trades:
        # capacity.py names the two schedules "flat"/"taker"; this module names
        # the honest default "kalshi", after who charges it. Map across rather
        # than let an unknown string fall through to capacity's flat branch,
        # which would charge a crossing order the winners-only fee.
        cap_fee = "taker" if args.fee_model == "kalshi" else "flat"
        view = capacity_view([t for t in trades
                              if abs(t["gap"]) >= CAPACITY_THRESHOLD])
        cap_rows = capacity_curve(view, CAPACITY_SIZES, model="cross",
                                  participation=args.participation,
                                  fee_model=cap_fee,
                                  fee_rate=args.fee_rate,
                                  threshold=CAPACITY_THRESHOLD)
        for r in cap_rows:
            want = len(view) * r["size"]
            got = sum(fill_for_trade(t, r["size"], model="cross",
                                     participation=args.participation)["filled"]
                      for t in view)
            r["requested"] = want
            r["filled"] = got
            r["fill_pct"] = got / want if want else None

    step("render")
    text = render(trades, coverage, rows,
                  optimistic={"rows": opt_rows, "coverage": opt_cov},
                  lead_rows=lead_rows, cal_rows=calibration_rows(history, args.lead),
                  bench_rows=benchmark_rows(history, leads),
                  split_rows=split_rows, cap_rows=cap_rows, lead=args.lead,
                  fee_rate=args.fee_rate, fee_model=args.fee_model,
                  cutoff=args.cutoff, participation=args.participation,
                  max_price=args.max_price)
    args.out.write_text(text)

    print(f"Wrote {args.out}")
    print(f"lead {args.lead}h · {coverage['n_quote']} live quotes · "
          f"{coverage['n_traded']} traded · {coverage['n_tradable']} tradable · "
          f"fee {args.fee_model}")
    for r in rows:
        if not r.get("n"):
            continue
        wr = f"{100 * r['wins'] / r['n']:.0f}%"
        t = r["edge_t"]
        print(f"|gap| >= {r['threshold']:.2f}: {r['n']:4d} trades, "
              f"{r['wins']:4d} wins ({wr}), net {r['net']:+7.2f} "
              f"(always NO {r['net_no']:+7.2f}, edge {r['edge_no']:+6.2f}"
              + (f", t {t:+.2f}" if t is not None else "") + ")")
    print(f"(untraded entries, same sweep: "
          f"{opt_cov['n_quote']} quotes, {opt_cov['n_tradable']} tradable)")
    for r in split_rows:
        print(f"  {r['split']}: {r['n']} trades, net {r['net']:+.2f}, "
              f"always NO {r['net_no']:+.2f}, edge {r['edge_no']:+.2f}")
    for r in benchmark_rows(history, [args.lead]):
        print(f"  price level at {r['lead']}h: always YES {r['yes_net']:+.3f}/contract, "
              f"always NO {r['no_net']:+.3f}/contract "
              f"(realized {100 * r['realized']:.1f}% vs mid "
              f"{(r['mean_ask'] + r['mean_bid']) / 2:.3f})")


if __name__ == "__main__":
    main()
