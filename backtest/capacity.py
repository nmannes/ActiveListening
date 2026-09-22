"""
capacity.py — Depth/capacity model for the earnings-mention backtest.

scripts/backtest_earnings_report.py prices every trade as if unlimited size
filled at one entry price. Real books are finite: a resting order only fills
against the flow that trades through it, and a taker order walks the ladder
and pays a worse average price. This module turns traded volume into fillable
size and measures the slippage the headline report assumes away.

The strategy rests an order `lead` hours before close (default 24h) and the
market resolves at close, so two entry styles bound the possible fill:

  "worked" — post a limit order at the entry price and let the flow arriving
             between entry and close (volcum) fill it. The fill price is the
             posted price, so slippage is identically zero.
  "taker"  — cross the spread at entry, so only the entry-hour flow (vol) is
             available and the ladder's VWAP sets the cost.

Per-contract P&L mirrors pnl() in scripts/backtest_earnings_report.py: a
contract pays $1 when it wins and $0 otherwise, so gross is 1 - cost or -cost.
"""

import math
from collections.abc import Iterable, Sequence

# Default share of observed flow we assume our own orders capture. Well below
# 1.0 because the flow is mostly other participants' orders.
PARTICIPATION = 0.10

# Cumulative depth within k cents of the best price, as a multiple of the size
# resting AT the best price. MEDIAN across sides, measured over the live books
# in market_tracking/kxearningsmention*.db (87 earnings events, 3,046 non-empty
# sides):
#
#   cum(k) = sum(qty at p for p >= best - k) / qty[best]   -> median over sides
#
# Reproduce with:
#   python -c "import json,glob,sqlite3,statistics as st; ..."   # see git log
#
# Caveat that travels with every number derived from this: those books are
# captured around the earnings call, i.e. the most liquid moment of the
# market's life, and the strategy enters 24h earlier. Depth at entry is
# therefore <= this, so the slippage implied here is a LOWER bound. Only
# synthetic_book() reads these, i.e. only the taker model's fill price — the
# worked headline does not depend on the curve at all.
TIER_CENTS = [1, 2, 3, 5, 10]
TIER_CUM_MULT = [1.36, 2.40, 3.50, 6.03, 10.62]


def walk_book(levels: Iterable[tuple[float, float]],
              size: float) -> tuple[float, float | None, int]:
    """Consume `levels` cheapest-first up to `size` contracts.

    levels: iterable of (price, qty) in dollars / contracts.
    Returns (filled_qty, avg_cost, levels_consumed).
    avg_cost is the volume-weighted average price actually paid (None if
    filled_qty == 0). levels_consumed counts how many levels were touched
    (a level partially consumed still counts).
    """
    if size is None or size <= 0:
        return 0.0, None, 0
    filled = 0.0
    paid = 0.0
    consumed = 0
    for price, qty in sorted(levels):
        if qty <= 0:
            continue  # empty level: neither fills nor counts as touched
        take = min(qty, size - filled)
        filled += take
        paid += take * price
        consumed += 1
        if filled >= size:
            break
    if filled <= 0:
        return 0.0, None, 0
    return filled, paid / filled, consumed


def kalshi_taker_fee(contracts: float, price: float, rate: float = 0.07) -> float:
    """Kalshi taker fee in dollars: ceil(rate * C * P * (1-P)) to the next cent.

    Kalshi rounds the fee *up* per order. Rounding the raw cents to 1e-6 first
    matters: 0.07 * 100 * 0.50 * 0.50 evaluates to 175.00000000000003 cents,
    and a bare ceil would bump that exact-cent fee to $1.76.
    """
    if contracts is None or contracts <= 0 or not 0.0 < price < 1.0:
        return 0.0
    cents = rate * contracts * price * (1.0 - price) * 100.0
    return math.ceil(round(cents, 6)) / 100.0


def net_per_contract(side: str, price: float, result: str,
                     fee_model: str = "flat", fee_rate: float = 0.03) -> float:
    """Net dollars per contract. fee_model: "flat" (existing: fee_rate on
    positive gross only) or "taker" (kalshi_taker_fee above, charged on every
    trade including losers)."""
    win = (result == "yes") == (side == "YES")
    gross = 1.0 - price if win else -price
    if fee_model == "taker":
        # Kalshi's real 7% schedule rather than the flat fee_rate (which is the
        # 3%-of-winnings model): it charges every fill, losers included.
        return gross - kalshi_taker_fee(1, price)
    return gross - fee_rate * max(gross, 0.0)


