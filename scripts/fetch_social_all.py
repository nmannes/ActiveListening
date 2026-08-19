#!/usr/bin/env python
"""
fetch_social_all.py — Fetch X post history for every figure in social/handles.json.

Runs the same resumable per-handle fetch as `kalshi social fetch` over the
whole handle map, so the job can be re-run (or run on a schedule) and each
handle resumes from where it left off. One failing handle (rate limit,
suspended account) doesn't stop the rest.

Usage:
    PYTHONPATH=. python scripts/fetch_social_all.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.social_fetcher import fetch_x_history  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HANDLES_FILE = ROOT / "social" / "handles.json"


def main():
    handles = json.loads(HANDLES_FILE.read_text())
    for name, handle in handles.items():
        print(f"[social-fetch] {name} ({handle})", flush=True)
        try:
            s = fetch_x_history(handle)
        except Exception as e:  # keep going: other handles may still work
            print(f"[social-fetch] {handle}: ERROR {e}", flush=True)
            continue
        print(f"[social-fetch] {handle}: +{s['fetched']} "
              f"(dup {s['skipped_duplicates']}) -> {s['file']}", flush=True)
    print("[social-fetch] done", flush=True)


if __name__ == "__main__":
    main()
