#!/usr/bin/env python3
"""
Correlate SIGNAL events from app-prod.log with Deepgram response files.

For each signal (keyword match), finds the closest deepgram response file by timestamp,
then extracts word-level confidence data to help identify failure patterns.
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

S3_DIR = Path(__file__).resolve().parent.parent / "s3"
LOG_PATH = Path(__file__).resolve().parent.parent / "app-prod.log"


def parse_signals(log_path: Path) -> list[dict]:
    """Extract all SIGNAL events from the log."""
    signals = []
    with open(log_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg = rec.get("msg", "")
            if msg.startswith("SIGNAL:"):
                # Format: "SIGNAL: keyword → ticker"
                inner = msg.replace("SIGNAL:", "").strip()
                if "→" in inner:
                    keyword, ticker = inner.split("→", 1)
                else:
                    keyword, ticker = inner, ""
                signals.append({
                    "time_ms": rec["time"],
                    "session_id": rec.get("sessionId", ""),
                    "keyword": keyword.strip(),
                    "ticker": ticker.strip(),
                })
    return signals


def find_s3_folder(session_id: str) -> Path | None:
    """Find the S3 folder matching a session ID."""
    for entry in S3_DIR.iterdir():
        if entry.is_dir() and entry.name.startswith(session_id + "_"):
            return entry
    return None


def find_closest_dg(dg_dir: Path, target_ns: int) -> tuple[str, int, float]:
    """Find the deepgram file closest to the target nanosecond timestamp.

    Returns (filename, timestamp_ns, diff_seconds).
    """
    best_file = None
    best_diff = float("inf")
    best_ts_ns = 0

    for f in dg_dir.iterdir():
        if not f.name.startswith("dg_") or not f.name.endswith(".json"):
            continue
        try:
            ts_ns = int(f.name.removeprefix("dg_").removesuffix(".json"))
        except ValueError:
            continue
        diff = abs(ts_ns - target_ns)
        if diff < best_diff:
            best_diff = diff
            best_file = f.name
            best_ts_ns = ts_ns

    return best_file, best_ts_ns, best_diff / 1e9


def extract_confidence(dg_path: Path, keyword: str) -> dict:
    """Extract word-level confidence from a deepgram response file.

    Returns info about the keyword words found and overall confidence.
    """
    with open(dg_path) as f:
        data = json.load(f)

    if data.get("type") != "Results":
        return {"error": f"Not a Results message (type={data.get('type')})"}

    alternatives = data.get("channel", {}).get("alternatives", [])
    if not alternatives:
        return {"error": "No alternatives"}

    alt = alternatives[0]
    transcript = alt.get("transcript", "")
    transcript_confidence = alt.get("confidence", 0)
    words = alt.get("words", [])

    kw_lower = keyword.lower().split()
    word_confidences = []
    kw_words_found = []
    all_confidences = []

    for w in words:
        word_text = w.get("word", "").lower().strip()
        wc = w.get("confidence", 0)
        all_confidences.append({"word": word_text, "confidence": wc, "speaker": w.get("speaker")})

        # Check if this word is part of the keyword
        for kw_word in kw_lower:
            if kw_word in word_text or word_text in kw_word:
                kw_words_found.append({"word": word_text, "confidence": wc, "start": w.get("start")})

    # Average confidence across all words
    avg_confidence = sum(w["confidence"] for w in all_confidences) / len(all_confidences) if all_confidences else 0
    min_confidence = min((w["confidence"] for w in all_confidences), default=0)
    kw_avg_confidence = sum(w["confidence"] for w in kw_words_found) / len(kw_words_found) if kw_words_found else 0

    return {
        "transcript": transcript,
        "transcript_confidence": transcript_confidence,
        "word_count": len(all_confidences),
        "avg_confidence": round(avg_confidence, 4),
        "min_confidence": round(min_confidence, 4),
        "kw_words_found": kw_words_found,
        "kw_avg_confidence": round(kw_avg_confidence, 4),
        "all_confidences": all_confidences,
    }


def main():
    print("=" * 80)
    print("  SIGNAL → DEEPGRAM CORRELATION ANALYSIS")
    print("=" * 80)

    # 1. Parse signals
    signals = parse_signals(LOG_PATH)
    print(f"\nTotal SIGNAL events in log: {len(signals)}")

    # Group by session
    by_session = defaultdict(list)
    for s in signals:
        by_session[s["session_id"]].append(s)
    print(f"Unique sessions with signals: {len(by_session)}")

    # 2. Build session → S3 folder mapping
    session_to_s3 = {}
    unmatched_sessions = []
    for sid in by_session:
        folder = find_s3_folder(sid)
        if folder:
            session_to_s3[sid] = folder
        else:
            unmatched_sessions.append(sid)

    print(f"Sessions with matching S3 folder: {len(session_to_s3)}")
    if unmatched_sessions:
        print(f"Sessions WITHOUT S3 folder: {len(unmatched_sessions)}")
        for sid in sorted(unmatched_sessions):
            print(f"  - {sid} ({len(by_session[sid])} signals)")

    # 3. For each signal in a matched session, find the closest DG file
    results = []
    for sid, sess_signals in sorted(session_to_s3.items()):
        s3_folder = session_to_s3[sid]
        dg_dir = s3_folder / "deepgram_responses"
        if not dg_dir.exists():
            print(f"  {sid}: no deepgram_responses directory")
            continue

        for sig in sess_signals:
            target_ns = sig["time_ms"] * 1_000_000  # ms → ns
            best_fname, best_ts_ns, diff_secs = find_closest_dg(dg_dir, target_ns)

            if best_fname is None:
                sig["confidence"] = {"error": "No DG files found"}
                results.append(sig)
                continue

            dg_path = dg_dir / best_fname
            conf_data = extract_confidence(dg_path, sig["keyword"])

            sig["confidence"] = conf_data
            sig["dg_file"] = best_fname
            sig["dg_diff_secs"] = round(diff_secs, 3)
            sig["s3_folder"] = s3_folder.name
            results.append(sig)

    # 4. Print results
    print(f"\n{'=' * 80}")
    print("  PER-SIGNAL DEEPGRAM CONFIDENCE")
    print("=" * 80)

    # Sort by avg confidence (lowest first to spot potential problems)
    sorted_results = sorted(
        [r for r in results if isinstance(r.get("confidence"), dict) and "avg_confidence" in r.get("confidence", {})],
        key=lambda r: r["confidence"]["avg_confidence"],
    )

    # Show low-confidence signals first
    print(f"\n  --- LOW CONFIDENCE SIGNALS (avg word confidence < 0.8) ---")
    low_conf = [r for r in sorted_results if r["confidence"]["avg_confidence"] < 0.8]
    print(f"  Count: {len(low_conf)}")
    for r in low_conf[:30]:
        c = r["confidence"]
        print(f"\n  Session: {r['session_id']}")
        print(f"  Keyword: '{r['keyword']}' → ticker: {r['ticker']}")
        print(f"  DG file: {r['dg_file']} (diff: {r['dg_diff_secs']}s)")
        print(f"  Transcript: \"{c['transcript']}\"")
        print(f"  Transcript confidence: {c['transcript_confidence']}")
        print(f"  Word avg confidence: {c['avg_confidence']}  |  min: {c['min_confidence']}")
        if c['kw_words_found']:
            kw_info = ", ".join(f"'{w['word']}':{w['confidence']:.3f}" for w in c['kw_words_found'])
            print(f"  Keyword word confidences: {kw_info}")

    # Show all results summary
    print(f"\n\n  --- ALL CORRELATED SIGNALS ({len(sorted_results)}) ---")
    print(f"  {'Session':45s} {'Keyword':20s} {'Ticker':30s} {'AvgConf':>8s} {'MinConf':>8s} {'KW_Avg':>8s} {'Diff_s':>7s}")
    print(f"  {'-'*45} {'-'*20} {'-'*30} {'-'*8} {'-'*8} {'-'*8} {'-'*7}")
    for r in sorted_results:
        c = r["confidence"]
        print(f"  {r['session_id']:45s} {r['keyword']:20s} {r['ticker']:30s} {c['avg_confidence']:>8.4f} {c['min_confidence']:>8.4f} {c.get('kw_avg_confidence',0):>8.4f} {r.get('dg_diff_secs',0):>7.3f}")

    # Confidence distribution
    all_avgs = [r["confidence"]["avg_confidence"] for r in sorted_results]
    all_mins = [r["confidence"]["min_confidence"] for r in sorted_results]
    all_kw = [r["confidence"].get("kw_avg_confidence", 0) for r in sorted_results]

    print(f"\n{'=' * 80}")
    print("  CONFIDENCE DISTRIBUTION")
    print("=" * 80)
    print(f"\n  Word avg confidence:")
    print(f"    Mean:  {sum(all_avgs)/len(all_avgs):.4f}")
    print(f"    Min:   {min(all_avgs):.4f}")
    print(f"    Max:   {max(all_avgs):.4f}")
    print(f"\n  Word min confidence (weakest word in each window):")
    print(f"    Mean:  {sum(all_mins)/len(all_mins):.4f}")
    print(f"    Min:   {min(all_mins):.4f}")
    if all_kw:
        print(f"\n  Keyword-word avg confidence:")
        print(f"    Mean:  {sum(all_kw)/len(all_kw):.4f}")
        print(f"    Min:   {min(all_kw):.4f}")
        print(f"    Max:   {max(all_kw):.4f}")

    # Bucket analysis
    buckets = {"0.0-0.5": 0, "0.5-0.7": 0, "0.7-0.8": 0, "0.8-0.9": 0, "0.9-1.0": 0}
    for avg in all_avgs:
        if avg < 0.5: buckets["0.0-0.5"] += 1
        elif avg < 0.7: buckets["0.5-0.7"] += 1
        elif avg < 0.8: buckets["0.7-0.8"] += 1
        elif avg < 0.9: buckets["0.8-0.9"] += 1
        else: buckets["0.9-1.0"] += 1
    print(f"\n  Confidence buckets (avg word confidence):")
    for bucket, count in buckets.items():
        bar = "█" * count
        print(f"    {bucket}: {count:4d} {bar}")

    # Per-session summary
    print(f"\n{'=' * 80}")
    print("  PER-SESSION CONFIDENCE SUMMARY")
    print("=" * 80)
    session_avgs = defaultdict(list)
    for r in sorted_results:
        session_avgs[r["session_id"]].append(r["confidence"]["avg_confidence"])
    for sid, avgs in sorted(session_avgs.items(), key=lambda x: sum(x[1])/len(x[1])):
        avg = sum(avgs) / len(avgs)
        print(f"  {sid:50s}  signals: {len(avgs):3d}  avg_conf: {avg:.4f}")

    print(f"\nDone. {len(sorted_results)} signals correlated with deepgram responses.")


if __name__ == "__main__":
    main()
