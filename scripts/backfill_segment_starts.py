#!/usr/bin/env python
"""
backfill_segment_starts.py — one-off maintenance: recover the source-video start
offset for pending verification segments generated before the `start` field
existed.

Segments live in Redis (`verify:<slug>` blobs) and were cut from the downloaded
source WAVs retained in their work_dir. For each segment this locates its exact
position in the source by FFT cross-correlation and writes `start` (seconds,
rounded to 2 dp — the same shape the generation pipeline writes) back into the
blob. Low-confidence matches are skipped, never guessed, and existing TTLs are
preserved (plain HSET, no EXPIRE).

Usage:
    python scripts/backfill_segment_starts.py --dry-run --slug satya-nadella
    python scripts/backfill_segment_starts.py            # all pending verifications
"""

import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.fft import next_fast_len

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from pylib.verification_state import (
    get_redis,
    pending_verifications,
    get_all_verification_states,
)

SR = 250          # correlation sample rate — 4 ms resolution is plenty for second-granularity links
MIN_R = 0.99      # required normalized correlation at the matched lag
MIN_RATIO = 3.0   # required peak vs best non-neighbouring peak
GUARD_S = 5       # runner-up exclusion window around the peak


def load_wav(path: Path, sr: int) -> np.ndarray:
    import librosa

    audio, _ = librosa.load(str(path), sr=sr, mono=True)
    return audio


def locate(src: np.ndarray, X: np.ndarray, seg: np.ndarray, n: int):
    """Cross-correlate seg against src (X = rfft(src, n), precomputed).
    Returns (offset_samples, r, ratio) or None."""
    if len(seg) == 0 or len(seg) > len(src):
        return None
    c = np.fft.irfft(X * np.conj(np.fft.rfft(seg, n)), n)
    valid = c[: len(src) - len(seg) + 1]
    abs_valid = np.abs(valid)
    lag = int(np.argmax(abs_valid))

    guard = GUARD_S * SR
    masked = abs_valid.copy()
    masked[max(0, lag - guard): lag + guard + 1] = 0
    runner_up = float(masked.max()) if masked.any() else 0.0
    ratio = float(abs_valid[lag]) / runner_up if runner_up > 0 else float("inf")

    r = float(np.corrcoef(src[lag: lag + len(seg)], seg)[0, 1])
    return lag, r, ratio


def process_slug(r, slug: str, args, totals: dict):
    states = get_all_verification_states(slug)
    groups = defaultdict(list)
    for idx, st in sorted(states.items()):
        if st.get("start") is not None:
            continue
        if args.limit and idx >= args.limit:
            continue
        groups[(st.get("work_dir"), st.get("source"))].append((idx, st))

    matched = skipped = 0
    for (work_dir, source), entries in sorted(groups.items()):
        src_path = Path(work_dir) / source if work_dir and source else None
        if not src_path or not src_path.exists():
            reasons = defaultdict(int)
            for idx, st in entries:
                if not st.get("wav_path") or not Path(st["wav_path"]).exists():
                    reasons["segment wav missing"] += 1
                else:
                    reasons["source wav missing"] += 1
            for reason, count in reasons.items():
                print(f"  {slug}: skipped {count} ({reason})", flush=True)
            totals["skipped_reasons"].update(reasons)
            skipped += len(entries)
            continue

        t0 = time.time()
        src = load_wav(src_path, args.sr)
        max_seg_len = max(
            int(round(sf.info(st["wav_path"]).duration * args.sr))
            for _, st in entries if st.get("wav_path") and Path(st["wav_path"]).exists()
        ) if any(st.get("wav_path") and Path(st["wav_path"]).exists() for _, st in entries) else 0
        n = next_fast_len(len(src) + max_seg_len + 1)
        X = np.fft.rfft(src, n)

        group_matched = group_skipped = 0
        for idx, st in sorted(entries):
            seg_path = st.get("wav_path")
            if not seg_path or not Path(seg_path).exists():
                totals["skipped_reasons"]["segment wav missing"] += 1
                group_skipped += 1
                continue
            seg = load_wav(Path(seg_path), args.sr)
            result = locate(src, X, seg, n)
            if result is None:
                totals["skipped_reasons"]["segment longer than source"] += 1
                group_skipped += 1
                continue
            lag, r_val, ratio = result
            if r_val < MIN_R or ratio < MIN_RATIO:
                print(f"  {slug} seg {idx}: low confidence (r={r_val:.4f}, ratio={ratio:.1f}) — skipped", flush=True)
                totals["skipped_reasons"]["low confidence"] += 1
                group_skipped += 1
                continue
            start = round(lag / args.sr, 2)
            if not args.dry_run:
                r.hset(f"verify:{slug}", str(idx), json.dumps({**st, "start": start}))
            group_matched += 1
            if args.verbose:
                print(f"  {slug} seg {idx}: start={start}s (r={r_val:.4f})", flush=True)

        matched += group_matched
        skipped += group_skipped
        del src, X
        print(
            f"  {slug} / {source}: {group_matched}/{len(entries)} matched "
            f"(+{group_skipped} skipped) in {time.time() - t0:.0f}s",
            flush=True,
        )

    totals["matched"] += matched
    totals["skipped"] += skipped
    print(f"{slug}: {matched} matched, {skipped} skipped", flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--slug", action="append", default=[], help="only this slug (repeatable)")
    ap.add_argument("--sr", type=int, default=SR, help=f"correlation sample rate (default {SR})")
    ap.add_argument("--dry-run", action="store_true", help="report matches without writing to Redis")
    ap.add_argument("--verbose", action="store_true", help="print every matched segment")
    ap.add_argument("--limit", type=int, default=0, help="only segments with index < N (testing)")
    args = ap.parse_args()

    r = get_redis()
    slugs = args.slug or pending_verifications()
    if not slugs:
        print("No pending verifications found.")
        return

    mode = "DRY RUN — " if args.dry_run else ""
    print(f"{mode}backfilling segment starts for {len(slugs)} slug(s) at {args.sr} Hz", flush=True)

    totals = {"matched": 0, "skipped": 0, "skipped_reasons": defaultdict(int)}
    t0 = time.time()
    for slug in slugs:
        process_slug(r, slug, args, totals)

    print(
        f"\nDone in {time.time() - t0:.0f}s — {totals['matched']} matched, "
        f"{totals['skipped']} skipped"
        + (f" ({dict(totals['skipped_reasons'])})" if totals["skipped_reasons"] else ""),
        flush=True,
    )


if __name__ == "__main__":
    main()
