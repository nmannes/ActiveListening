"""Tests for the earnings report generator (scripts/generate_earnings_report.py)."""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from pylib.earnings_word_stats import (  # noqa: E402
    baseline_probability,
    word_in_calls,
    word_in_text,
)
import generate_earnings_report as report  # noqa: E402


# ── shared stats helpers ────────────────────────────────────────────────

def test_word_recurrence_plural():
    # Kalshi resolves YES for plural/possessive forms
    assert word_in_text("Message", "we shipped Messages to everyone")
    assert word_in_text("Spotify", "Spotify's ARPU improved")
    assert not word_in_text("churn", "no mention of it at all")
    # variant splitting
    assert word_in_text("Gross Margin/Profit", "our profit margin expanded")


def test_baseline_probability():
    assert baseline_probability(0, 0, False) is None  # no history
    # word in every prior call + said last call → anchored high
    assert baseline_probability(7, 7, True) > 0.75
    # never said → anchored low
    assert baseline_probability(0, 7, False) < 0.2
    # said-last-call status boosts the same presence evidence
    assert baseline_probability(1, 1, True) > baseline_probability(1, 1, False)


# ── upcoming markets ────────────────────────────────────────────────────

def test_event_date_from_leg():
    # Kalshi event dates are YYMMMDD: 26AUG06 = 2026-08-06
    assert report.event_date_from_leg("KXEARNINGSMENTIONNBIS-26AUG06-VERA") == "2026-08-06"
    assert report.event_date_from_leg("KXEARNINGSMENTIONDIS-26MAY06-X") == "2026-05-06"
    assert report.event_date_from_leg("KXEARNINGSMENTIONSPOT-26AUG04-RETA") == "2026-08-04"
    assert report.event_date_from_leg("not-a-leg") is None


# ── live prices ─────────────────────────────────────────────────────────

def test_fetch_live_prices(monkeypatch):
    def fake_api_get(path):
        assert "KXEARNINGSMENTIONSPOT" in path
        return {"markets": [
            {"status": "active", "last_price_dollars": "0.71",
             "custom_strike": {"Word": "Churn"}},
            {"status": "active", "last_price_dollars": "0.30",
             "custom_strike": {"Word": "Retain / Retention"}},
            {"status": "active", "last_price_dollars": "0.00",
             "custom_strike": {"Word": "Ghost"}},
            {"status": "finalized", "last_price_dollars": "0.99",
             "custom_strike": {"Word": "Old"}},
        ]}
    monkeypatch.setattr(report, "api_get", fake_api_get)

    out = report.fetch_live_prices(["SPOT"])
    assert out["SPOT"]["churn"] == (0.71, 0.29)          # NO = 1.00 − YES
    assert out["SPOT"]["retain"] == (0.30, 0.70)         # variant splitting
    assert out["SPOT"]["retention"] == (0.30, 0.70)
    assert "ghost" not in out["SPOT"]                     # $0.00 = never traded
    assert "old" not in out["SPOT"]                       # settled markets excluded


def test_word_prices_picks_cheapest_variant():
    # variants of a merged word are the same bet — the best fill wins
    prices = {"message": (0.60, 0.40), "messages": (0.55, 0.45)}
    assert report.word_prices("Message / Messages", prices) == (0.55, 0.45)
    assert report.word_prices("Message", prices) == (0.60, 0.40)
    assert report.word_prices("Ghost", prices) == (None, None)


def test_fetch_live_prices_api_error(monkeypatch):
    def boom(path):
        raise ConnectionError("kalshi down")
    monkeypatch.setattr(report, "api_get", boom)
    assert report.fetch_live_prices(["SPOT"]) == {}


# ── report generation ───────────────────────────────────────────────────

def make_transcript(ticker, company, call_date, q, y, texts, roles=None):
    utterances = []
    start = 0.0
    for speaker, text in texts:
        end = start + 10.0 + len(text) / 10.0
        utterances.append({"speaker": speaker, "text": text,
                           "start_sec": start, "end_sec": end})
        start = end
    return {"ticker": ticker, "company": company, "call_date": call_date,
            "fiscal_quarter": q, "fiscal_year": y, "url": "https://example.test",
            "source": "test", "roles": roles or {}, "utterances": utterances}


SPOT_CALLS = [
    make_transcript("SPOT", "Spotify", "2026-02-10", 4, 2025,
                    [("Alex Norström", "we talked about churn and monetization")]),
    make_transcript("SPOT", "Spotify", "2026-04-28", 1, 2026,
                    [("Alex Norström", "churn improved and retention grew")]),
    make_transcript("SPOT", "Spotify", "2026-08-04", 2, 2026,
                    [("Operator", "welcome"),
                     ("Alex Norström", "churn is stable and monetization and retention remain our focus"),
                     ("Bryan Goldberg", "subscribers passed three hundred million")],
                    roles={"Alex Norström": "Co-CEO"}),
]


def write_transcripts(tdir: Path, calls_by_ticker: dict):
    for ticker, calls in calls_by_ticker.items():
        d = tdir / ticker
        d.mkdir(parents=True)
        for c in calls:
            (d / f"{ticker}-{c['call_date']}.json").write_text(json.dumps(c))


