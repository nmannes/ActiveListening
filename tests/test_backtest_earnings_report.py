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
    assert trades[0]["price"] == 0.35         # gap computed against the ask
