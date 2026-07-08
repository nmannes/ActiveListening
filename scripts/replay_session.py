#!/usr/bin/env python
"""
replay_session.py — Replay saved Deepgram responses offline to test speaker identification.

Processes dg_*.json files from a deepgram_responses/ directory in lexicographic order,
feeding them through the real DiarizedTradeProcessor and SpeakerRecognitionSession.

Usage:
    PYTHONPATH=. python scripts/replay_session.py s3/maddow --verbose
    PYTHONPATH=. python scripts/replay_session.py s3/maddow --infer --target "Rachel Maddow"
"""

import argparse
import asyncio
import json
import logging
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pylib.trade_processor import DiarizedTradeProcessor
from pylib.keyword_matching import build_keyword_index
from pylib.speaker_recognition import SpeakerRecognitionSession

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("replay")


class MockWebsocket:
    """No-op websocket for replay mode."""
    async def send(self, data):
        pass


class MockConfig:
    def __init__(self):
        self.trade_for_real = False
        self.buy_count = 1
        self.buy_max_cost = 5
        self.last_words_count = 7
        self.min_confidence = 0.8


class MockServer:
    def __init__(self):
        self.config = MockConfig()
        self.kalshi = None


class ReplaySession:
    """
    Mocks a ClientSession with just enough state for DiarizedTradeProcessor
    and SpeakerRecognitionSession to work.
    """

    def __init__(self, session_id: str, market: dict = None):
        self.session_id = session_id
        self.transcript = defaultdict(list)
        self.transcript_lock = asyncio.Lock()
        self.keyword_index = build_keyword_index(market.get("keywords", {}) if market else {})
        self.market = market or {}
        self.server = MockServer()
        self.websocket = MockWebsocket()
        self.punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')


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


async def main():
    parser = argparse.ArgumentParser(
        description="Replay saved Deepgram responses through the real processing pipeline"
    )
    parser.add_argument("recording_dir", type=str, help="Path to session directory (e.g., s3/maddow)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print each transcript segment as processed")
    parser.add_argument("--infer", action="store_true", help="Run Bedrock identity inference after replay")
    parser.add_argument("--target", type=str, default="Unknown", help="Target speaker name for inference")
    parser.add_argument("--region", type=str, default="us-east-1", help="AWS region for Bedrock")

    args = parser.parse_args()

    recording_dir = Path(args.recording_dir)
    dg_dir = recording_dir / "deepgram_responses"

    if not dg_dir.exists():
        logger.error(f"deepgram_responses directory not found: {dg_dir}")
        sys.exit(1)

    # Collect and sort response files lexicographically
    response_files = sorted(dg_dir.glob("dg_*.json"))
    logger.info(f"Found {len(response_files)} Deepgram responses in {dg_dir}")

    # Create session and trade processor (using real classes)
    session = ReplaySession(session_id=recording_dir.name)
    trade_processor = DiarizedTradeProcessor(session)
    session.trade_processor = trade_processor

    # Process each Deepgram response through the real pipeline
    processed = 0
    for file_path in response_files:
        with open(file_path, "r") as f:
            data = json.load(f)

        # Mirror AudioProcessor.receive_results logic
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

        # Format tokens exactly as AudioProcessor does
        formatted_tokens = [
            {
                "text": w["word"].lower(),
                "start": w["start"],
                "end": w["end"],
                "confidence": round(w.get("confidence", 0), 3),
            }
            for w in words
        ]

        # Feed through the real DiarizedTradeProcessor
        await trade_processor.process_tokens(formatted_tokens, speaker_id=speaker_id)
        processed += 1

        if args.verbose:
            transcript_text = alt.get("transcript", "").strip()
            if transcript_text:
                logger.info(f"[{speaker_id}] {transcript_text}")

    logger.info(f"Processed {processed}/{len(response_files)} responses with transcript data")
    logger.info(f"Found {len(session.transcript)} unique speakers: {list(session.transcript.keys())}")

    # Print summary
    print_speaker_summary(session)

    # Run Bedrock identity inference
    if args.infer:
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


if __name__ == "__main__":
    asyncio.run(main())
