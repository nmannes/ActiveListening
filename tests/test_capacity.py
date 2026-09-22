"""Tests for the depth/capacity model (backtest/capacity.py)."""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import backtest_earnings_report as bt  # noqa: E402
from backtest import capacity as cap  # noqa: E402


def ctrade(cost, side="YES", result="yes", gap=0.20, volcum=None, vol=None):
    """Minimal trade row; vol keys are omitted entirely when not given, so the
    tests exercise the "missing volume" path the report's rows can hit."""
    t = {"cost": cost, "side": side, "result": result, "gap": gap}
    if volcum is not None:
        t["volcum_24h"] = volcum
    if vol is not None:
        t["vol_24h"] = vol
    return t


# ── walk_book ──────────────────────────────────────────────────────────

LEVELS = [(0.32, 200.0), (0.30, 100.0), (0.31, 50.0)]  # deliberately unsorted


def test_walk_book_consumes_cheapest_first():
    filled, avg, n = cap.walk_book(LEVELS, 120)
    assert filled == 120
    assert n == 2  # 0.30 exhausted, 0.31 partially consumed
    assert avg == pytest.approx((100 * 0.30 + 20 * 0.31) / 120)


def test_walk_book_vwap_spans_three_levels():
    filled, avg, n = cap.walk_book(LEVELS, 350)
    assert filled == 350 and n == 3
    assert avg == pytest.approx((100 * 0.30 + 50 * 0.31 + 200 * 0.32) / 350)


def test_walk_book_exact_level_boundary():
    filled, avg, n = cap.walk_book(LEVELS, 100)
    assert (filled, n) == (100, 1)
    assert avg == pytest.approx(0.30)


def test_walk_book_zero_size_empty_book_and_overrun():
    assert cap.walk_book(LEVELS, 0) == (0.0, None, 0)
    assert cap.walk_book([], 25) == (0.0, None, 0)
    # Size beyond total depth: fills only the 350 that exist.
    filled, avg, n = cap.walk_book(LEVELS, 10_000)
    assert (filled, n) == (350, 3)
    assert avg == pytest.approx(109.5 / 350)
    # Empty levels neither fill nor count as touched.
    assert cap.walk_book([(0.30, 0.0), (0.31, 10.0)], 10) == (10.0, 0.31, 1)


# ── kalshi_taker_fee ───────────────────────────────────────────────────

def test_kalshi_taker_fee_hand_computed():
    # 0.07 * 100 * 0.50 * 0.50 = $1.75, already whole cents.
    assert cap.kalshi_taker_fee(100, 0.50) == 1.75
    # 0.07 * 1 * 0.30 * 0.70 = $0.0147 → ceils up to $0.02.
    assert cap.kalshi_taker_fee(1, 0.30) == 0.02
    # 0.07 * 57 * 0.23 * 0.77 = $0.706629 → ceils up to $0.71.
    assert cap.kalshi_taker_fee(57, 0.23) == 0.71


def test_kalshi_taker_fee_exact_cent_is_not_bumped():
    # 0.07 * 100 * 0.10 * 0.90 = 63.000000000000014 cents in float; a bare
    # ceil would wrongly charge $0.64.
    assert cap.kalshi_taker_fee(100, 0.10) == 0.63
    assert cap.kalshi_taker_fee(1000, 0.50) == 17.50


def test_kalshi_taker_fee_zero_sizes():
    assert cap.kalshi_taker_fee(0, 0.50) == 0.0
    assert cap.kalshi_taker_fee(100, 0.0) == 0.0
    assert cap.kalshi_taker_fee(100, 1.0) == 0.0


# ── net_per_contract / position_pnl ────────────────────────────────────

def test_flat_model_charges_fee_on_profit_only():
    assert cap.net_per_contract("YES", 0.60, "yes") == pytest.approx(0.40 * 0.97)
    assert cap.net_per_contract("YES", 0.60, "no") == -0.60  # loser pays nothing
    assert cap.net_per_contract("NO", 0.40, "no") == pytest.approx(0.60 * 0.97)
    assert cap.net_per_contract("NO", 0.40, "yes") == -0.40


def test_taker_model_charges_on_losers_too():
    # kalshi_taker_fee(1, 0.60) = ceil(1.68c) = 2c, charged even though it lost.
    assert cap.net_per_contract("YES", 0.60, "yes", "taker") == pytest.approx(0.38)
    assert cap.net_per_contract("YES", 0.60, "no", "taker") == pytest.approx(-0.62)