def test_report_structure(tmp_path, monkeypatch):
    tdir = tmp_path / "transcripts"
    write_transcripts(tdir, {"SPOT": SPOT_CALLS})

    monkeypatch.setattr(report, "TRANSCRIPTS_DIR", tdir)
    monkeypatch.setattr(report, "upcoming_markets", lambda: {
        "SPOT": {"words": ["Churn", "Margin"],
                 "title": "What will Spotify say during their next earnings call?",
                 "event_date": "2027-01-15"},
        "TOST": {"words": ["Restaurants"],
                 "title": "What will Toast say during their next earnings call?",
                 "event_date": None},
    })
    monkeypatch.setattr(report, "fetch_live_prices",
                        lambda codes: {"SPOT": {"churn": (0.60, 0.40)}})

    text, upcoming, docs, live = report.build_report()

    # header + method; undated markets (TOST) are excluded — no event date means
    # the pre-event transcript filter can't be applied
    assert text.startswith("# Earnings Report\n")
    assert "1 company with upcoming word markets · 2 words" in text
    assert "Aggregate transitions over all upcoming words" in text
    assert "lack transcript history" not in text

    # opportunities: churn has both baseline and market → gap +11; Margin has no market
    assert "| SPOT | Churn | 71% | $0.60 | +11 |" in text
    assert "Margin" not in text.split("## Opportunities")[1].split("## Spotify")[0]

    # company with transcripts: full table
    assert "## Spotify (SPOT)" in text
    assert "**Upcoming event:** 2027-01-15" in text
    assert "| Churn | 2/2 | 71% | $0.60 | **Strong YES** |" in text
    assert "| Margin | 0/2 | 25% | - | **Unlikely** |" in text

    # undated market dropped entirely
    assert "## Toast (TOST)" not in text


def test_report_merges_market_slug_aliases(tmp_path, monkeypatch):
    """Aliases sharing a market slug (one Kalshi market whose word was split
    on "/" when the cache was built) render as one joined row."""
    tdir = tmp_path / "transcripts"
    write_transcripts(tdir, {"SPOT": SPOT_CALLS})
    cache = tmp_path / "markets.json"
    cache.write_text(json.dumps([{
        "title": "What will Spotify say during their next earnings call?",
        "keywords": {"autonomous": "KXEARNINGSMENTIONSPOT-27JAN15-AUTO",
                     "automation": "KXEARNINGSMENTIONSPOT-27JAN15-AUTO",
                     "churn": "KXEARNINGSMENTIONSPOT-27JAN15-CHUR"},
    }]))
    monkeypatch.setattr(report, "TRANSCRIPTS_DIR", tdir)
    monkeypatch.setattr(report, "_MARKET_CACHE_FILES", [str(cache)])
    monkeypatch.setattr(report, "fetch_live_prices", lambda codes: {})

    text, upcoming, _, _ = report.build_report()

    assert upcoming["SPOT"]["words"] == ["autonomous / automation", "churn"]
    company = text.split("## Spotify (SPOT)")[1]
    assert "| autonomous / automation |" in company
    assert "| autonomous |" not in company
    assert "| automation |" not in company


def test_event_call_transcript_cannot_leak_into_baseline(tmp_path, monkeypatch):
    """A transcript dated on/after the event (the answer) must not move the
    baseline — it would mean predicting the call from the call itself."""
    tdir = tmp_path / "transcripts"
    calls = SPOT_CALLS + [make_transcript(
        "SPOT", "Spotify", "2027-01-15", 3, 2026,
        [("Alex Norström", "the answer is churn and nothing else")])]
    write_transcripts(tdir, {"SPOT": calls})
    monkeypatch.setattr(report, "TRANSCRIPTS_DIR", tdir)
    monkeypatch.setattr(report, "upcoming_markets", lambda: {
        "SPOT": {"words": ["Churn"], "title": "t", "event_date": "2027-01-15"}})
    monkeypatch.setattr(report, "fetch_live_prices", lambda codes: {})

    text, _, _, _ = report.build_report()

    # baseline from the 3 pre-event calls only: 2/2 present, said last call → 71%.
    # Leaking the event call would lift it to 75% (3/3 present, said last call).
    assert "| Churn | 2/2 | 71% |" in text
    assert "75%" not in text


def test_stale_markets_excluded(tmp_path, monkeypatch):
    """A market whose event has passed is resolved-by-information: the report
    must not list it as an opportunity."""
    tdir = tmp_path / "transcripts"
    write_transcripts(tdir, {"SPOT": SPOT_CALLS})
    monkeypatch.setattr(report, "TRANSCRIPTS_DIR", tdir)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    monkeypatch.setattr(report, "upcoming_markets", lambda: {
        "SPOT": {"words": ["Churn"], "title": "t", "event_date": yesterday}})
    monkeypatch.setattr(report, "fetch_live_prices", lambda codes: {})

    text, upcoming, _, _ = report.build_report()

    assert upcoming == {}
    assert "## Spotify" not in text
    assert "Opportunities" not in text
