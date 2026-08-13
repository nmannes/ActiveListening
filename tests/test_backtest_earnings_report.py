"""Tests for the gap-strategy backtest (scripts/backtest_earnings_report.py)."""

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

import backtest_earnings_report as bt  # noqa: E402


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


# ── pre_event_docs ─────────────────────────────────────────────────────

def test_pre_event_docs_excludes_same_day_and_future():
    docs = [make_transcript("SPOT", "2026-02-10", [("A", "churn")]),
            make_transcript("SPOT", "2026-08-04", [("A", "churn")]),   # same day
            make_transcript("SPOT", "2026-09-01", [("A", "churn")])]   # future
    out = bt.pre_event_docs(docs, "2026-08-04")
    assert [d["call_date"] for d in out] == ["2026-02-10"]


# ── pnl ────────────────────────────────────────────────────────────────

def test_pnl_yes_winner_and_loser():
    gross, net = bt.pnl("YES", 0.60, "yes", 0.03)
    assert gross == 0.40
    assert net == pytest.approx(0.40 * 0.97)  # 3% fee on profit only
    gross, net = bt.pnl("YES", 0.60, "no", 0.03)
    assert gross == -0.60 and net == -0.60  # fee only on profit


def test_pnl_no_winner_and_loser():
    # NO cost 0.40 (= 1 − 0.60 YES): winner pays $1 → profit 0.60
    gross, net = bt.pnl("NO", 0.40, "no", 0.03)
    assert gross == 0.60
    assert net == 0.60 - 0.03 * 0.60
    assert bt.pnl("NO", 0.40, "yes", 0.03) == (-0.40, -0.40)


def test_pnl_no_fee():
    assert bt.pnl("YES", 0.60, "yes", 0.0) == (0.40, 0.40)


# ── simulate ───────────────────────────────────────────────────────────

SPOT_DOCS = [make_transcript("SPOT", "2026-02-10", [("A", "churn improved")]),
             make_transcript("SPOT", "2026-04-28", [("A", "churn is stable")])]


def make_history(price=0.30, ask=None, bid=None, word="Churn", code="SPOT",
                 event="KXEARNINGSMENTIONSPOT-26AUG04", result="yes"):
    return {"ticker": f"{event}-CHURN", "event_ticker": event,
            "series_ticker": "KXEARNINGSMENTION" + code, "code": code,
            "word": word, "result": result, "close_time_iso": "2026-08-04T20:00:00Z",
            "price_24h": price, "yes_ask_24h": ask, "yes_bid_24h": bid}


