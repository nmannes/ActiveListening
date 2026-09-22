"""Tests for the fill-realistic earnings backtest
(scripts/backtest_earnings_fills.py).

The module's whole claim is that the entry price is the price a taker order
would have paid, so most of these tests pin the routing from a quote to a
cost: YES pays the ask, NO pays 1 − bid, and a quote the baseline sits inside
trades nothing.
"""

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import backtest_earnings_fills as btf  # noqa: E402

LEAD = 24
EVENT = "KXEARNINGSMENTIONSPOT-26AUG04"
CALLS = {EVENT: "2026-08-04"}


def make_transcript(ticker, call_date, texts):
    utterances = []
    start = 0.0
    for speaker, text in texts:
        end = start + 10.0 + len(text) / 10.0
        utterances.append({"speaker": speaker, "text": text,
                           "start_sec": start, "end_sec": end})
        start = end
    return {"ticker": ticker, "company": "Test Co", "call_date": call_date,
            "fiscal_quarter": 1, "fiscal_year": 2026, "url": "https://example.test",
            "source": "test", "roles": {}, "utterances": utterances}


# Two pre-event calls, both saying "churn": p ≈ 0.67. "Widget" is never said:
# p ≈ 0.27. Both are far enough from the quotes below that the side choice does
# not hinge on the exact baseline value.
DOCS = {"SPOT": [make_transcript("SPOT", "2026-02-10", [("A", "churn improved")]),
                 make_transcript("SPOT", "2026-04-28", [("A", "churn is stable")])]}


def baseline_p(word):
    _, _, _, p = btf.word_baseline(word, DOCS["SPOT"], code="SPOT",
                                   presence=None, full_docs=DOCS["SPOT"])
    return p


def make_history(ask, bid, vol, result="yes", word="Churn", code="SPOT",
                 lead=LEAD, close="2026-08-04T20:00:00Z"):
    row = {"ticker": f"{EVENT}-{word.upper()}", "event_ticker": EVENT,
           "series_ticker": "KXEARNINGSMENTION" + code, "code": code,
           "word": word, "result": result, "close_time_iso": close}
    row[f"yes_ask_{lead}h"] = ask
    row[f"yes_bid_{lead}h"] = bid
    row[f"vol_{lead}h"] = vol
    return row


def run(history, require_traded=True, **kw):
    return btf.simulate(history, DOCS, CALLS, LEAD, None,
                        require_traded=require_traded, **kw)


# ── entry_quote / entry_volume ─────────────────────────────────────────

def test_entry_quote_reads_ask_and_bid():
    assert btf.entry_quote({"yes_ask_24h": 0.5, "yes_bid_24h": 0.4}, 24) == (0.5, 0.4)


def test_entry_quote_rejects_zero_ask():
    # ask == 0 means an empty offer side: you cannot buy YES from nobody.
    assert btf.entry_quote({"yes_ask_24h": 0.0, "yes_bid_24h": 0.0}, 24) is None


def test_entry_quote_rejects_crossed_book():
    assert btf.entry_quote({"yes_ask_24h": 0.3, "yes_bid_24h": 0.4}, 24) is None


def test_entry_quote_rejects_missing_side():
    assert btf.entry_quote({"yes_bid_24h": 0.4}, 24) is None
    assert btf.entry_quote({}, 24) is None


def test_entry_quote_allows_zero_bid():
    # No buyers is a real state; it only makes the NO side unaffordable.
    assert btf.entry_quote({"yes_ask_24h": 0.4, "yes_bid_24h": 0.0}, 24) == (0.4, 0.0)


def test_entry_volume_treats_unknown_as_zero():
    assert btf.entry_volume({"vol_24h": None}, 24) == 0.0
    assert btf.entry_volume({}, 24) == 0.0
    assert btf.entry_volume({"vol_24h": 12}, 24) == 12.0


# ── side selection and cost ────────────────────────────────────────────

def test_yes_side_pays_the_ask():
    p = baseline_p("Churn")
    trades, cov = run([make_history(ask=0.30, bid=0.25, vol=10)])
    t = trades[0]
    assert t["side"] == "YES"
    assert t["cost"] == 0.30 and t["ask"] == 0.30
    assert t["gap"] == pytest.approx(p - 0.30)
    assert cov["n_quote"] == 1 and cov["n_traded"] == 1 and cov["n_tradable"] == 1