def test_position_pnl_flat_scales_linearly():
    assert cap.position_pnl("YES", 0.60, "yes", 100) == pytest.approx(100 * 0.40 * 0.97)
    assert cap.position_pnl("YES", 0.60, "no", 100) == -60.0
    assert cap.position_pnl("YES", 0.60, "yes", 0) == 0.0


def test_position_pnl_taker_ceils_once_per_order():
    # fee = ceil(0.07 * 100 * 0.30 * 0.70) = $1.47 for the whole order, versus
    # 100 x the one-lot fee (100 x $0.02 = $2.00).
    assert cap.position_pnl("YES", 0.30, "yes", 100, "taker") == pytest.approx(70.0 - 1.47)
    assert cap.position_pnl("YES", 0.30, "no", 100, "taker") == pytest.approx(-30.0 - 1.47)
    per_contract_sum = 100 * cap.net_per_contract("YES", 0.30, "yes", "taker")
    assert cap.position_pnl("YES", 0.30, "yes", 100, "taker") != pytest.approx(per_contract_sum)


def test_flat_model_matches_report_pnl():
    # capacity's flat model must reproduce scripts/backtest_earnings_report.pnl
    # exactly, or the capacity curve stops being comparable to the headline.
    for side in ("YES", "NO"):
        for result in ("yes", "no"):
            for cost in (0.05, 0.33, 0.60, 0.95):
                _, net = bt.pnl(side, cost, result, 0.03)
                assert cap.net_per_contract(side, cost, result) == pytest.approx(net)
                assert cap.position_pnl(side, cost, result, 10) == pytest.approx(10 * net)


# ── synthetic_book ─────────────────────────────────────────────────────

def _tier_steps():
    """Per-tier size increments as a fraction of the total, derived from the
    module's own curve so retuning TIER_CUM_MULT does not silently invalidate
    the shape assertions (which are about the relationship, not the values)."""
    cum = cap.TIER_CUM_MULT
    total = cum[-1]
    return [cum[0] / total] + [(b - a) / total
                               for a, b in zip(cum, cum[1:])]


def test_synthetic_book_shape_and_sum():
    book = cap.synthetic_book(0.33, 1000.0)
    assert [p for p, _ in book] == [0.34, 0.35, 0.36, 0.38, 0.43]
    assert sum(q for _, q in book) == pytest.approx(1000.0)
    assert all(q > 0 for _, q in book)
    for (_, qty), frac in zip(book, _tier_steps()):
        assert qty == pytest.approx(frac * 1000.0)


def test_synthetic_book_adverse_false_steps_down():
    book = cap.synthetic_book(0.33, 500.0, adverse=False)
    assert [p for p, _ in book] == [0.23, 0.28, 0.30, 0.31, 0.32]
    # The widest tier still sits farthest from the top, whichever way we walk:
    # walking down reverses the tier order, so sizes run wide-tier-first.
    for (_, qty), frac in zip(book, reversed(_tier_steps())):
        assert qty == pytest.approx(frac * 500.0)


def test_synthetic_book_prices_are_whole_cents_in_range():
    for top in (0.01, 0.07, 0.33, 0.5, 0.91, 0.99):
        for adverse in (True, False):
            for price, qty in cap.synthetic_book(top, 400.0, adverse=adverse):
                assert price == pytest.approx(round(price, 2))
                assert 0.01 <= price <= 0.99
                assert qty > 0


def test_synthetic_book_drops_levels_past_the_clamp():
    # Top 0.98 → the 1c level is 0.99; everything deeper is >= $1.00.
    book = cap.synthetic_book(0.98, 1000.0)
    assert [p for p, _ in book] == [0.99]
    # Dropping a level must not leak size: survivors absorb the budget.
    assert sum(q for _, q in book) == pytest.approx(1000.0)
    assert cap.synthetic_book(0.02, 1000.0, adverse=False) == [(0.01, pytest.approx(1000.0))]


def test_synthetic_book_zero_or_negative_budget():
    assert cap.synthetic_book(0.33, 0.0) == []
    assert cap.synthetic_book(0.33, -5.0) == []


# ── max_fillable ───────────────────────────────────────────────────────

def test_max_fillable():
    assert cap.max_fillable(1000.0) == pytest.approx(100.0)
    assert cap.max_fillable(1000.0, participation=0.05) == pytest.approx(50.0)
    assert cap.max_fillable(None) == 0.0
    assert cap.max_fillable(0.0) == 0.0
    assert cap.max_fillable(-10.0) == 0.0


# ── fill_for_trade ─────────────────────────────────────────────────────

