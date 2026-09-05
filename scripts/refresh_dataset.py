#!/usr/bin/env python
"""
refresh_dataset.py — Hourly earnings-dataset refresh with change gating.

Every invocation runs fetch_earnings_mentions.py first (~3 min of paced
Kalshi API calls) — it is the change detector: new series, new markets, and
new settlement results all land in data/earnings_mentions.jsonl. If the
mentions data differs from the last run, the full chain runs:

    from-markets transcripts (full history) → watchlist transcripts (S&P 500)
    → market history → earnings report → backtest

If nothing changed, the chain is skipped entirely — unless the last full
chain ran more than FULL_MAX_AGE_H hours ago (safety net: transcripts can
appear on stockanalysis.com with no Kalshi-side signal, and the watchlist
head-start only works if we sweep it periodically).

State lives in data/refresh_state.json: {mentions_fp, last_full_ts}. Quiet
hours cost ~3 minutes of API pacing instead of ~25 minutes of scraping.

Usage:
    PYTHONPATH=. python scripts/refresh_dataset.py
    PYTHONPATH=. python scripts/refresh_dataset.py --full   # force the chain
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MENTIONS = ROOT / "data" / "earnings_mentions.jsonl"
STATE_FILE = ROOT / "data" / "refresh_state.json"
FULL_MAX_AGE_H = 24

STEPS = {
    "mentions": ["scripts/fetch_earnings_mentions.py"],
    "from-markets": ["scripts/fetch_transcripts.py", "--from-markets",
                     "--quarters", "100"],
    "watchlist": ["scripts/fetch_transcripts.py", "--watchlist",
                  "--quarters", "8"],
    "history": ["scripts/fetch_market_history.py", "--out",
                "data/market_history_leads.jsonl"],
    "report": ["scripts/generate_earnings_report.py"],
    "backtest": ["scripts/backtest_earnings_report.py"],
}

FULL_STEPS = ["from-markets", "watchlist", "history", "report", "backtest"]


def run(step: str) -> bool:
    cmd = [sys.executable] + STEPS[step]
    print(f"\n=== {step}: {' '.join(cmd)} ===", flush=True)
    env = {**os.environ, "PYTHONPATH": "."}
    return subprocess.run(cmd, cwd=str(ROOT), env=env).returncode == 0


def mentions_fingerprint(path: Path) -> str:
    """sha256 over a distilled, sorted view of the mentions file — stable
    across runs when the underlying Kalshi data is unchanged (API noise in
    unrelated fields can't flap the fingerprint)."""
    rows = []
    for line in path.open():
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        markets = tuple(sorted(
            (m.get("ticker"), m.get("word"), m.get("result"), m.get("status"))
            for m in ev.get("markets") or []))
        rows.append((ev.get("event_ticker"), ev.get("series_ticker"),
                     ev.get("call_date"), markets))
    h = hashlib.sha256()
    for r in sorted(rows):
        h.update(json.dumps(r, sort_keys=True).encode())
    return h.hexdigest()


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(STATE_FILE.parent), suffix=".tmp")
    with os.fdopen(fd, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_FILE)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--full", action="store_true",
                    help="Run the full chain regardless of change detection")
    args = ap.parse_args()

    state = load_state()
    now = datetime.now(timezone.utc).timestamp()

    mentions_ok = run("mentions")
    fp = mentions_fingerprint(MENTIONS) if MENTIONS.exists() else None

    prev_fp = state.get("mentions_fp")
    changed = (not mentions_ok) or (fp is None) or (fp != prev_fp)
    last_full = state.get("last_full_ts") or 0
    due = (now - last_full) > FULL_MAX_AGE_H * 3600
    need_full = args.full or changed or due

    if not need_full:
        hours_since = (now - last_full) / 3600
        print(f"mentions unchanged (fp {prev_fp[:10]}…); last full chain "
              f"{hours_since:.0f}h ago — skipping transcripts/history/report")
    else:
        if args.full:
            print("--full: forcing the full chain")
        elif changed:
            print("mentions changed — running the full chain")
        else:
            print(f"no Kalshi-side change, but last full chain was "
                  f"{(now - last_full) / 3600:.0f}h ago (> {FULL_MAX_AGE_H}h) "
                  f"— running the full chain (transcript-only changes)")
        for step in FULL_STEPS:
            run(step)
        state["last_full_ts"] = now

    state["mentions_fp"] = fp
    save_state(state)
    print(f"\nSaved refresh state to {STATE_FILE} "
          f"(mentions fp {str(fp)[:10]}…, last full chain "
          f"{datetime.fromtimestamp(state.get('last_full_ts', 0), timezone.utc).isoformat()})")


if __name__ == "__main__":
    main()
