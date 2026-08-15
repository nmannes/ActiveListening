"""Tests for the social-posts → media-appearance predictability analysis."""

import json
from datetime import date, datetime, timezone

from pylib.session_words import (
    guest_from_title,
    guest_words,
    session_date,
    session_slug,
    words_by_speaker,
)
from scripts.analyze_social_predictability import (
    pre_show_posts,
    transition_stats,
)


# ── transition stats ────────────────────────────────────────────────────

def test_transition_stats_basic():
    examples = [{
        "posts_texts": ["I support affordable healthcare for every american"],
        "show_text": "healthcare is the cornerstone of our agenda",
        "words": ["healthcare", "election", "shutdown"],
    }]
    s = transition_stats(examples)
    assert s["words"] == 3
    assert s["in_total"] == 1 and s["in_said"] == 1      # healthcare: in posts, said
    assert s["notin_total"] == 2 and s["notin_said"] == 0  # election/shutdown: not said
    assert s["p_in"] == 1.0 and s["p_not"] == 0.0
    assert s["base"] == 1 / 3
    assert s["lift"] == float("inf")


def test_transition_stats_pools_across_examples():
    examples = [
        {"posts_texts": ["war"], "show_text": "war", "words": ["war", "peace"]},
        {"posts_texts": ["peace"], "show_text": "war", "words": ["war", "peace"]},
    ]
    s = transition_stats(examples)
    # war: in posts in ex1 (said), not in ex2 (said) → 1/2
    # peace: not in ex1 (not said), in ex2 (not said) → 0/1
    assert s["in_total"] == 2 and s["in_said"] == 1
    assert s["notin_total"] == 2 and s["notin_said"] == 1
    assert s["p_in"] == 0.5 and s["p_not"] == 0.5 and s["lift"] == 1.0


def test_transition_stats_empty():
    s = transition_stats([])
    assert s["words"] == 0 and s["p_in"] is None and s["p_not"] is None


# ── pre-show window filtering ───────────────────────────────────────────

def _post(created_at):
    return {"created_at": created_at,
            "_dt": datetime.fromisoformat(created_at).replace(tzinfo=timezone.utc)}


def test_pre_show_posts_window():
    show = date(2026, 8, 16)
    posts = [
        _post("2026-08-15T10:00:00+00:00"),   # 1 day before → in (window 7)
        _post("2026-08-10T10:00:00+00:00"),   # 6 days before → in
        _post("2026-08-08T10:00:00+00:00"),   # 8 days before → out (window 7)
        _post("2026-08-16T09:00:00+00:00"),   # show day → out (strictly before)
        _post("2026-08-15T10:00:00+00:00"),   # duplicate-ish, no dedupe here
    ]
    got = pre_show_posts(posts, show, 7)
    assert len(got) == 3
    got30 = pre_show_posts(posts, show, 30)
    assert len(got30) == 4  # only show-day post excluded


# ── session words extraction ────────────────────────────────────────────

def _fake_session(tmp_path, words_by_speaker_data):
    dg = tmp_path / "deepgram_responses"
    dg.mkdir()
    for i, (sid, words) in enumerate(words_by_speaker_data.items()):
        payload = {"channel": {"alternatives": [{
            "words": [{"word": w["word"], "start": w.get("start", 0.0),
                       "speaker": int(sid)} for w in words]}]}}
        (dg / f"dg_{i}.json").write_text(json.dumps(payload))
    return tmp_path


def test_session_slug_and_date():
    assert session_slug("kxmtpmention-26aug16_2026-08-16_14-30-05") == "kxmtpmention-26aug16"
    assert session_date("kxmtpmention-26aug16_2026-08-16_14-30-05") == date(2026, 8, 16)


def test_guest_from_title():
    assert guest_from_title("What will Hakeem Jeffries say during Meet the Press?") \
        == "Hakeem Jeffries"
    assert guest_from_title("What will Donald Trump say during an interview with NBC News?") \
        == "Donald Trump"
    assert guest_from_title("unrelated") is None


def test_words_by_speaker(tmp_path):
    sdir = _fake_session(tmp_path, {
        "0": [{"word": "hello", "start": 1.0}, {"word": "world", "start": 0.5}],
        "1": [{"word": "other", "start": 2.0}],
    })
    out = words_by_speaker(sdir)
    assert sorted(out["0"], key=lambda w: w["start"]) == [
        {"word": "world", "start": 0.5}, {"word": "hello", "start": 1.0}]
    assert [w["word"] for w in out["1"]] == ["other"]


def test_guest_words(tmp_path):
    sdir = _fake_session(tmp_path, {
        "0": [{"word": "hello"}, {"word": "world"}],
        "3": [{"word": "host"}],
    })
    labels = {sdir.name: {"0": "Hakeem Jeffries", "3": "Kristen Welker"}}
    assert guest_words(sdir, labels, "Hakeem Jeffries") == ["hello", "world"]
    assert guest_words(sdir, labels, "Ro Khanna") is None  # not labeled
    assert guest_words(sdir, {}, "Hakeem Jeffries") is None
