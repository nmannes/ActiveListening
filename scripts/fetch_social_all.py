#!/usr/bin/env python
"""
fetch_social_all.py — Fetch X post history for every figure in social/handles.json.

Runs the same resumable per-handle fetch as `kalshi social fetch` over the
whole handle map, so the job can be re-run (or run on a schedule) and each
handle resumes from where it left off. One failing handle (rate limit,
suspended account) doesn't stop the rest.

Each handle stops at the first of: --max-seconds (default 10 min of wall
time), --min-date (default 2024-01-01), or --max-posts (default 1000 most
recent posts), so one prolific account can't hog the whole job. Handles
whose disk already covers the window are refreshed instead: only posts
newer than the newest on disk are fetched.

Usage:
    PYTHONPATH=. python scripts/fetch_social_all.py
    PYTHONPATH=. python scripts/fetch_social_all.py --max-seconds 300 --min-date 2025-01-01 --max-posts 500
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.social_fetcher import fetch_x_history  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
HANDLES_FILE = ROOT / "social" / "handles.json"


def main():
    ap = argparse.ArgumentParser(
        description="Fetch X history for all figures in social/handles.json",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("--max-seconds", type=float, default=600.0,
                    help="Per-handle time cap (seconds)")
    ap.add_argument("--min-date", default="2024-01-01",
                    help="Stop each handle's walk once the search passes "
                         "this date (YYYY-MM-DD)")
    ap.add_argument("--max-posts", type=int, default=1000,
                    help="Stop each handle once this many of its most recent "
                         "posts are on disk")
    args = ap.parse_args()
    handles = json.loads(HANDLES_FILE.read_text())
    for name, handle in handles.items():
        print(f"[social-fetch] {name} ({handle})", flush=True)
        try:
            s = fetch_x_history(handle, max_seconds=args.max_seconds,
                                min_date=args.min_date, max_posts=args.max_posts)
        except Exception as e:  # keep going: other handles may still work
            print(f"[social-fetch] {handle}: ERROR {e}", flush=True)
            continue
        if s.get("already_covered"):
            print(f"[social-fetch] {handle}: already covered (>= {args.min_date} "
                  f"or {args.max_posts} posts), skipping", flush=True)
            continue
        note = " [time-capped]" if s.get("time_capped") else ""
        print(f"[social-fetch] {handle}: +{s['fetched']} "
              f"(dup {s['skipped_duplicates']}, {s.get('elapsed_seconds')}s){note} "
              f"-> {s['file']}", flush=True)
    print("[social-fetch] done", flush=True)


if __name__ == "__main__":
    main()
