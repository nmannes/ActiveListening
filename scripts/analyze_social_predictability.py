#!/usr/bin/env python
"""
analyze_social_predictability.py — Are a person's recent social posts
predictive of the words they say on a TV appearance?

For every recorded appearance session (s3/<slug>_<ts>/) with:
  - a Kalshi mention-market row (data/mention_markets.jsonl) giving the show's
    candidate words,
  - a guest name (from the market title) whose speaker number is labeled in
    data/speaker_labels.json,
  - cached posts for the guest (social/x-<handle>.jsonl, from fetch_social.py),

reports transition stats: P(word said on show | word in pre-show posts) vs
P(said | not in posts), pooled across sessions, with a lookback-window sweep
(3/7/14/30 days), per-guest aggregation, and a most-predictive-words table.

Word matching mirrors Kalshi resolution rules via pylib/earnings_word_stats
(word boundaries + plural/possessive forms).

Usage:
    PYTHONPATH=. python scripts/analyze_social_predictability.py
    PYTHONPATH=. python scripts/analyze_social_predictability.py --handle "Ro Khanna:rokhanna"
    PYTHONPATH=. python scripts/analyze_social_predictability.py --windows 7,14
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.earnings_word_stats import normalize, word_in_calls, word_in_text  # noqa: E402
from pylib.session_words import (  # noqa: E402
    S3_DIR,
    guest_from_title,
    guest_words,
    iter_sessions,
    load_labels,
    session_date,
    session_slug,
)
from pylib.social_fetcher import SOCIAL_DIR, post_path  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MENTIONS = ROOT / "data" / "mention_markets.jsonl"
OUT_FILE = ROOT / "social-predictability.md"
HANDLES_FILE = SOCIAL_DIR / "handles.json"

WINDOWS = [3, 7, 14, 30]
DEFAULT_WINDOW = 14
JUNK_WORDS = {"event does not qualify"}


def load_mention_rows() -> Dict[str, dict]:
    """Event ticker (upper) → mention row."""
    if not MENTIONS.exists():
        return {}
    out = {}
    for line in MENTIONS.open():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("event_ticker"):
            out[row["event_ticker"].upper()] = row
    return out


def candidate_words(row: dict) -> List[str]:
    words = []
    for m in row.get("markets") or []:
        w = m.get("word")
        if w and w not in JUNK_WORDS:
            words.append(w)
    return sorted(set(words))


def load_handles(cli_overrides: Dict[str, str]) -> Dict[str, str]:
    handles: Dict[str, str] = {}
    if HANDLES_FILE.exists():
        try:
            handles.update(json.loads(HANDLES_FILE.read_text()))
        except (json.JSONDecodeError, OSError):
            pass
    handles.update(cli_overrides)
    return handles


def load_posts(handle: str) -> List[dict]:
    path = post_path(handle)
    if not path.exists():
        return []
    posts = []
    for line in path.open():
        if not line.strip():
            continue
        try:
            p = json.loads(line)
        except json.JSONDecodeError:
            continue
        try:
            p["_dt"] = datetime.fromisoformat(p["created_at"])
            if p["_dt"].tzinfo is None:
                p["_dt"] = p["_dt"].replace(tzinfo=timezone.utc)
        except (KeyError, ValueError):
            continue
        posts.append(p)
    return posts


def pre_show_posts(posts: List[dict], show_date: date, window_days: int) -> List[dict]:
    """Posts in [show_date - window, show_date), i.e. strictly before the show."""
    if not posts:
        return []
    end = datetime.combine(show_date, time.min, tzinfo=timezone.utc)
    start = end - timedelta(days=window_days)
    return [p for p in posts if start <= p["_dt"] < end]


def transition_stats(examples: List[dict]) -> dict:
    """Pooled transition stats over (posts_texts, show_text, words) examples.

    Returns None-guardable counts; p_in/p_not are conditional on the word
    appearing (or not) in the pre-show posts.
    """
    in_total = in_said = notin_total = notin_said = 0
    for ex in examples:
        posts_texts = ex["posts_texts"]
        show_text = ex["show_text"]
        for word in ex["words"]:
            if word_in_calls(word, posts_texts) > 0:
                in_total += 1
                in_said += word_in_text(word, show_text)
            else:
                notin_total += 1
                notin_said += word_in_text(word, show_text)
    n = in_total + notin_total
    p_in = in_said / in_total if in_total else None
    p_not = notin_said / notin_total if notin_total else None
    base = (in_said + notin_said) / n if n else None
    if p_in is not None and p_not is not None:
        lift = p_in / p_not if p_not else float("inf")
    else:
        lift = None
    return {"words": n, "in_total": in_total, "in_said": in_said,
            "notin_total": notin_total, "notin_said": notin_said,
            "p_in": p_in, "p_not": p_not, "base": base, "lift": lift}


def per_word_stats(examples: List[dict]) -> List[dict]:
    """Same pooling, per normalized word, for the most-predictive-words table."""
    acc: Dict[str, dict] = defaultdict(lambda: {"in_total": 0, "in_said": 0,
                                                "notin_total": 0, "notin_said": 0,
                                                "n": 0})
    for ex in examples:
        show_text = ex["show_text"]
        for word in ex["words"]:
            key = normalize(word)
            a = acc[key]
            a["n"] += 1
            if word_in_calls(word, ex["posts_texts"]) > 0:
                a["in_total"] += 1
                a["in_said"] += word_in_text(word, show_text)
            else:
                a["notin_total"] += 1
                a["notin_said"] += word_in_text(word, show_text)
    rows = []
    for key, a in acc.items():
        p_in = a["in_said"] / a["in_total"] if a["in_total"] else None
        p_not = a["notin_said"] / a["notin_total"] if a["notin_total"] else None
        rows.append({"word": key, **a, "p_in": p_in, "p_not": p_not,
                     "delta": (p_in - p_not) if (p_in is not None and p_not is not None)
                     else None})
    rows.sort(key=lambda r: (-(r["delta"] if r["delta"] is not None else -1.0), -r["n"]))
    return rows


def fmt_pct(p) -> str:
    return f"{100 * p:.0f}%" if p is not None else "-"


def fmt_lift(x) -> str:
    if x is None:
        return "-"
    if x == float("inf"):
        return "∞"
    return f"{x:.2f}x"


def build_report(args) -> Tuple[str, dict]:
    rows = load_mention_rows()
    labels = load_labels()
    handles = load_handles(args.handle_map)
    windows = args.windows

    sessions = []          # usable (guest, session) examples
    gaps = defaultdict(int)  # skip reason → count
    seen = set()           # dedupe (guest, event) — keep the first labeled session

    for sdir in iter_sessions():
        slug = session_slug(sdir.name)
        row = rows.get((slug or "").upper()) if slug else None
        if row is None:
            continue  # not a mention-series session
        guest = guest_from_title(row.get("title") or "")
        if not guest:
            gaps["no guest name in title"] += 1
            continue
        key = (guest.lower(), row["event_ticker"].upper())
        if key in seen:
            continue
        seen.add(key)
        words = guest_words(sdir, labels, guest)
        if words is None:
            gaps["guest speaker not labeled"] += 1
            continue
        handle = handles.get(guest)
        if not handle:
            gaps["no handle mapped"] += 1
            continue
        posts = load_posts(handle)
        show_date = row.get("show_date") or session_date(sdir.name)
        if not show_date:
            gaps["no show date"] += 1
            continue
        show_date = date.fromisoformat(show_date)
        cwords = candidate_words(row)
        if not cwords:
            gaps["no candidate words"] += 1
            continue
        sessions.append({"guest": guest, "event": row["event_ticker"],
                         "slug": slug, "sdir": sdir.name,
                         "show_date": show_date, "posts": posts,
                         "cwords": cwords, "words_said": words,
                         "show_text": " ".join(words), "handle": handle})

    stats_by_window = {}
    for w in windows:
        examples = []
        for s in sessions:
            preshow = pre_show_posts(s["posts"], s["show_date"], w)
            examples.append({"posts_texts": [p["text"] for p in preshow],
                             "show_text": s["show_text"], "words": s["cwords"]})
        stats_by_window[w] = transition_stats(examples)

    d = DEFAULT_WINDOW if DEFAULT_WINDOW in windows else windows[0]
    examples = [{"posts_texts": [p["text"] for p in pre_show_posts(s["posts"], s["show_date"], d)],
                 "show_text": s["show_text"], "words": s["cwords"]} for s in sessions]
    per_word = per_word_stats(examples)

    lines = ["# Social Predictability", "",
             f"Generated {date.today().isoformat()}",
             "",
             "## Method", "",
             "For each recorded appearance session with (a) a Kalshi mention "
             "market row, (b) the guest's speaker labeled in "
             "`data/speaker_labels.json`, and (c) cached X posts for the "
             "guest (`social/x-<handle>.jsonl`): take the show's candidate "
             "words (the event's Kalshi markets) and compare each word's "
             "presence in the guest's pre-show posts (lookback window) with "
             "whether the guest actually said it on the show. Word matching "
             "follows Kalshi resolution rules (word boundaries, "
             "plural/possessive forms).", ""]

    lines += ["## Coverage", "",
              f"- mention sessions recorded: {len(seen)} unique "
              f"(guest, event) pairs" if len(seen) else "- no mention sessions found",
              f"- usable in this analysis: {len(sessions)}"]
    for reason, n in sorted(gaps.items(), key=lambda x: -x[1]):
        lines.append(f"- skipped — {reason}: {n}")
    if not sessions:
        lines += ["",
                  "Nothing to analyze yet. Fetch posts with `./bin/kalshi social "
                  "fetch <handle>`, label guest speakers with "
                  "`scripts/label_speaker.py`, then re-run."]
        return "\n".join(lines).rstrip() + "\n", {"sessions": sessions,
                                                  "stats_by_window": stats_by_window,
                                                  "per_word": per_word, "gaps": gaps}

    lines += ["", "## Aggregate transitions (lookback window sweep)", "",
              "P(word said on show | word in pre-show posts) vs P(said | not in "
              "posts). Lift = P(said | in posts) ÷ P(said | not in posts).", "",
              "| Window | Words | In posts | Said | P(said \\| in) | Not in posts | Said | P(said \\| not) | Base | Lift |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for w in windows:
        s = stats_by_window[w]
        lines.append(f"| {w}d | {s['words']} | {s['in_total']} | {s['in_said']} | "
                     f"{fmt_pct(s['p_in'])} | {s['notin_total']} | {s['notin_said']} | "
                     f"{fmt_pct(s['p_not'])} | {fmt_pct(s['base'])} | {fmt_lift(s['lift'])} |")
    lines.append("")

    lines += ["## Per guest", "",
              "| Guest | Sessions | Words | In posts | P(said \\| in) | P(said \\| not) | Lift |",
              "|---|---|---|---|---|---|---|"]
    by_guest = defaultdict(list)
    for s in sessions:
        by_guest[s["guest"]].append(s)
    for guest in sorted(by_guest):
        ex = [{"posts_texts": [p["text"] for p in pre_show_posts(s["posts"], s["show_date"], d)],
               "show_text": s["show_text"], "words": s["cwords"]} for s in by_guest[guest]]
        st = transition_stats(ex)
        lines.append(f"| {guest} | {len(ex)} | {st['words']} | {st['in_total']} | "
                     f"{fmt_pct(st['p_in'])} | {fmt_pct(st['p_not'])} | "
                     f"{fmt_lift(st['lift'])} |")
    lines.append("")

    lines += ["## Most predictive words", "",
              "Pooled across sessions at the default window; delta = P(said \\| in posts) "
              "− P(said \\| not in posts).", "",
              "| Word | Sessions | In posts | P(said \\| in) | P(said \\| not) | Delta |",
              "|---|---|---|---|---|---|"]
    for r in per_word[:50]:
        delta = f"{r['delta']:+.2f}" if r["delta"] is not None else "-"
        lines.append(f"| {r['word']} | {r['n']} | {r['in_total']} | "
                     f"{fmt_pct(r['p_in'])} | {fmt_pct(r['p_not'])} | {delta} |")
    lines.append("")

    lines += ["## Sessions", "",
              "| Date | Guest | Event | Posts in window | Words on show | Said words |",
              "|---|---|---|---|---|---|"]
    for s in sorted(sessions, key=lambda s: s["show_date"]):
        n_posts = len(pre_show_posts(s["posts"], s["show_date"], d))
        said = [w for w in s["cwords"] if word_in_text(w, s["show_text"])]
        lines.append(f"| {s['show_date']} | {s['guest']} | {s['slug']} | {n_posts} | "
                     f"{len(s['cwords'])} | {len(said)} · " + ", ".join(said[:8]) + " |")
    lines.append("")
    return "\n".join(lines).rstrip() + "\n", {"sessions": sessions,
                                              "stats_by_window": stats_by_window,
                                              "per_word": per_word, "gaps": gaps}


def main():
    ap = argparse.ArgumentParser(
        description="Analyze whether social posts predict words said on TV appearances",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--windows", default=",".join(str(w) for w in WINDOWS),
                    help="Comma-separated pre-show lookback windows (days)")
    ap.add_argument("--handle", action="append", default=[], metavar="NAME:HANDLE",
                    help="Guest name → X handle mapping (repeatable; overrides "
                         "social/handles.json)")
    ap.add_argument("--out", type=Path, default=OUT_FILE, help="Output markdown path")
    args = ap.parse_args()
    args.windows = [int(w) for w in args.windows.split(",") if w.strip()]
    args.handle_map = {}
    for h in args.handle:
        if ":" in h:
            name, handle = h.split(":", 1)
            args.handle_map[name.strip()] = handle.strip()

    text, info = build_report(args)
    args.out.write_text(text)
    print(f"Wrote {args.out}")

    sessions = info["sessions"]
    print(f"{len(sessions)} usable (guest, session) pairs")
    for reason, n in sorted(info["gaps"].items(), key=lambda x: -x[1]):
        print(f"  skipped — {reason}: {n}")
    for w, st in info["stats_by_window"].items():
        print(f"{w}d window: {st['words']} words · P(said|in) {fmt_pct(st['p_in'])} "
              f"vs P(said|not) {fmt_pct(st['p_not'])} · lift {fmt_lift(st['lift'])}")


if __name__ == "__main__":
    main()
