"""
word_presence.py — Disk cache of per-(company, word) call-presence vectors.

The backtest and earnings report both need "did word W appear in call N of
company C" for thousands of (market, word) pairs. Computing it from scratch
re-scans every pre-event transcript's full text per market — the bulk of
backtest runtime. This module caches, per company, a bitstring per word over
that company's full sorted transcript list; callers slice prefixes to get
pre-event windows (a prefix of length k means the event happened after call k).

Invalidation: each company entry stores a fingerprint of its full doc list
(sorted call_date + URL). Any transcript change (new call, backfill) changes
the fingerprint and rebuilds that company's vectors on demand. Baselines only
depend on transcripts before the event, so cached vectors stay valid forever
for a fixed doc list.
"""

import hashlib
import json
from pathlib import Path
from typing import Dict, List, Optional

from pylib.earnings_word_stats import normalize, word_in_text

ROOT = Path(__file__).resolve().parent.parent
PRESENCE_FILE = ROOT / "data" / "word_presence.json"


def transcript_text(d: dict) -> str:
    return " ".join(u.get("text", "") for u in d.get("utterances", []))


def fingerprint(docs: List[dict]) -> str:
    h = hashlib.sha1()
    for d in docs:
        h.update(f"{d.get('call_date')}|{d.get('url', '')}\n".encode())
    return h.hexdigest()


def load_presence(path: Path = PRESENCE_FILE) -> dict:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def save_presence(cache: dict, path: Path = PRESENCE_FILE):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(cache))


def get_presence(cache: dict, code: str, word: str, full_docs: List[dict]) -> List[bool]:
    """Presence vector over full_docs (sorted by call date), building and
    persisting on miss. Result is aligned with full_docs order."""
    fp = fingerprint(full_docs)
    entry = cache.get(code)
    if entry and entry.get("fp") == fp:
        raw = entry.get("words", {}).get(normalize(word))
        if raw is not None:
            return [c == "1" for c in raw]
    if not (entry and entry.get("fp") == fp):
        entry = {"fp": fp, "words": {}}
        cache[code] = entry
    vec = [word_in_text(word, transcript_text(d)) for d in full_docs]
    entry["words"][normalize(word)] = "".join("1" if v else "0" for v in vec)
    return vec