def test_fill_worked_uses_volcum_and_has_no_slippage():
    t = ctrade(0.30, volcum=1_000_000, vol=500)
    fill = cap.fill_for_trade(t, 100, model="worked")
    assert fill["model"] == "worked"
    assert fill["budget"] == pytest.approx(100_000.0)
    assert fill["filled"] == 100
    assert fill["fill_cost"] == 0.30
    assert fill["slippage"] == 0.0
    assert fill["shortfall"] == 0.0


def test_fill_worked_capped_by_volcum():
    t = ctrade(0.30, volcum=250)
    fill = cap.fill_for_trade(t, 100, model="worked")
    assert fill["budget"] == pytest.approx(25.0)
    assert fill["filled"] == 25.0
    assert fill["fill_cost"] == 0.30
    assert fill["slippage"] == 0.0
    assert fill["shortfall"] == pytest.approx(75.0)


def test_fill_taker_uses_entry_hour_volume_and_slips():
    t = ctrade(0.30, vol=5_000, volcum=1_000_000)
    fill = cap.fill_for_trade(t, 100, model="taker")
    assert fill["budget"] == pytest.approx(500.0)   # 10% of vol_24h, not volcum
    assert fill["filled"] == 100
    # The order is larger than the top tier, so the walk must continue outward
    # and pay worse than the quote — which is exactly what the worked model
    # assumes away. Assert the relationship rather than a magic fill price, so
    # retuning the depth curve does not break this.
    assert 0.30 < fill["fill_cost"] < 0.32
    assert fill["slippage"] == pytest.approx(fill["fill_cost"] - 0.30)
    assert fill["slippage"] > 0
    assert fill["shortfall"] == 0.0


def test_fill_taker_slippage_positive_and_monotone_in_size():
    t = ctrade(0.30, vol=5_000)
    fills = [cap.fill_for_trade(t, size, model="taker")
             for size in (50, 100, 200, 300, 400, 500, 5_000)]
    slips = [f["slippage"] for f in fills]
    assert all(s > 0 for s in slips)
    assert all(b >= a - 1e-12 for a, b in zip(slips, slips[1:]))
    assert slips[-1] > fills[0]["slippage"]
    # Beyond the budget the whole ladder is consumed and nothing more fills.
    assert fills[-1]["filled"] == pytest.approx(500.0)
    assert fills[-1]["shortfall"] == pytest.approx(4_500.0)


def test_fill_cross_pays_the_quote_with_no_slippage():
    # `cost` here is the quoted ask, not a last-traded price, so the fill is at
    # the quote: charging the taker ladder's first cent on top would bill the
    # spread twice.
    t = ctrade(0.30, vol=5_000, volcum=1_000_000)
    fill = cap.fill_for_trade(t, 100, model="cross")
    assert fill["model"] == "cross"
    assert fill["budget"] == pytest.approx(500.0)   # entry-hour flow, like taker
    assert fill["filled"] == 100
    assert fill["fill_cost"] == 0.30
    assert fill["slippage"] == 0.0
    assert fill["shortfall"] == 0.0


def test_fill_cross_caps_size_at_the_flow_and_does_not_walk_past_it():
    t = ctrade(0.30, vol=5_000)
    fill = cap.fill_for_trade(t, 900, model="cross")
    assert fill["filled"] == pytest.approx(500.0)
    assert fill["fill_cost"] == 0.30   # unfilled size is not filled worse
    assert fill["slippage"] == 0.0
    assert fill["shortfall"] == pytest.approx(400.0)
    # Same size under the ladder model both overpays and fills more, which is
    # why the two are not interchangeable when cost is already executable.
    taker = cap.fill_for_trade(t, 900, model="taker")
    assert taker["slippage"] > 0


def test_fill_trade_without_volume_keys_does_not_raise():
    t = {"cost": 0.42}  # exactly the keys simulate() rows may lack
    for model in ("worked", "taker", "cross"):
        fill = cap.fill_for_trade(t, 50, model=model)
        assert fill["budget"] == 0.0
        assert fill["filled"] == 0.0
        assert fill["fill_cost"] is None
        assert fill["slippage"] == 0.0
        assert fill["shortfall"] == 50.0
        assert fill["model"] == model


def test_fill_trade_with_null_volume_fills_nothing():
    t = ctrade(0.30, volcum=None, vol=None)
    t["volcum_24h"] = None
    t["vol_24h"] = None
    assert cap.fill_for_trade(t, 50)["filled"] == 0.0
    assert cap.fill_for_trade(t, 50, model="taker")["filled"] == 0.0
    assert cap.fill_for_trade(t, 50, model="cross")["filled"] == 0.0


# ── capacity_curve ─────────────────────────────────────────────────────

