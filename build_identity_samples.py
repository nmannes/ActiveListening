#!/usr/bin/env python3
"""
build_identity_samples.py — For each reference identity, infer which diarized speaker
matches the target, then reconstruct that speaker's audio from full.wav into an identities/ folder.

Reads reference_identities.json and for each entry:
  1. Replays deepgram responses to build transcripts and collect per-speaker time segments
  2. Calls Bedrock to infer which speaker_id is the target identity
  3. Reconstructs the matched speaker's audio from full.wav using the time segments

Usage:
    PYTHONPATH=. python3 build_identity_samples.py
    PYTHONPATH=. python3 build_identity_samples.py --dry-run
    PYTHONPATH=. python3 build_identity_samples.py --max-duration 30
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import wave
import re
from pathlib import Path
from collections import defaultdict

sys.path.insert(0, os.getcwd())

from pylib.speaker_recognition import SpeakerRecognitionSession
from scripts.replay_session import ReplaySession, DiarizedTradeProcessor
import pylib.trade_processor

# Disable Telegram notifications for offline processing
pylib.trade_processor.send_telegram = lambda *args, **kwargs: None

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Audio constants matching audio_processor.py
SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2  # 16-bit
CHANNELS = 1
BYTES_PER_SEC = SAMPLE_RATE * SAMPLE_WIDTH  # 32000


def slugify(name: str) -> str:
    """Convert an identity name to a filename-safe slug. e.g. 'Steve Bannon' -> 'steve-bannon'"""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')


def reconstruct_speaker_wav(full_wav_path: Path, segments: list, output_path: Path, max_duration_sec: float):
    """
    Reconstruct a speaker's audio by slicing time segments from full.wav.
    
    Args:
        full_wav_path: Path to the full recording WAV
        segments: List of (start_time, end_time) tuples in seconds
        output_path: Where to write the output WAV
        max_duration_sec: Max total duration to include
    """
    with wave.open(str(full_wav_path), 'rb') as src:
        pcm_data = src.readframes(src.getnframes())

    buf_len = len(pcm_data)
    output_frames = bytearray()
    total_duration = 0.0

    for start_time, end_time in segments:
        if total_duration >= max_duration_sec:
            break

        # Convert timestamps to byte offsets, ensuring 2-byte alignment for 16-bit PCM
        start_byte = (int(start_time * BYTES_PER_SEC) // SAMPLE_WIDTH) * SAMPLE_WIDTH
        end_byte = (int(end_time * BYTES_PER_SEC) // SAMPLE_WIDTH) * SAMPLE_WIDTH

        if start_byte >= buf_len:
            continue
        end_byte = min(end_byte, buf_len)
        if end_byte <= start_byte:
            continue

        seg_duration = (end_byte - start_byte) / BYTES_PER_SEC
        # Trim last segment if it would exceed max duration
        remaining = max_duration_sec - total_duration
        if seg_duration > remaining:
            end_byte = start_byte + (int(remaining * BYTES_PER_SEC) // SAMPLE_WIDTH) * SAMPLE_WIDTH
            seg_duration = remaining

        output_frames.extend(pcm_data[start_byte:end_byte])
        total_duration += seg_duration

    if not output_frames:
        return 0.0

    with wave.open(str(output_path), 'wb') as dst:
        dst.setnchannels(CHANNELS)
        dst.setsampwidth(SAMPLE_WIDTH)
        dst.setframerate(SAMPLE_RATE)
        dst.writeframes(bytes(output_frames))

    return total_duration


async def infer_speaker_for_session(folder_path: Path, target: str, market_data: dict):
    """
    Replay deepgram responses to build transcript and collect per-speaker time segments,
    then call Bedrock to identify which speaker_id matches the target identity.
    
    Returns (matched_speaker_id, speaker_segments_dict) or (None, None) if no match.
    """
    dg_dir = folder_path / "deepgram_responses"
    if not dg_dir.exists():
        logger.warning(f"  ⏩ SKIP: No deepgram_responses directory in {folder_path.name}")
        return None, None

    # Create session and trade processor (mirrors verify_identities_testing.py)
    session = ReplaySession(session_id=folder_path.name, market=market_data)
    trade_processor = DiarizedTradeProcessor(session)
    session.trade_processor = trade_processor

    # Process each Deepgram response to build per-speaker transcripts AND time segments
    response_files = sorted(dg_dir.glob("dg_*.json"))
    if not response_files:
        logger.warning(f"  ⏩ SKIP: No dg_*.json files in {dg_dir}")
        return None, None

    logger.info(f"  Processing {len(response_files)} deepgram responses...")

    # Collect per-speaker audio segments: {speaker_id: [(start, end), ...]}
    speaker_segments = defaultdict(list)

    for file_path in response_files:
        try:
            with open(file_path, "r") as f:
                content = f.read().strip()
                if "\n{" in content:
                    content = content.split("\n{")[0]
                data = json.loads(content)
        except Exception:
            continue

        if data.get("type") == "Results" and data.get("is_final", False):
            alt = data.get("channel", {}).get("alternatives", [{}])[0]
            words = alt.get("words", [])
            if words:
                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [{"text": w["word"].lower(), "start": w["start"], "end": w["end"]} for w in words]
                await trade_processor.process_tokens(formatted_tokens, speaker_id=speaker_id)

                # Record the time segment for this utterance
                seg_start = words[0]["start"]
                seg_end = words[-1]["end"]
                speaker_segments[speaker_id].append((seg_start, seg_end))

    # Build transcript_history from the accumulated transcript
    all_tokens = []
    for sid, tokens in session.transcript.items():
        for t in tokens:
            all_tokens.append((t.get("start", 0), sid, t["text"]))
    all_tokens.sort(key=lambda x: x[0])

    transcript_history = []
    cur_sid = None
    cur_texts = []
    for start, sid, text in all_tokens:
        if sid != cur_sid:
            if cur_sid is not None:
                transcript_history.append((cur_sid, " ".join(cur_texts)))
            cur_sid = sid
            cur_texts = [text]
        else:
            cur_texts.append(text)
    if cur_sid is not None:
        transcript_history.append((cur_sid, " ".join(cur_texts)))

    if not transcript_history:
        logger.warning(f"  ⏩ SKIP: Empty transcript for {folder_path.name}")
        return None, None

    unique_sids = set(sid for sid, _ in transcript_history)
    logger.info(f"  Found {len(unique_sids)} speakers, running Bedrock inference for target: {target}")

    # Call Bedrock to infer speaker identities
    rec_session = SpeakerRecognitionSession(session, [target])
    mapping = await rec_session.transcript_recognizer.infer_identity_with_bedrock(
        transcript_history, target
    )

    if not mapping:
        logger.warning(f"  ⚠️ Bedrock returned no mapping for {folder_path.name}")
        return None, None

    logger.info(f"  Bedrock mapping: {json.dumps(mapping)}")

    # Find the speaker_id that matches the target
    matched_sids = [sid for sid, label in mapping.items() if label == target]
    if not matched_sids:
        logger.warning(f"  ⚠️ No speaker matched target '{target}' in mapping: {mapping}")
        return None, None

    if len(matched_sids) > 1:
        logger.warning(f"  ⚠️ Multiple speakers matched '{target}': {matched_sids} — using first")

    matched_sid = matched_sids[0]
    return matched_sid, dict(speaker_segments)


async def main():
    parser = argparse.ArgumentParser(description="Build identity audio samples from reference_identities.json")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without copying files")
    parser.add_argument("--max-duration", type=float, default=60.0, help="Max duration in seconds for each audio sample (default: 60)")
    parser.add_argument("--output-dir", type=str, default="identities", help="Output directory for identity audio samples")
    parser.add_argument("--input", type=str, default="reference_identities.json", help="Path to reference_identities.json")
    args = parser.parse_args()

    # Load reference identities
    ref_path = Path(args.input)
    if not ref_path.exists():
        logger.error(f"Reference identities file not found: {ref_path}")
        sys.exit(1)

    with open(ref_path, "r") as f:
        entries = json.load(f)

    logger.info(f"Loaded {len(entries)} reference identity entries")

    # Deduplicate: only process the first session for each unique identity
    seen_identities = set()
    unique_entries = []
    for entry in entries:
        identity = entry["identity"]
        # Handle case where identity might be a list (from compute_reference_identities.py)
        if isinstance(identity, list):
            logger.info(f"  Skipping multi-identity entry: {identity}")
            continue
        if identity not in seen_identities:
            seen_identities.add(identity)
            unique_entries.append(entry)
        else:
            logger.debug(f"  Skipping duplicate for '{identity}': {entry['path']}")

    logger.info(f"Processing {len(unique_entries)} unique identities (from {len(entries)} total entries)")

    # Build a slug -> market mapping from scheduled JSON files
    slug_to_market = {}
    scheduled_dir = Path("scheduled")
    if scheduled_dir.exists():
        for json_file in scheduled_dir.glob("*.json"):
            try:
                with open(json_file, "r") as f:
                    data = json.load(f)
                    slug_to_market[data.get("slug")] = data
            except Exception as e:
                logger.error(f"Failed to read {json_file}: {e}")

    # Create output directory
    output_dir = Path(args.output_dir)
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)

    results = {"success": [], "failed": [], "skipped": []}

    for i, entry in enumerate(unique_entries):
        folder_path = Path(entry["path"])
        identity = entry["identity"]
        slug_name = slugify(identity)
        output_file = output_dir / f"{slug_name}.wav"

        logger.info(f"\n[{i+1}/{len(unique_entries)}] {identity} — {folder_path.name}")

        # Skip if output already exists
        if output_file.exists():
            logger.info(f"  ✅ Already exists: {output_file}")
            results["skipped"].append(identity)
            continue

        # Check that session folder exists
        if not folder_path.exists():
            logger.warning(f"  ⏩ SKIP: Session folder not found: {folder_path}")
            results["failed"].append({"identity": identity, "reason": "folder_not_found"})
            continue

        # Check that full.wav exists
        full_wav = folder_path / "audio" / "full.wav"
        if not full_wav.exists():
            logger.warning(f"  ⏩ SKIP: No full.wav in {folder_path.name}/audio/")
            results["failed"].append({"identity": identity, "reason": "no_full_wav"})
            continue

        # Load market data for this session
        session_id = folder_path.name
        slug = session_id.split("_")[0]
        market_data = slug_to_market.get(slug, {})
        if not market_data:
            # Try to load from the session folder's own JSON
            json_files = [f for f in folder_path.glob("*.json") if f.name != "transcript.json"]
            if json_files:
                try:
                    with open(json_files[0], "r") as f:
                        market_data = json.load(f)
                except Exception:
                    market_data = {}

        if args.dry_run:
            logger.info(f"  [DRY RUN] Would infer speaker and reconstruct audio to {output_file}")
            continue

        try:
            # Infer which speaker matches the target identity
            matched_sid, speaker_segments = await infer_speaker_for_session(folder_path, identity, market_data)

            if matched_sid is None:
                results["failed"].append({"identity": identity, "reason": "no_match"})
                continue

            # Get the time segments for the matched speaker
            segments = speaker_segments.get(matched_sid, [])
            if not segments:
                logger.warning(f"  ⚠️ No audio segments for speaker {matched_sid}")
                results["failed"].append({"identity": identity, "reason": "no_segments", "speaker_id": matched_sid})
                continue

            # Reconstruct the speaker's audio from full.wav
            duration = reconstruct_speaker_wav(full_wav, segments, output_file, args.max_duration)

            if duration < 1.0:
                logger.warning(f"  ⚠️ Reconstructed audio too short ({duration:.1f}s), removing")
                output_file.unlink(missing_ok=True)
                results["failed"].append({"identity": identity, "reason": "too_short", "duration": duration})
                continue

            logger.info(f"  ✅ Saved {output_file} (speaker {matched_sid}, {duration:.1f}s from {len(segments)} segments)")
            results["success"].append({"identity": identity, "speaker_id": matched_sid, "duration": round(duration, 1), "segments": len(segments)})

        except Exception as e:
            logger.error(f"  ❌ Error processing {identity}: {e}")
            results["failed"].append({"identity": identity, "reason": str(e)})

        # Rate limit protection for Bedrock
        await asyncio.sleep(1)

    # Print summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  ✅ Success: {len(results['success'])}")
    print(f"  ⏩ Skipped (already exist): {len(results['skipped'])}")
    print(f"  ❌ Failed:  {len(results['failed'])}")

    if results["failed"]:
        print("\nFailed entries:")
        for f in results["failed"]:
            print(f"  - {f['identity']}: {f.get('reason', 'unknown')}")

    print("=" * 70)

    # Save results log
    results_path = output_dir / "build_results.json"
    if not args.dry_run:
        with open(results_path, "w") as f:
            json.dump(results, f, indent=2)
        logger.info(f"Results saved to {results_path}")


if __name__ == "__main__":
    asyncio.run(main())