def position_pnl(side: str, price: float, result: str, contracts: float,
                 fee_model: str = "flat", fee_rate: float = 0.03) -> float:
    """Order-level net P&L in dollars for `contracts` at `price`.

    The taker fee's ceil must be applied ONCE to the whole order, not per
    contract — that is why this exists separately from net_per_contract.
    """
    if contracts is None or contracts <= 0:
        return 0.0
    win = (result == "yes") == (side == "YES")
    gross = contracts * (1.0 - price if win else -price)
    if fee_model == "taker":
        return gross - kalshi_taker_fee(contracts, price)
    return gross - fee_rate * max(gross, 0.0)


def synthetic_book(top_price: float, budget: float,
                   adverse: bool = True) -> list[tuple[float, float]]:
    """Depth ladder for a market whose total available size over the 10c band
    is `budget` contracts.

    Level prices step 1, 2, 3, 5, 10 cents from top_price in the adverse
    direction (up when adverse, i.e. the buyer pays more). Level sizes follow
    the measured shape: the increment between consecutive TIER_CUM_MULT values,
    divided by the total (3.23) and multiplied by `budget` — so level sizes sum
    to exactly `budget`. Prices are rounded to whole cents and clamped to
    [0.01, 0.99]; DROP levels whose price falls outside that range. If two
    levels round to the same price, merge them (sum their sizes).
    Returns a list of (price, qty) sorted by price ascending, and the list must
    sum to exactly `budget`.
    """
    if budget is None or budget <= 0:
        return []

    total = TIER_CUM_MULT[-1]
    steps = [TIER_CUM_MULT[0]] + [b - a
                                  for a, b in zip(TIER_CUM_MULT, TIER_CUM_MULT[1:])]
    direction = 1.0 if adverse else -1.0
    levels = []  # (price_cents, qty), in tier order
    for cents, step in zip(TIER_CENTS, steps):
        price = int(round((top_price + direction * cents / 100.0) * 100))
        if not 1 <= price <= 99:
            continue  # ladder ran off the tradeable range
        qty = step / total * budget
        if levels and levels[-1][0] == price:
            levels[-1] = (price, levels[-1][1] + qty)  # cent rounding collided
        else:
            levels.append((price, qty))

    if len(levels) < len(TIER_CENTS):
        # A dropped level would leak size; the caller asked for a book holding
        # `budget` contracts, so spread the loss across the survivors.
        kept = sum(q for _, q in levels)
        if kept <= 0:
            return []
        levels = [(p, q * budget / kept) for p, q in levels]

    levels.sort()
    return [(p / 100.0, q) for p, q in levels]


def max_fillable(vol_budget: float | None,
                 participation: float = PARTICIPATION) -> float:
    """Contracts fillable = participation * vol_budget. Returns 0.0 when
    vol_budget is None or <= 0."""
    if vol_budget is None or vol_budget <= 0:
        return 0.0
    return participation * vol_budget


