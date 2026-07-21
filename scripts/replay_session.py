#!/usr/bin/env python
"""
replay_session.py — Replay saved Deepgram responses offline to test speaker identification.

Two modes:

  --infer    One-shot: feed all tokens at once, run a single Bedrock inference call
             (original mode, kept for quick checks).

  --loop     Full simulation: feed tokens in timestamp order on a virtual clock,
             run SpeakerRecognitionLoop on a fixed interval for the event duration.
             Supports both audio-based (TitaNet) and transcript-based (Bedrock) paths.

Usage:
    # One-shot Bedrock inference
    PYTHONPATH=. python scripts/replay_session.py s3/maddow --infer --target "Rachel Maddow"

    # Full loop simulation (transcript-only)
    PYTHONPATH=. python scripts/replay_session.py recordings/rfk-voice-test --loop --target "RFK Jr."

    # Full loop simulation (with audio identification)
    PYTHONPATH=. python scripts/replay_session.py recordings/rfk-voice-test --loop --target "RFK Jr." \\
        --audio-library ~/audio-library
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pylib.keyword_matching import build_keyword_index
from pylib.replay_runner import ReplaySession, ReplayRunner, MockWebsocket

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("replay")


def print_speaker_summary(session: ReplaySession):
    """Print a summary of each speaker's transcript."""
    print("\n" + "=" * 70)
    print("SPEAKER SUMMARY")
    print("=" * 70)

    for sid in sorted(session.transcript.keys(), key=lambda x: int(x) if x.isdigit() else x):
        tokens = session.transcript[sid]
        word_count = len(tokens)
        full_text = " ".join(t["text"] for t in tokens)

        preview_start = full_text[:100]
        preview_end = full_text[-100:] if len(full_text) > 200 else ""

        print(f"\n--- Speaker {sid} ({word_count} words) ---")
        print(f"  First: \"{preview_start}...\"")
        if preview_end:
            print(f"  Last:  \"...{preview_end}\"")

        if tokens:
            t_start = tokens[0].get("start", 0)
            t_end = tokens[-1].get("end", 0)
            print(f"  Time range: {t_start:.1f}s – {t_end:.1f}s ({t_end - t_start:.1f}s total)")

    print("\n" + "=" * 70)


# ── One-shot infer mode (original) ──────────────────────────────────────────

async def run_infer_mode(recording_dir: Path, args):
    """Original mode: feed all tokens at once, run single Bedrock inference."""
    dg_dir = recording_dir / "deepgram_responses"
    if not dg_dir.exists():
        logger.error(f"deepgram_responses directory not found: {dg_dir}")
        sys.exit(1)

    response_files = sorted(dg_dir.glob("dg_*.json"))
    logger.info(f"Found {len(response_files)} Deepgram responses in {dg_dir}")

    # Try to load market metadata
    market = {}
    slug_files = list(recording_dir.glob("*.json"))
    if slug_files:
        with open(slug_files[0]) as f:
            market = json.load(f)

    session = ReplaySession(session_id=recording_dir.name, market=market)

    from pylib.trade_processor import TradeProcessor
    trade_processor = TradeProcessor(session)
    session.trade_processor = trade_processor

    processed = 0
    for file_path in response_files:
        with open(file_path) as f:
            data = json.load(f)

        if data.get("type") != "Results":
            continue
        if not data.get("is_final", False):
            continue

        channel = data.get("channel", {})
        alternatives = channel.get("alternatives", [])
        if not alternatives:
            continue

        alt = alternatives[0]
        words = alt.get("words", [])
        if not words:
            continue

        speaker_id = str(words[0].get("speaker", "0"))

        formatted_tokens = [
            {
                "text": w["word"].lower(),
                "start": w["start"],
                "end": w["end"],
                "confidence": round(w.get("confidence", 0), 3),
            }
            for w in words
        ]

        await trade_processor.process_tokens(formatted_tokens, speaker_id=speaker_id)
        processed += 1

        if args.verbose:
            transcript_text = alt.get("transcript", "").strip()
            if transcript_text:
                logger.info(f"[{speaker_id}] {transcript_text}")

    logger.info(f"Processed {processed}/{len(response_files)} responses with transcript data")
    logger.info(f"Found {len(session.transcript)} unique speakers: {list(session.transcript.keys())}")

    print_speaker_summary(session)

    if args.infer:
        from pylib.speaker_recognition import SpeakerRecognitionSession
        rec_session = SpeakerRecognitionSession(session, [args.target])
        rec_session.transcript_recognizer.region_name = args.region

        logger.info(f"Running Bedrock identity inference for target: {args.target}")
        await rec_session.run_identity_inference()

        print("\n" + "=" * 70)
        print("IDENTITY INFERENCE RESULTS")
        print("=" * 70)
        for sid, label in rec_session.profile_labels.items():
            print(f"  Speaker {sid} → {label}")
        print("=" * 70)


# ── Loop mode (new) ─────────────────────────────────────────────────────────