def test_no_side_pays_one_minus_bid():
    p = baseline_p("Widget")
    trades, _ = run([make_history(ask=0.55, bid=0.50, vol=10, word="Widget",
                                  result="no")])
    t = trades[0]
    assert t["side"] == "NO"
    assert t["cost"] == pytest.approx(0.50)          # 1 − bid
    assert t["gap"] == pytest.approx((1 - p) - 0.50)


def test_quote_straddling_the_baseline_trades_nothing():
    # Ask just above P and bid just below: the spread is wider than the edge on
    # either side, so there is no bet.
    p = baseline_p("Churn")
    ask, bid = round(p + 0.02, 2), round(p - 0.02, 2)
    trades, cov = run([make_history(ask=ask, bid=bid, vol=10)])
    assert trades == []
    assert cov["n_quote"] == 1 and cov["n_tradable"] == 0


def test_untraded_candle_is_excluded_from_the_headline():
    h = [make_history(ask=0.30, bid=0.25, vol=0.0)]
    trades, cov = run(h, require_traded=True)
    assert trades == []
    assert cov["n_quote"] == 1 and cov["n_traded"] == 0


def test_untraded_candle_is_kept_on_the_optimistic_basis():
    h = [make_history(ask=0.30, bid=0.25, vol=None)]
    trades, cov = run(h, require_traded=False)
    assert len(trades) == 1
    assert trades[0]["traded"] is False
    assert cov["n_quote"] == 1 and cov["n_traded"] == 0


def test_max_price_cap_excludes_expensive_entries():
    h = [make_history(ask=0.30, bid=0.25, vol=10)]
    trades, cov = run(h, max_price=0.25)
    assert trades == [] and cov["n_capped"] == 1
    trades, _ = run(h, max_price=0.30)
    assert len(trades) == 1


def test_market_without_a_baseline_is_not_tradable():
    h = [make_history(ask=0.30, bid=0.25, vol=10)]
    trades, cov = btf.simulate(h, {}, CALLS, LEAD, None)
    assert trades == [] and cov["n_quote"] == 1 and cov["n_baseline"] == 0


def test_same_day_call_is_not_part_of_the_baseline():
    """The call the market prices must not feed its own baseline."""
    docs = {"SPOT": [make_transcript("SPOT", "2026-08-04", [("A", "churn")])]}
    trades, cov = btf.simulate([make_history(ask=0.30, bid=0.25, vol=10)],
                               docs, CALLS, LEAD, None)
    assert trades == [] and cov["n_baseline"] == 0


# ── fees ───────────────────────────────────────────────────────────────

def test_winner_earns_the_take_and_pays_both_fee_models():
    # 0.30 YES that resolves yes: gross +0.70, flat 3% of profit, taker ceil'd.
    trades, _ = run([make_history(ask=0.30, bid=0.25, vol=10)])
    t = trades[0]
    assert t["pnl_gross"] == pytest.approx(0.70)
    assert t["pnl_net_flat"] == pytest.approx(0.70 * 0.97)
    # 0.07 · 0.30 · 0.70 = 0.0147 → 1.47¢ → ceil to 2¢
    assert t["pnl_net_kalshi"] == pytest.approx(0.70 - 0.02)


def test_loser_pays_the_taker_fee_but_not_the_flat_one():
    trades, _ = run([make_history(ask=0.30, bid=0.25, vol=10, result="no")])
    t = trades[0]
    assert t["pnl_gross"] == pytest.approx(-0.30)
    assert t["pnl_net_flat"] == pytest.approx(-0.30)   # winners-only fee
    assert t["pnl_net_kalshi"] == pytest.approx(-0.32)


def test_fixed_side_nets_are_charged_the_same_fee_as_the_headline():
    # The NO benchmark on a YES candidate must not get the cheaper flat fee.
    _, no_cost = 0.30, 0.75
    nets = btf.fixed_side_nets(0.30, no_cost, "yes", 0.03)
    assert nets["YES"]["flat"] == pytest.approx(0.70 * 0.97)
    assert nets["YES"]["kalshi"] == pytest.approx(0.70 - 0.02)
    assert nets["NO"]["flat"] == pytest.approx(-no_cost)
    assert nets["NO"]["kalshi"] < nets["NO"]["flat"]


# ── sweep ──────────────────────────────────────────────────────────────

