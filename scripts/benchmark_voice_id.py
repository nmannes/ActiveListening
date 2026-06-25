#!/usr/bin/env python3
"""
benchmark_voice_id.py — Measure audio-based speaker identification performance.

Loads labeled ground truth from speaker_labels.json, runs SpeakerIdentifier
against the reference library for each per-speaker WAV, and reports accuracy,
per-speaker stats, confusion matrix, and score distributions.

Usage:
    python scripts/benchmark_voice_id.py
    python scripts/benchmark_voice_id.py --threshold 0.5
    python scripts/benchmark_voice_id.py --speaker donald-trump
    python scripts/benchmark_voice_id.py --output json
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("benchmark_voice_id")

S3_BUCKET = os.environ.get("S3_BUCKET", "recordings-846345203908-us-east-1-an")
AUDIO_LIBRARY = Path("~/audio-library").expanduser()
LABELS_FILE = Path(__file__).resolve().parent.parent / "speaker_labels.json"
S3_DIR = Path(__file__).resolve().parent.parent / "s3"


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def slug_matches(match_name: str, ground_truth_slug: str) -> bool:
    """Prefix match: 'donald-trump-3' matches 'donald-trump'."""
    return (
        match_name == ground_truth_slug
        or match_name.startswith(ground_truth_slug + "-")
        or match_name.startswith(ground_truth_slug + "_")
    )


def load_ground_truth(labels_file: Path, speaker_filter: str | None = None):
    """Parse speaker_labels.json into (session_id, speaker_id, identity_slug, identity) triples."""
    with open(labels_file) as f:
        data = json.load(f)

    triples = []
    for session_id, speaker_map in data.items():
        for speaker_id, identity in speaker_map.items():
            if not identity:
                continue
            slug = slugify(identity)
            if speaker_filter and slug != speaker_filter:
                continue
            triples.append((session_id, speaker_id, slug, identity))
    return triples


def resolve_wavs(triples, s3_dir: Path, bucket: str):
    """Resolve per-speaker WAV files, pulling from S3 if missing locally.

    Returns list of (session_id, speaker_id, slug, identity, wav_path).
    """
    import boto3

    resolved = []
    missing = []
    s3_pull_count = 0

    s3 = boto3.client("s3")

    for session_id, speaker_id, slug, identity in triples:
        local_path = s3_dir / session_id / "audio" / f"speaker_{speaker_id}.wav"

        if local_path.exists():
            resolved.append((session_id, speaker_id, slug, identity, local_path))
            continue

        # Try S3
        s3_key = f"audio/{session_id}/speaker_{speaker_id}.wav"
        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, s3_key, str(local_path))
            s3_pull_count += 1
            resolved.append((session_id, speaker_id, slug, identity, local_path))
        except Exception:
            missing.append((session_id, speaker_id, slug, identity))

    if s3_pull_count:
        logger.info(f"Pulled {s3_pull_count} WAV(s) from S3")
    if missing:
        logger.warning(f"Missing {len(missing)} WAV(s):")
        for session_id, speaker_id, slug, _ in missing[:10]:
            logger.warning(f"  s3/{session_id}/audio/speaker_{speaker_id}.wav -> {slug}")
        if len(missing) > 10:
            logger.warning(f"  ... and {len(missing) - 10} more")

    return resolved, missing


async def run_benchmark(triples, threshold: float, top_k: int = 1):
    """Run identification on all resolved WAVs and return raw results."""
    from pylib.speaker_identifier import SpeakerIdentifier

    identifier = SpeakerIdentifier(audio_library_path=AUDIO_LIBRARY, threshold=threshold)
    await identifier.initialize()

    if not identifier.references:
        logger.error("No reference embeddings loaded. Check audio-library/ contents.")
        return []

    results = []
    total = len(triples)
    for i, (session_id, speaker_id, slug, identity, wav_path) in enumerate(triples):
        matches, scores = await identifier.identify_file(wav_path, threshold=threshold)

        top_match = matches[0] if matches else None
        top_score = scores.get(top_match, 0) if top_match else 0
        is_correct = slug_matches(top_match, slug) if top_match else False

        # top-k check
        top_k_correct = any(slug_matches(m, slug) for m in matches[:top_k]) if matches else False

        results.append({
            "session_id": session_id,
            "speaker_id": speaker_id,
            "slug": slug,
            "identity": identity,
            "top_match": top_match,
            "top_score": top_score,
            "is_correct": is_correct,
            "top_k_correct": top_k_correct,
            "matches": matches,
            "scores": scores,
        })

        if (i + 1) % 10 == 0 or i == total - 1:
            correct_count = sum(1 for r in results if r["is_correct"])
            logger.info(f"Progress: {i + 1}/{total} — accuracy so far: {correct_count}/{i + 1} = {correct_count / (i + 1):.1%}")

    return results


def compute_metrics(results, top_k: int = 1):
    """Compute aggregate and per-speaker metrics from raw results."""
    total = len(results)
    if total == 0:
        return {}

    correct = sum(1 for r in results if r["is_correct"])
    top_k_correct = sum(1 for r in results if r["top_k_correct"])

    # Per-identity stats
    by_identity = defaultdict(list)
    for r in results:
        by_identity[r["slug"]].append(r)

    per_speaker = {}
    for slug, entries in sorted(by_identity.items()):
        c = sum(1 for e in entries if e["is_correct"])
        scores = [e["top_score"] for e in entries]
        per_speaker[slug] = {
            "identity": entries[0]["identity"],
            "total": len(entries),
            "correct": c,
            "accuracy": c / len(entries),
            "mean_score": sum(scores) / len(scores),
            "min_score": min(scores),
            "max_score": max(scores),
        }

    # Confusion matrix — which identities are mistaken for which
    confusion = defaultdict(lambda: defaultdict(int))
    for r in results:
        if r["top_match"] and not r["is_correct"]:
            confusion[r["slug"]][r["top_match"]] += 1
        elif not r["top_match"]:
            confusion[r["slug"]]["<no match>"] += 1

    # Score distributions
    correct_scores = [r["top_score"] for r in results if r["is_correct"]]
    incorrect_scores = [r["top_score"] for r in results if not r["is_correct"]]

    return {
        "total": total,
        "correct": correct,
        "accuracy": correct / total,
        "top_k_accuracy": top_k_correct / total,
        "top_k": top_k,
        "per_speaker": per_speaker,
        "confusion": {k: dict(v) for k, v in confusion.items()},
        "correct_scores": correct_scores,
        "incorrect_scores": incorrect_scores,
    }


def print_report(metrics):
    """Print a human-readable benchmark report."""
    print()
    print("=" * 70)
    print("  VOICE IDENTIFICATION BENCHMARK")
    print("=" * 70)
    print(f"  Total test cases:     {metrics['total']}")
    print(f"  Correct:              {metrics['correct']}")
    print(f"  Accuracy (top-1):     {metrics['accuracy']:.1%}")
    print(f"  Accuracy (top-{metrics['top_k']}):     {metrics['top_k_accuracy']:.1%}")
    print()

    # Score distributions
    if metrics["correct_scores"]:
        print(f"  Correct match scores:   min={min(metrics['correct_scores']):.3f}  "
              f"mean={sum(metrics['correct_scores'])/len(metrics['correct_scores']):.3f}  "
              f"max={max(metrics['correct_scores']):.3f}")
    if metrics["incorrect_scores"]:
        print(f"  Incorrect match scores: min={min(metrics['incorrect_scores']):.3f}  "
              f"mean={sum(metrics['incorrect_scores'])/len(metrics['incorrect_scores']):.3f}  "
              f"max={max(metrics['incorrect_scores']):.3f}")

    # Per-speaker breakdown
    print()
    print(f"  {'Speaker':<30} {'Samples':>7} {'Correct':>7} {'Acc':>7} {'Mean Score':>10}")
    print(f"  {'-'*30} {'-'*7} {'-'*7} {'-'*7} {'-'*10}")
    for slug, stats in sorted(metrics["per_speaker"].items(), key=lambda x: -x[1]["accuracy"]):
        label = stats["identity"][:28]
        print(f"  {label:<30} {stats['total']:>7} {stats['correct']:>7} {stats['accuracy']:>6.0%} {stats['mean_score']:>10.3f}")

    # Confusion highlights
    if metrics["confusion"]:
        print()
        print("  Top confusions (misidentifications):")
        flat = []
        for actual, predicted in metrics["confusion"].items():
            for pred, count in predicted.items():
                flat.append((actual, pred, count))
        flat.sort(key=lambda x: -x[2])
        for actual, pred, count in flat[:15]:
            print(f"    {actual} -> {pred} ({count}x)")

    print()
    print("=" * 70)


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark audio-based speaker identification against labeled ground truth"
    )
    parser.add_argument("--threshold", type=float, default=0.65,
                        help="Similarity threshold (default: 0.65)")
    parser.add_argument("--top-k", type=int, default=1,
                        help="Report top-k accuracy (default: 1)")
    parser.add_argument("--output", choices=["text", "json"], default="text",
                        help="Output format (default: text)")
    parser.add_argument("--speaker", type=str, default=None,
                        help="Filter to a specific speaker slug")
    parser.add_argument("--sweep", action="store_true",
                        help="Sweep thresholds from 0.0 to 1.0 and report accuracy curve")
    args = parser.parse_args()

    # Load ground truth
    triples = load_ground_truth(LABELS_FILE, speaker_filter=args.speaker)
    logger.info(f"Loaded {len(triples)} labeled triples from {LABELS_FILE}")
    if not triples:
        logger.error("No labeled triples found.")
        return

    # Resolve WAVs
    resolved, missing = resolve_wavs(triples, S3_DIR, S3_BUCKET)
    logger.info(f"Resolved {len(resolved)} WAVs ({len(missing)} missing)")

    if not resolved:
        logger.error("No WAV files could be resolved. Exiting.")
        return

    # Threshold sweep
    if args.sweep:
        print()
        print("=" * 70)
        print("  THRESHOLD SWEEP")
        print("=" * 70)
        print(f"  {'Threshold':>10}  {'Correct':>7}  {'Total':>7}  {'Accuracy':>8}")
        print(f"  {'-'*10}  {'-'*7}  {'-'*7}  {'-'*8}")
        for t in [round(x * 0.05, 2) for x in range(0, 21)]:
            results = asyncio.run(run_benchmark(resolved, threshold=t, top_k=args.top_k))
            c = sum(1 for r in results if r["top_k_correct"])
            print(f"  {t:>10.2f}  {c:>7}  {len(results):>7}  {c / len(results):>7.1%}")
        print("=" * 70)
        return

    # Single run
    results = asyncio.run(run_benchmark(resolved, threshold=args.threshold, top_k=args.top_k))
    metrics = compute_metrics(results, top_k=args.top_k)

    if args.output == "json":
        # Strip raw match data for cleaner JSON
        for r in results:
            del r["matches"]
            del r["scores"]
        output = {"metrics": metrics, "results": results}
        print(json.dumps(output, indent=2, default=str))
    else:
        print_report(metrics)


if __name__ == "__main__":
    main()