async def run_loop_mode(recording_dir: Path, args):
    """Full simulation: time-synced token feeding + SpeakerRecognitionLoop."""
    # Load market metadata
    market = {}
    slug_files = list(recording_dir.glob("*.json"))
    if slug_files:
        with open(slug_files[0]) as f:
            market = json.load(f)

    # Ensure speakerEntities is set
    if not market.get("speakerEntities"):
        if args.target:
            market["speakerEntities"] = [args.target]
        else:
            logger.error("No speakerEntities in market metadata and no --target given")
            sys.exit(1)

    # Compute duration
    max_duration = args.duration if args.duration else _parse_duration_from_market(market)

    audio_library = None
    if args.audio_library:
        audio_library = Path(args.audio_library).expanduser()

    runner = ReplayRunner(
        recording_dir,
        market,
        audio_library_path=audio_library,
        device=args.device,
        interval_secs=args.interval,
        max_duration_secs=max_duration,
        bedrock_region=args.region,
        bedrock_model_id=args.model_id,
    )

    print(f"\nReplay: {recording_dir.name}")
    print(f"  Target(s): {market.get('speakerEntities')}")
    print(f"  Interval:  {args.interval}s")
    print(f"  Duration:  {max_duration}s ({max_duration // 60} min)")
    print(f"  Audio:     {'yes' if audio_library else 'no'}")
    print(f"  Bedrock:   {args.region} / {args.model_id}")
    print()

    result = await runner.run()

    # ── Print signal timeline ──────────────────────────────────────────
    if result.signals:
        print("=" * 70)
        print("SIGNAL TIMELINE")
        print("=" * 70)
        for s in result.signals:
            status = "WOULD TRADE" if s.would_trade else f"BLOCKED: {s.blocked_by}"
            whitelist_mark = "✓" if s.speaker_whitelisted else "✗"
            print(f"  t={s.elapsed_secs:6.1f}s  speaker {s.speaker_id} [{whitelist_mark}]  "
                  f"\"{s.keyword}\" → {s.ticker}  conf={s.word_confidence:.2f}")
            print(f"           {status}")
        print()

    # ── Print per-firing timeline ───────────────────────────────────────
    print("=" * 70)
    print("FIRING TIMELINE")
    print("=" * 70)
    for i, f in enumerate(result.firings, 1):
        labels_str = ", ".join(f"{sid}→{label}" for sid, label in f.profile_labels.items()) or "(none)"
        print(f"  [{i}] t={f.elapsed_secs:6.0f}s  words={f.total_words:5d}  labels={labels_str}")
        for sid, size in f.wav_sizes.items():
            print(f"       speaker_{sid}.wav: {size} bytes")
    if not result.firings:
        print("  (no firings)")

    print()
    print("=" * 70)
    print("FINAL RESULTS")
    print("=" * 70)
    for sid, label in result.profile_labels.items():
        print(f"  Speaker {sid} → {label}")
    if result.trading_speakers:
        print(f"  Trading whitelist: {result.trading_speakers}")
    print("=" * 70)


def _parse_duration_from_market(market: dict) -> int:
    """Try to parse event duration from market metadata, fall back to 1200."""
    sources = market.get("mediaSources", [])
    if sources:
        time_str = sources[0].get("metadata", {}).get("time", "")
        if time_str:
            import re
            from datetime import datetime
            match = re.match(r"(.+?)\s*-\s*(.+)", time_str)
            if match:
                try:
                    fmt = "%I:%M %p"
                    start = datetime.strptime(match.group(1).strip(), fmt)
                    end = datetime.strptime(match.group(2).strip(), fmt)
                    delta = (end - start).total_seconds()
                    if delta <= 0:
                        delta += 24 * 3600
                    return int(delta) + 60
                except ValueError:
                    pass
    return 1200


# ── Main ────────────────────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(
        description="Replay saved Deepgram responses through the speaker identification pipeline"
    )
    parser.add_argument("recording_dir", type=str,
                        help="Path to session directory (e.g., recordings/rfk-voice-test)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Print each transcript segment as processed")

    # Mode selection
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--infer", action="store_true",
                      help="One-shot Bedrock inference (original mode)")
    mode.add_argument("--loop", action="store_true",
                      help="Full time-synced loop simulation")

    # Shared options
    parser.add_argument("--target", type=str, default="Unknown",
                        help="Target speaker name")
    parser.add_argument("--region", type=str, default="us-east-1",
                        help="AWS region for Bedrock")
    parser.add_argument("--model-id", type=str,
                        default="us.amazon.nova-lite-v1:0",
                        help="Bedrock model ID")

    # Loop mode options
    parser.add_argument("--interval", type=int, default=10,
                        help="Seconds between identification runs (loop mode)")
    parser.add_argument("--duration", type=int, default=None,
                        help="Event duration in seconds (loop mode; default: parsed from metadata)")
    parser.add_argument("--audio-library", type=str, default=None,
                        help="Path to voice sample library for audio ID (e.g. ~/audio-library)")
    parser.add_argument("--device", type=str, default="cpu",
                        choices=["cpu", "cuda"],
                        help="Device for TitaNet model (loop mode)")

    args = parser.parse_args()

    recording_dir = Path(args.recording_dir)
    if not recording_dir.exists():
        logger.error(f"Recording directory not found: {recording_dir}")
        sys.exit(1)

    if args.loop:
        await run_loop_mode(recording_dir, args)
    else:
        # Default to --infer behavior for backward compat
        await run_infer_mode(recording_dir, args)


if __name__ == "__main__":
    asyncio.run(main())