def test_capacity_curve_excludes_trades_below_threshold():
    trades = [ctrade(0.30, gap=0.05, volcum=10_000),
              ctrade(0.40, gap=0.20, volcum=10_000),
              ctrade(0.35, side="NO", result="no", gap=-0.15, volcum=10_000)]
    row = cap.capacity_curve(trades, [100])[0]
    # |gap| >= 0.10 keeps the 0.20 and the -0.15 rows, drops the 0.05 row.
    assert row["n_filled"] == 2 and row["n_partial"] == 0
    assert row["net"] == pytest.approx((60.0 - 0.03 * 60.0) + (65.0 - 0.03 * 65.0))
    assert row["gross"] == pytest.approx(60.0 + 65.0)
    assert row["capital"] == pytest.approx(100 * 0.40 + 100 * 0.35)
    assert row["roi"] == pytest.approx(row["net"] / row["capital"])
    assert row["avg_slippage"] == 0.0
    assert cap.capacity_curve(trades, [100], threshold=0.0)[0]["n_filled"] == 3


def test_capacity_curve_keys_and_empty_selection():
    row = cap.capacity_curve([ctrade(0.30, gap=0.3)], [100])[0]
    assert set(row) == {"size", "n_filled", "n_partial", "net", "gross",
                        "capital", "roi", "avg_slippage"}
    assert row["n_filled"] == 0 and row["net"] == 0.0 and row["capital"] == 0.0
    assert row["roi"] is None and row["avg_slippage"] == 0.0


def test_capacity_curve_partial_fills_and_capital():
    trades = [ctrade(0.30, gap=0.30, volcum=200),   # budget 20 < size 100
              ctrade(0.40, gap=0.30, volcum=100_000)]
    row = cap.capacity_curve(trades, [100])[0]
    assert row["n_filled"] == 2 and row["n_partial"] == 1
    assert row["net"] == pytest.approx(20 * (0.70 - 0.03 * 0.70) + 100 * (0.60 - 0.03 * 0.60))
    assert row["capital"] == pytest.approx(20 * 0.30 + 100 * 0.40)


def test_capacity_curve_worked_matches_unbounded_pnl():
    # Budgets far above the order size: the capacity model must reproduce the
    # report's per-trade P&L exactly.
    trades = [ctrade(0.30, gap=0.25, volcum=100_000),
              ctrade(0.70, side="NO", result="yes", gap=0.25, volcum=100_000)]
    row = cap.capacity_curve(trades, [100])[0]
    unlimited = sum(cap.position_pnl(t["side"], t["cost"], t["result"], 100)
                    for t in trades)
    assert row["net"] == pytest.approx(unlimited)


def test_capacity_curve_roi_non_increasing_in_size():
    # Taker model, identical trades: every size walks the same ladder, so the
    # aggregate ROI is the per-trade ROI and must fall as slippage grows.
    trades = [ctrade(0.30, gap=0.25, vol=5_000, volcum=100_000) for _ in range(3)]
    rows = cap.capacity_curve(trades, [50, 200, 300, 400, 500], model="taker")
    rois = [r["roi"] for r in rows]
    assert all(r is not None and r > 0 for r in rois)
    assert all(b <= a + 1e-12 for a, b in zip(rois, rois[1:]))
    assert rois[-1] < rois[0]
    # Worked model: fill price is the posted price at every size.
    worked = cap.capacity_curve(trades, [50, 200, 300, 400, 500], model="worked")
    wrois = [r["roi"] for r in worked]
    assert all(b <= a + 1e-12 for a, b in zip(wrois, wrois[1:]))


def test_capacity_curve_net_bounded_by_unlimited_case():
    trades = [ctrade(0.20, gap=0.30, volcum=100_000, vol=5_000),
              ctrade(0.50, gap=0.30, volcum=100_000, vol=2_000)]
    for model in ("worked", "taker"):
        for row in cap.capacity_curve(trades, [100, 5_000], model=model):
            n = row["size"]
            unlimited_net = sum(cap.position_pnl(t["side"], t["cost"], t["result"], n)
                                for t in trades)
            unlimited_gross = sum(cap.position_pnl(t["side"], t["cost"], t["result"], n,
                                                   fee_model="flat", fee_rate=0.0)
                                  for t in trades)
            assert row["net"] <= unlimited_net + 1e-9
            assert row["gross"] <= unlimited_gross + 1e-9
    # Slippage is only paid on the taker path.
    assert cap.capacity_curve(trades, [5_000], model="worked")[0]["avg_slippage"] == 0.0
    assert cap.capacity_curve(trades, [5_000], model="taker")[0]["avg_slippage"] > 0