def test_simulate_buys_yes_when_baseline_above_price():
    trades, coverage = bt.simulate([make_history(price=0.30)], {"SPOT": SPOT_DOCS},
                                   {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                                   0.03, use_ask=False)
    assert len(trades) == 1
    t = trades[0]
    assert t["side"] == "YES" and t["cost"] == 0.30
    assert t["win"] is True and t["pnl_gross"] == 0.70
    assert t["pnl_net"] == 0.70 - 0.03 * 0.70
    assert t["net_yes"] == pytest.approx(0.70 - 0.03 * 0.70)   # always-YES benchmark
    assert t["net_no"] == pytest.approx(-0.70)                 # always-NO benchmark
    assert t["baseline"] > 0.6  # churn in both prior calls, said last call
    assert coverage["n_tradable"] == 1


def test_simulate_skips_without_price():
    trades, coverage = bt.simulate([make_history(price=None)], {"SPOT": SPOT_DOCS},
                                   {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                                   0.03, use_ask=False)
    assert trades == [] and coverage["n_price"] == 0


def test_simulate_skips_without_pre_event_transcripts():
    # no call date for the event → no baseline
    trades, coverage = bt.simulate([make_history()], {"SPOT": SPOT_DOCS}, {},
                                   0.03, use_ask=False)
    assert trades == [] and coverage["n_baseline"] == 0


def test_simulate_no_lookahead_future_transcript():
    # "margin" is said ONLY in a transcript after the event → must not lift baseline
    docs = SPOT_DOCS + [make_transcript("SPOT", "2026-09-01", [("A", "margin is strong")])]
    trades, _ = bt.simulate([make_history(word="Margin", price=0.50)],
                            {"SPOT": docs},
                            {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                            0.03, use_ask=False)
    assert len(trades) == 1
    assert trades[0]["side"] == "NO"          # baseline low (margin never said pre-event)
    assert trades[0]["baseline"] < 0.3


def test_simulate_use_ask():
    trades, _ = bt.simulate([make_history(price=0.30, ask=0.35)],
                            {"SPOT": SPOT_DOCS},
                            {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                            0.03, use_ask=True)
    assert trades[0]["cost"] == 0.35
    assert trades[0]["price"] == 0.35         # edge computed against the ask


def test_simulate_buys_no_when_yes_overpriced():
    # baseline ~0.27 (word never said pre-event): YES at 0.70 is overpriced,
    # NO at 0.30 is undervalued → buy NO
    trades, _ = bt.simulate([make_history(word="Margin", price=0.70)],
                            {"SPOT": SPOT_DOCS},
                            {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                            0.03, use_ask=False)
    assert len(trades) == 1
    t = trades[0]
    assert t["side"] == "NO" and t["cost"] == 0.30
    assert t["baseline"] < 0.3 and t["gap"] > 0.3
    assert t["win"] is False and t["pnl_gross"] == -0.30  # result is "yes"


def test_simulate_skips_when_neither_side_undervalued():
    # baseline ~0.50 (churn in 2 of 3 calls, not last) with bid 0.45 / ask 0.55:
    # YES edge −0.05, NO edge −0.05 → no trade
    docs = SPOT_DOCS + [make_transcript("SPOT", "2026-06-01", [("A", "welcome")])]
    trades, _ = bt.simulate([make_history(price=0.50, ask=0.55, bid=0.45)],
                            {"SPOT": docs},
                            {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                            0.03, use_ask=True)
    assert trades == []


def test_simulate_skips_negative_edge_no_bet():
    # bid missing, ask 0.60, baseline ~0.50, last trade 0.45: the old sign
    # rule (p − ask < 0) would bet NO at 0.55 with NEGATIVE edge; the new
    # rule prices NO off the last trade (edge −0.05) and skips
    docs = SPOT_DOCS + [make_transcript("SPOT", "2026-06-01", [("A", "welcome")])]
    trades, _ = bt.simulate([make_history(price=0.45, ask=0.60)],
                            {"SPOT": docs},
                            {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                            0.03, use_ask=True)
    assert trades == []


def test_simulate_max_price_excludes_expensive_contracts():
    # churn baseline ~0.70 vs YES at 0.65 → YES cost 0.65; cap 0.50 excludes it
    trades, coverage = bt.simulate([make_history(price=0.65)],
                                   {"SPOT": SPOT_DOCS},
                                   {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                                   0.03, use_ask=False, max_price=0.50)
    assert trades == [] and coverage["n_capped"] == 1
    trades, coverage = bt.simulate([make_history(price=0.65)],
                                   {"SPOT": SPOT_DOCS},
                                   {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                                   0.03, use_ask=False, max_price=0.70)
    assert len(trades) == 1 and coverage["n_capped"] == 0


def test_simulate_max_price_applies_to_no_side():
    # margin baseline ~0.27 vs YES at 0.30 → NO cost 0.70; cap 0.50 excludes it
    trades, coverage = bt.simulate([make_history(word="Margin", price=0.30)],
                                   {"SPOT": SPOT_DOCS},
                                   {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                                   0.03, use_ask=False, max_price=0.50)
    assert trades == [] and coverage["n_capped"] == 1
    trades, _ = bt.simulate([make_history(word="Margin", price=0.30)],
                            {"SPOT": SPOT_DOCS},
                            {"KXEARNINGSMENTIONSPOT-26AUG04": "2026-08-04"},
                            0.03, use_ask=False, max_price=0.70)
    assert len(trades) == 1 and trades[0]["side"] == "NO" and trades[0]["cost"] == 0.70


def test_sweep_benchmarks():
    trades = [
        {"gap": 0.15, "side": "YES", "win": True, "pnl_gross": 0.40,
         "pnl_net": 0.388, "net_yes": 0.388, "net_no": -0.60},
        {"gap": -0.20, "side": "NO", "win": True, "pnl_gross": 0.60,
         "pnl_net": 0.582, "net_yes": -0.40, "net_no": 0.582},
        {"gap": 0.05, "side": "YES", "win": False, "pnl_gross": -0.70,
         "pnl_net": -0.70, "net_yes": -0.70, "net_no": 0.30},
    ]
    rows = bt.sweep(trades, [0.00, 0.10])
    r0 = rows[0]  # threshold 0: all 3
    assert r0["n"] == 3
    assert r0["net"] == pytest.approx(0.388 + 0.582 - 0.70)
    assert r0["net_yes"] == pytest.approx(0.388 - 0.40 - 0.70)
    assert r0["net_no"] == pytest.approx(-0.60 + 0.582 + 0.30)
    r1 = rows[1]  # |gap| >= 0.10: first two only
    assert r1["n"] == 2
    assert r1["net"] == pytest.approx(0.388 + 0.582)