def fill_for_trade(trade: dict, size: float, model: str = "worked",
                   participation: float = PARTICIPATION) -> dict:
    """Fill for one trade dict at desired order size `size` contracts.

    `trade` is a dict that MAY contain the keys "cost" (float, required),
    "vol_24h" (contracts traded in the entry hour) and "volcum_24h"
    (contracts traded from entry through close). Read them with `.get()` and
    treat missing/None as 0 — do NOT require them, callers build rows without
    them.

    model="worked" (headline): you rest a limit order at `trade["cost"]` and
      incoming flow fills it. Budget = participation * volcum_24h. Fill price is
      exactly trade["cost"], slippage always 0.0.
    model="taker" (conservative lower bound): you cross the spread now, so the
      only available size is the entry-hour flow. Budget =
      participation * vol_24h. Slippage: walk a synthetic_book(cost, budget)
      and take the VWAP of what is actually filled; slippage = avg_cost - cost.
    model="cross": you cross the spread at `trade["cost"]`, and that cost is
      ALREADY the quoted ask rather than a last-traded price. Budget =
      participation * vol_24h, the same entry-hour flow "taker" uses, but the
      fill is at the quote itself: the first cent "taker" charges is the
      spread this model is already paying, so walking the ladder on top of an
      ask would bill it twice. Slippage 0.0, and size beyond the flow cap
      simply goes unfilled — top-of-book depth is not in the historical
      candles, so what else was resting at the ask is not modelled. Requires
      `cost` to be an executable price; used by
      scripts/backtest_earnings_fills.py.

    Returns a dict with keys:
      "budget"     float  contracts available
      "filled"     float  min(size, budget), 0.0 if budget <= 0
      "fill_cost"  float  average price paid (None if filled == 0)
      "slippage"   float  fill_cost - trade["cost"] (0.0 if filled == 0)
      "shortfall"  float  max(0.0, size - filled)
      "model"      str
    """
    size = float(size or 0.0)
    cost = trade["cost"]

    if model == "taker":
        budget = max_fillable(trade.get("vol_24h"), participation)
        filled, avg, _ = walk_book(synthetic_book(cost, budget), size)
    elif model == "cross":
        budget = max_fillable(trade.get("vol_24h"), participation)
        # A taker order at the quote pays the quote; any size past the flow cap
        # is unfilled rather than filled worse.
        filled = min(size, budget) if budget > 0 else 0.0
        avg = cost if filled > 0 else None
    else:
        budget = max_fillable(trade.get("volcum_24h"), participation)
        # A resting order fills at the posted price, so any budget beyond the
        # order size is simply unused.
        filled = min(size, budget) if budget > 0 else 0.0
        avg = cost if filled > 0 else None

    filled = max(0.0, filled)
    return {
        "budget": budget,
        "filled": filled,
        "fill_cost": avg,
        "slippage": (avg - cost) if avg is not None else 0.0,
        "shortfall": max(0.0, size - filled),
        "model": model,
    }


def capacity_curve(trades: list[dict], sizes: Sequence[float],
                   model: str = "worked", participation: float = PARTICIPATION,
                   fee_model: str = "flat", fee_rate: float = 0.03,
                   threshold: float = 0.10) -> list[dict]:
    """Aggregate capacity curve. `trades` is a list of trade dicts as produced
    by simulate() in scripts/backtest_earnings_report.py — each has at least
    "cost", "side", "result", "gap", "pnl_gross", "pnl_net" and may have the
    vol keys above.

    For each size N in `sizes`, over trades with abs(gap) >= threshold:
      net        = sum of position_pnl(..., contracts=filled) per trade
      gross      = same with fee_model="flat", fee_rate=0
      capital    = sum of filled * fill_cost
      n_filled   = trades with filled > 0
      n_partial  = trades with 0 < filled < N
      avg_slippage = mean slippage over trades with filled > 0
      roi        = net / capital (None if capital == 0)

    Returns a list of dicts, one per size, with keys:
      "size", "n_filled", "n_partial", "net", "gross", "capital", "roi",
      "avg_slippage".
    """
    selected = [t for t in trades if abs(t.get("gap") or 0.0) >= threshold]
    rows = []
    for size in sizes:
        net = gross = capital = 0.0
        n_filled = n_partial = 0
        slips = []
        for t in selected:
            fill = fill_for_trade(t, size, model=model, participation=participation)
            if fill["filled"] <= 0:
                continue
            n_filled += 1
            if fill["filled"] < size:
                n_partial += 1
            price = fill["fill_cost"]
            contracts = fill["filled"]
            net += position_pnl(t["side"], price, t["result"], contracts,
                                fee_model=fee_model, fee_rate=fee_rate)
            gross += position_pnl(t["side"], price, t["result"], contracts,
                                  fee_model="flat", fee_rate=0.0)
            capital += contracts * price
            slips.append(fill["slippage"])
        rows.append({
            "size": size,
            "n_filled": n_filled,
            "n_partial": n_partial,
            "net": net,
            "gross": gross,
            "capital": capital,
            "roi": net / capital if capital > 0 else None,
            # No fill means no slippage was paid, so an empty selection is 0.
            "avg_slippage": sum(slips) / len(slips) if slips else 0.0,
        })
    return rows
