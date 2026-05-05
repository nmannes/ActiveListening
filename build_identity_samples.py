#!/usr/bin/env python3
"""
build_identity_samples.py — Self-contained script to discover identity sessions, 
infer speaker IDs using Bedrock, and reconstruct audio samples from full.wav.

This script:
1. Scans the s3/ directory to find sessions and their target identities.
2. Filters out generic identities (announcer, employee, contestant).
3. Deduplicates to process only one session per unique identity.
4. For each unique identity:
    a. Replays Deepgram responses to build transcripts and collect per-speaker time segments.
    b. Calls Bedrock to infer which speaker_id is the target identity.
    c. Reconstructs the matched speaker's audio from full.wav.
5. Saves a mapping JSON containing the identity, source path, and reference audio file path.

Usage:
    PYTHONPATH=. python3 build_identity_samples.py
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

from scripts.replay_session import ReplaySession, DiarizedTradeProcessor
import pylib.trade_processor

# Disable Telegram notifications for offline processing
pylib.trade_processor.send_telegram = lambda *args, **kwargs: None

# Configure logging to both file and console
log_file = "build_identities.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode='a'),
        logging.StreamHandler(sys.stdout)
    ]
)
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
    """
    if not full_wav_path.exists():
        return 0.0

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

    output_path.parent.mkdir(parents=True, exist_ok=True)
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

    # Create session and trade processor
    session = ReplaySession(session_id=folder_path.name, market=market_data)
    trade_processor = DiarizedTradeProcessor(session)
    session.trade_processor = trade_processor

    # Process each Deepgram response
    response_files = sorted(dg_dir.glob("dg_*.json"))
    if not response_files:
        logger.warning(f"  ⏩ SKIP: No dg_*.json files in {dg_dir}")
        return None, None

    logger.info(f"  Processing {len(response_files)} deepgram responses for {target}...")

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

                seg_start = words[0]["start"]
                seg_end = words[-1]["end"]
                speaker_segments[speaker_id].append((seg_start, seg_end))

    # Build transcript_history
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
        return None, None

    # Aggregate all words per speaker across all turns
    speaker_words = defaultdict(list)
    for sid, text in transcript_history:
        speaker_words[sid].extend(text.split())

    # Sort speakers by total word count (descending) for easier review
    sorted_speakers = sorted(speaker_words.keys(), key=lambda s: len(speaker_words[s]), reverse=True)

    # Print first 500 words of each speaker
    print(f"\n{'='*60}")
    print(f"  TARGET IDENTITY: {target}")
    print(f"  Session: {folder_path.name}")
    print(f"{'='*60}")
    for sid in sorted_speakers:
        words = speaker_words[sid]
        word_count = len(words)
        snippet = " ".join(words[:500])
        print(f"\n--- Speaker {sid} ({word_count} total words) ---")
        print(snippet)
        print(f"--- end Speaker {sid} ---\n")

    # Prompt user to select the correct speaker
    valid_ids = set(sorted_speakers)
    print(f"Which speaker is '{target}'?")
    print(f"  Options: {', '.join(sorted_speakers)} | 's' to skip")
    while True:
        choice = input("  > ").strip().lower()
        if choice == 's':
            logger.info(f"  ⏩ User skipped {target}")
            return None, None
        if choice in valid_ids:
            logger.info(f"  ✅ User selected Speaker {choice} as {target}")
            return choice, dict(speaker_segments)
        print(f"  Invalid choice. Enter one of: {', '.join(sorted_speakers)} | 's' to skip")


def discover_sessions(s3_dir: Path):
    """
    Scans the s3/ directory and returns a list of sessions with their target identities.
    Filters out generic labels.
    """
    if not s3_dir.exists():
        logger.error("s3 directory not found.")
        return []

    folders = sorted([d for d in s3_dir.iterdir() if d.is_dir()])
    discovered = []

    for folder in folders:
        # Find the non-transcript json file
        json_files = list(folder.glob("*.json"))
        target_file = None
        for f in json_files:
            if f.name != "transcript.json":
                target_file = f
                break
        
        if target_file:
            try:
                with open(target_file, "r") as f:
                    data = json.load(f)
                
                speaker_entities = data.get("speakerEntities", [])
                
                if speaker_entities:
                    # Filter generic labels
                    identities = [s for s in speaker_entities if not any(
                        kw in s.lower() for kw in ["announcer", "employee", "contestant"]
                    )]
                    
                    if identities:
                        discovered.append({
                            "path": folder,
                            "identity": identities[0],
                            "market_data": data
                        })
            except Exception as e:
                logger.error(f"Error reading {target_file}: {e}")

    return discovered


async def main():
    parser = argparse.ArgumentParser(description="Discover identities and build audio samples.")
    parser.add_argument("--max-duration", type=float, default=60.0, help="Max duration in seconds.")
    parser.add_argument("--output-dir", type=str, default="identities", help="Output directory for audio.")
    parser.add_argument("--results-json", type=str, default="reference_identities.json", help="Output JSON results file.")
    args = parser.parse_args()

    s3_dir = Path("s3")
    discovered_sessions = discover_sessions(s3_dir)
    logger.info(f"Discovered {len(discovered_sessions)} sessions with identities.")

    # Deduplicate: only process one session per identity
    seen_identities = set()
    unique_sessions = []
    for sess in discovered_sessions:
        if sess["identity"] not in seen_identities:
            seen_identities.add(sess["identity"])
            unique_sessions.append(sess)

    logger.info(f"Processing {len(unique_sessions)} unique identities.")

    output_dir = Path(args.output_dir)
    final_results = []

    for sess in unique_sessions:
        identity = sess["identity"]
        folder_path = sess["path"]
        market_data = sess["market_data"]
        
        slug_name = slugify(identity)
        output_file = output_dir / f"{slug_name}.wav"

        logger.info(f"\nProcessing {identity} from {folder_path.name}")

        if output_file.exists():
            logger.info(f"  ✅ Audio already exists: {output_file}")
            final_results.append({
                "identity": identity,
                "path": str(folder_path),
                "reference_file": str(output_file)
            })
            continue

        full_wav = folder_path / "audio" / "full.wav"
        if not full_wav.exists():
            logger.warning(f"  ⏩ SKIP: No full.wav in {folder_path}")
            continue

        try:
            matched_sid, speaker_segments = await infer_speaker_for_session(folder_path, identity, market_data)

            if matched_sid is None:
                logger.warning(f"  ⚠️ No match found for {identity}")
                continue

            segments = speaker_segments.get(matched_sid, [])
            if not segments:
                continue

            duration = reconstruct_speaker_wav(full_wav, segments, output_file, args.max_duration)

            if duration >= 1.0:
                logger.info(f"  ✅ Saved {output_file} ({duration:.1f}s)")
                final_results.append({
                    "identity": identity,
                    "path": str(folder_path),
                    "reference_file": str(output_file),
                    "speaker_id": matched_sid,
                    "duration": round(duration, 1)
                })
            else:
                if output_file.exists():
                    output_file.unlink()
                logger.warning(f"  ⚠️ Sample too short ({duration:.1f}s)")

        except Exception as e:
            logger.error(f"  ❌ Error: {e}")

        # Save incremental results after each session
        with open(args.results_json, "w") as f:
            json.dump(final_results, f, indent=2)

    # Save final JSON results
    with open(args.results_json, "w") as f:
        json.dump(final_results, f, indent=2)
    
    logger.info(f"\nDone. Successfully processed {len(final_results)} identities.")
    logger.info(f"Results saved to {args.results_json}")


if __name__ == "__main__":
    asyncio.run(main())
