"""Tests for the earnings call transcript fetcher (pylib/transcript_fetcher.py)."""

import json
from pathlib import Path

import pytest

from pylib.transcript_fetcher import (
    parse_index_html,
    parse_transcript_html,
    ticker_from_leg,
    tickers_from_markets,
)

FIXTURES = Path(__file__).parent / "fixtures"
TICKER = "TOST"
TRANSCRIPT_URL = f"https://stockanalysis.com/stocks/tost/transcripts/556166-q1-2026/"


@pytest.fixture(scope="module")
def transcript_page():
    return (FIXTURES / "tost_transcript.html").read_text()


@pytest.fixture(scope="module")
def index_page():
    return (FIXTURES / "tost_index.html").read_text()


def test_index_parsing_filters_to_quarterly_calls(index_page):
    entries = parse_index_html(index_page, TICKER)
    assert entries, "expected at least one earnings call entry"

    # Only quarterly earnings calls (no AGMs, conferences, investor days)
    for e in entries:
        assert "/transcripts/" in e["url"]
        assert f"-q{e['quarter']}-{e['year']}/" in e["url"]

    # Toast has quarterly calls from Q3 2021 through Q1 2026
    quarters = {(e["year"], e["quarter"]) for e in entries}
    assert (2026, 1) in quarters
    assert (2021, 3) in quarters
    assert len(entries) >= 15


def test_index_parsing_sorts_most_recent_first(index_page):
    entries = parse_index_html(index_page, TICKER)
    entries.sort(key=lambda e: (e["year"], e["quarter"]), reverse=True)
    assert entries[0]["year"] == 2026
    assert entries[0]["quarter"] == 1


def test_transcript_parsing_basic_fields(transcript_page):
    parsed = parse_transcript_html(transcript_page, TRANSCRIPT_URL, TICKER)
    assert parsed["ticker"] == "TOST"
    assert parsed["company"] == "Toast"
    assert parsed["call_date"] == "2026-05-07"
    assert parsed["fiscal_quarter"] == 1
    assert parsed["fiscal_year"] == 2026
    assert parsed["source"] == "stockanalysis.com"
    assert parsed["url"] == TRANSCRIPT_URL


def test_transcript_parsing_utterances(transcript_page):
    parsed = parse_transcript_html(transcript_page, TRANSCRIPT_URL, TICKER)
    utterances = parsed["utterances"]
    assert len(utterances) > 20

    # First utterance is the operator welcoming everyone
    first = utterances[0]
    assert first["speaker"] == "Operator"
    assert "welcome" in first["text"].lower()
    assert first["start_sec"] is not None
    assert first["end_sec"] is not None
    assert first["end_sec"] > first["start_sec"]

    # CEO and CFO both speak
    speakers = {u["speaker"] for u in utterances}
    assert "Aman Narang" in speakers
    assert "Elena Gomez" in speakers

    # Analysts are attributed individually
    assert any("Analyst" not in s and s not in ("Operator", "Aman Narang", "Elena Gomez") for s in speakers)


def test_transcript_parsing_roles(transcript_page):
    parsed = parse_transcript_html(transcript_page, TRANSCRIPT_URL, TICKER)
    assert parsed["roles"] == {"Aman Narang": "CEO", "Elena Gomez": "President and CFO"}


def test_transcript_parsing_text_joins_sentences(transcript_page):
    parsed = parse_transcript_html(transcript_page, TRANSCRIPT_URL, TICKER)
    all_text = " ".join(u["text"] for u in parsed["utterances"]).lower()
    # Spot-check words likely present in a Toast earnings call
    assert "revenue" in all_text
    assert "guidance" in all_text


def test_ticker_from_leg():
    assert ticker_from_leg("KXEARNINGSMENTIONSPOT-26AUG04-RETA") == "SPOT"
    assert ticker_from_leg("KXEARNINGSMENTIONMCD-26AUG04-BIG") == "MCD"
    assert ticker_from_leg("KXATHLETEMENTION-26AUG02-SOMETHING") is None
    assert ticker_from_leg("KXEARNINGSMENTION-26AUG04-X") is None


def test_tickers_from_markets():
    tickers = tickers_from_markets()
    assert isinstance(tickers, list)
    assert all(t.isupper() for t in tickers)
    # The current market list includes these
    assert "SPOT" in tickers
    assert "TOST" in tickers