def test_sweep_reports_fixed_side_benchmarks_and_edge():
    h = [make_history(ask=0.30, bid=0.25, vol=10, result="yes"),
         make_history(ask=0.55, bid=0.50, vol=10, word="Widget", result="no")]
    trades, _ = run(h)
    row = btf.sweep(trades, [0.10], "kalshi")[0]
    assert row["n"] == 2
    assert row["net"] == pytest.approx(sum(btf.headline_net(t, "kalshi")
                                           for t in trades))
    # Always NO charges 1 − bid on every candidate, including the YES one.
    assert row["net_no"] == pytest.approx(sum(btf.fixed_side_net(t, "NO", "kalshi")
                                              for t in trades))
    assert row["edge_no"] == pytest.approx(row["net"] - row["net_no"])
    assert row["edge_t"] is not None


def test_sweep_threshold_filters_on_the_chosen_side_gap():
    h = [make_history(ask=0.30, bid=0.25, vol=10)]
    trades, _ = run(h)
    assert btf.sweep(trades, [0.10], "kalshi")[0]["n"] == 1
    assert btf.sweep(trades, [0.20], "kalshi")[0]["n"] == 1
    assert btf.sweep(trades, [0.99], "kalshi")[0]["n"] == 0


def test_sweep_headline_fee_model_changes_the_net():
    h = [make_history(ask=0.30, bid=0.25, vol=10, result="yes")]
    trades, _ = run(h)
    kalshi = btf.sweep(trades, [0.10], "kalshi")[0]
    flat = btf.sweep(trades, [0.10], "flat")[0]
    assert kalshi["net"] == pytest.approx(0.68)
    assert flat["net"] == pytest.approx(0.70 * 0.97)


# ── price level ────────────────────────────────────────────────────────

def test_calibration_bands_compare_realized_with_the_mid():
    # Two markets around a 0.50 mid: one resolves yes, one no.
    h = [make_history(ask=0.52, bid=0.48, vol=10, result="yes"),
         make_history(ask=0.52, bid=0.48, vol=10, result="no")]
    rows = btf.calibration_rows(h, LEAD)
    assert len(rows) == 1
    r = rows[0]
    assert r["band"] == "0.40–0.60" and r["n"] == 2
    assert r["realized"] == pytest.approx(0.5)
    assert r["mid"] == pytest.approx(0.50)


def test_calibration_skips_untraded_candles():
    h = [make_history(ask=0.52, bid=0.48, vol=0.0)]
    assert btf.calibration_rows(h, LEAD) == []


def test_benchmarks_price_both_fixed_sides_per_contract():
    h = [make_history(ask=0.60, bid=0.50, vol=10, result="yes"),
         make_history(ask=0.60, bid=0.50, vol=10, result="no")]
    r = btf.benchmark_rows(h, [LEAD])[0]
    assert r["n"] == 2 and r["realized"] == pytest.approx(0.5)
    assert r["mean_ask"] == pytest.approx(0.60)
    # Always YES buys at 0.60: one win of 0.40, one loss of −0.60. Both pay the
    # taker fee — 0.07 · 0.60 · 0.40 = 1.68¢, ceil'd to 2¢ — so the winner nets
    # 0.38 and the loser −0.62.
    assert r["yes_net"] == pytest.approx((0.38 - 0.62) / 2)
    # Always NO buys at 0.50: 0.07 · 0.50 · 0.50 = 1.75¢, likewise 2¢.
    assert r["no_net"] == pytest.approx((0.48 - 0.52) / 2)


def test_benchmarks_skip_leads_with_no_traded_market():
    h = [make_history(ask=0.60, bid=0.50, vol=0.0)]
    assert btf.benchmark_rows(h, [LEAD]) == []


# ── capacity ───────────────────────────────────────────────────────────

def test_capacity_view_rekeys_the_active_lead_volume():
    trades = [{"cost": 0.30, "vol_entry": 40, "volcum": 100}]
    out = btf.capacity_view(trades)
    assert out[0]["vol_24h"] == 40
    assert "vol_entry" in out[0]        # the source row is not mutated away


# ── render ─────────────────────────────────────────────────────────────

def test_render_includes_the_benchmark_sections():
    h = [make_history(ask=0.30, bid=0.25, vol=10, result="yes")]
    trades, cov = run(h)
    text = btf.render(trades, cov, btf.sweep(trades, [0.10], "kalshi"),
                      cal_rows=btf.calibration_rows(h, LEAD),
                      bench_rows=btf.benchmark_rows(h, [LEAD]))
    assert "## Headline" in text
    assert "## Is YES overpriced?" in text
    assert "Always NO" in text
    assert "Kalshi's taker schedule" in text
    assert text.endswith("\n")
