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

Progress: children run unbuffered and their stdout is streamed through as it
arrives, so nothing goes dark for the length of a watchlist sweep. On top of
that we emit our own monotonic beat markers,

    [refresh] total_beats=1000
    [refresh] [600/1000] watchlist: 138/506

which the BullMQ worker parses into the job progress bar (see worker.js
spawnWithLogs). Beats are apportioned per step by expected cost, and each
step's slice is filled from the child's own [i/n] progress lines.

Usage:
    PYTHONPATH=. python scripts/refresh_dataset.py
    PYTHONPATH=. python scripts/refresh_dataset.py --full   # force the chain
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
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
    "backtest-fills": ["scripts/backtest_earnings_fills.py"],
}

FULL_STEPS = ["from-markets", "watchlist", "history", "report", "backtest",
              "backtest-fills"]

# Beat budget for the progress bar. Weights are expected cost, not counts, so
# the bar advances at a roughly even rate over a full chain: the watchlist
# sweep (S&P 500, every step resumable) dwarfs everything else on a cold run
# and still dominates on a warm one.
BEATS = {"mentions": 100, "from-markets": 100, "watchlist": 600,
         "history": 150, "report": 25, "backtest": 25, "backtest-fills": 25}
TOTAL_BEATS = sum(BEATS.values())

# Child progress lines that fill each step's slice of the budget.
STEP_PROGRESS = {
    "mentions": re.compile(r"^metadata: (\d+)/(\d+) events"),
    "from-markets": re.compile(r"^\[transcripts\] \[(\d+)/(\d+)\]"),
    "watchlist": re.compile(r"^\[transcripts\] \[(\d+)/(\d+)\]"),
    "history": re.compile(r"^\s+(\d+)/(\d+) \("),
    "backtest-fills": re.compile(r"^\[fills\] \[(\d+)/(\d+)\]"),
}


class Progress:
    """Monotonic beat emitter — the only source of [refresh] [i/n] markers."""

    def __init__(self):
        self.beat = 0
        print(f"[refresh] total_beats={TOTAL_BEATS}", flush=True)

    def advance(self, beat: int, label: str):
        # Clamp: a child's [i/n] can overshoot its slice on a step we mispriced.
        beat = max(self.beat, min(beat, TOTAL_BEATS))
        if beat != self.beat:
            self.beat = beat
        print(f"[refresh] [{self.beat}/{TOTAL_BEATS}] {label}", flush=True)


def fmt_duration(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m{s:02d}s" if m else f"{s}s"


def run(step: str, base_beat: int, prog: Progress) -> bool:
    """Run one step with its output streamed live, advancing the beat budget
    as the child reports its own [i/n] progress."""
    weight = BEATS[step]
    cmd = [sys.executable, "-u"] + STEPS[step]
    env = {**os.environ, "PYTHONPATH": ".", "PYTHONUNBUFFERED": "1"}
    print(f"\n=== {step}: {' '.join(cmd)} ===", flush=True)
    prog.advance(base_beat, f"{step}: starting")

    pattern = STEP_PROGRESS.get(step)
    started = time.monotonic()
    proc = subprocess.Popen(cmd, cwd=str(ROOT), env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                            bufsize=1)
    for line in proc.stdout:
        line = line.rstrip("\n")
        print(line, flush=True)
        if pattern:
            m = pattern.match(line)
            if m:
                done, total = int(m.group(1)), int(m.group(2))
                if total:
                    prog.advance(base_beat + weight * done // total,
                                 f"{step}: {done}/{total}")
    ok = proc.wait() == 0
    elapsed = fmt_duration(time.monotonic() - started)
    prog.advance(base_beat + weight,
                 f"{step}: done in {elapsed}" + ("" if ok else " (FAILED)"))
    return ok


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
    prog = Progress()

    mentions_ok = run("mentions", 0, prog)
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
        # Nothing else runs on a quiet tick, so close out the bar rather than
        # leaving it parked at the end of the mentions slice.
        prog.advance(TOTAL_BEATS, "chain skipped — mentions unchanged")
    else:
        if args.full:
            print("--full: forcing the full chain")
        elif changed:
            print("mentions changed — running the full chain")
        else:
            print(f"no Kalshi-side change, but last full chain was "
                  f"{(now - last_full) / 3600:.0f}h ago (> {FULL_MAX_AGE_H}h) "
                  f"— running the full chain (transcript-only changes)")
        base = BEATS["mentions"]
        for step in FULL_STEPS:
            run(step, base, prog)
            base += BEATS[step]
        prog.advance(TOTAL_BEATS, "chain complete")
        state["last_full_ts"] = now

    state["mentions_fp"] = fp
    save_state(state)
    print(f"\nSaved refresh state to {STATE_FILE} "
          f"(mentions fp {str(fp)[:10]}…, last full chain "
          f"{datetime.fromtimestamp(state.get('last_full_ts', 0), timezone.utc).isoformat()})")
    print("[refresh] done", flush=True)


if __name__ == "__main__":
    main()
