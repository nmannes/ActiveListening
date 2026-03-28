#!/usr/bin/env python3
"""
test_audio_processor.py — Replay saved Deepgram responses through AudioProcessor.receive_results

Loads all JSON files from deepgram_responses/ directory and feeds them through
the receive_results method to validate parsing, token formatting, and callback logic.

Usage:
    python3 pylib/test_audio_processor.py
    python3 pylib/test_audio_processor.py --verbose     # show each token batch
    python3 pylib/test_audio_processor.py --dir /path/to/responses  # custom dir
"""

import asyncio
import json
import logging
import os
import sys
from pathlib import Path

# Add parent dir to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Ensure websockets.exceptions is accessible (some versions use a lazy-loading
# scheme that breaks attribute lookups outside of actual websocket contexts).
import websockets
try:
    websockets.exceptions
except AttributeError:
    import types
    mod = types.ModuleType("websockets.exceptions")

    class ConnectionClosed(Exception):
        pass

    mod.ConnectionClosed = ConnectionClosed
    websockets.exceptions = mod
    sys.modules["websockets.exceptions"] = mod

from pylib.audio_processor import AudioProcessor

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


class MockSession:
    """Minimal session stub for AudioProcessor."""
    def __init__(self, session_id="test-replay"):
        self.session_id = session_id


class MockWebSocket:
    """Async iterator that yields saved JSON messages in timestamp order.
    
    Skips corrupted files (e.g. concatenated JSON) at load time.
    """
    def __init__(self, responses_dir: Path):
        self.messages = []
        self.skipped = 0
        files = sorted(responses_dir.glob("dg_*.json"))
        if not files:
            raise FileNotFoundError(f"No dg_*.json files found in {responses_dir}")
        for f in files:
            text = f.read_text()
            # Validate JSON before adding
            try:
                json.loads(text)
                self.messages.append(text)
            except json.JSONDecodeError:
                self.skipped += 1
        logger.info(
            f"Loaded {len(self.messages)} responses from {responses_dir}"
            + (f" (skipped {self.skipped} corrupt files)" if self.skipped else "")
        )

    def __aiter__(self):
        return self._iter()

    async def _iter(self):
        for msg in self.messages:
            yield msg


class CallbackCollector:
    """Collects all on_tokens_callback invocations for inspection."""
    def __init__(self):
        self.calls = []  # list of {tokens, speaker_id}

    async def __call__(self, tokens, speaker_id=None):
        self.calls.append({"tokens": tokens, "speaker_id": speaker_id})


async def run_replay(responses_dir: Path, verbose: bool = False):
    mock_ws = MockWebSocket(responses_dir)
    session = MockSession()
    collector = CallbackCollector()
    processor = AudioProcessor(session, on_tokens_callback=collector)

    # Run receive_results against the mock websocket
    await processor.receive_results(mock_ws)
    # Let pending create_task callbacks execute
    await asyncio.sleep(0)

    # ── Summary ────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("REPLAY RESULTS")
    print("=" * 70)

    # Count message types from raw data
    type_counts = {}
    final_count = 0
    non_final_count = 0
    empty_transcript_count = 0

    for msg_str in mock_ws.messages:
        data = json.loads(msg_str)
        msg_type = data.get("type", "unknown")
        type_counts[msg_type] = type_counts.get(msg_type, 0) + 1

        if msg_type == "Results":
            if data.get("is_final", False):
                final_count += 1
                alt = data.get("channel", {}).get("alternatives", [{}])[0]
                if not alt.get("words"):
                    empty_transcript_count += 1
            else:
                non_final_count += 1

    print(f"\nMessages loaded:        {len(mock_ws.messages)}")
    if mock_ws.skipped:
        print(f"Corrupt files skipped:  {mock_ws.skipped}")
    print(f"Message types:          {type_counts}")
    print(f"  Final Results:        {final_count}")
    print(f"  Non-final (skipped):  {non_final_count}")
    print(f"  Empty transcripts:    {empty_transcript_count}")
    print(f"  Results received cnt: {processor.total_results_received}")
    print(f"\nCallback invocations:   {len(collector.calls)}")

    # ── Validate invariants ────────────────────────────────────────────
    errors = []

    # 1. Callback count should match final results with non-empty words
    expected_callbacks = final_count - empty_transcript_count
    if len(collector.calls) != expected_callbacks:
        errors.append(
            f"Expected {expected_callbacks} callbacks (final_results={final_count} - empty={empty_transcript_count}), "
            f"got {len(collector.calls)}"
        )

    # 2. total_results_received should equal final results count
    if processor.total_results_received != final_count:
        errors.append(
            f"total_results_received={processor.total_results_received}, expected {final_count}"
        )

    # 3. Validate each callback's token structure
    total_tokens = 0
    speakers_seen = set()
    for i, call in enumerate(collector.calls):
        tokens = call["tokens"]
        speaker_id = call["speaker_id"]
        speakers_seen.add(speaker_id)

        if not tokens:
            errors.append(f"Callback {i}: empty tokens list")
            continue

        total_tokens += len(tokens)
        for j, tok in enumerate(tokens):
            if "text" not in tok:
                errors.append(f"Callback {i}, token {j}: missing 'text' key")
            elif not isinstance(tok["text"], str):
                errors.append(f"Callback {i}, token {j}: 'text' is not a string: {tok['text']}")
            elif tok["text"] != tok["text"].lower():
                errors.append(f"Callback {i}, token {j}: 'text' not lowercased: {tok['text']}")

            if "start" not in tok:
                errors.append(f"Callback {i}, token {j}: missing 'start' key")
            elif not isinstance(tok["start"], (int, float)):
                errors.append(f"Callback {i}, token {j}: 'start' is not numeric: {tok['start']}")

            if "end" not in tok:
                errors.append(f"Callback {i}, token {j}: missing 'end' key")
            elif not isinstance(tok["end"], (int, float)):
                errors.append(f"Callback {i}, token {j}: 'end' is not numeric: {tok['end']}")

        if speaker_id is None:
            errors.append(f"Callback {i}: speaker_id is None")

        if verbose:
            text = " ".join(t["text"] for t in tokens)
            print(f"  [{speaker_id}] {text}")

    print(f"\nTotal tokens extracted:  {total_tokens}")
    print(f"Speakers seen:          {speakers_seen}")

    # ── Final transcript object (grouped by speaker, deduplicated) ──────
    transcript_by_speaker = {}
    seen_per_speaker = {}  # {speaker_id: set of (text, start)}
    dupes_removed = 0

    for call in collector.calls:
        sid = call["speaker_id"]
        if sid not in transcript_by_speaker:
            transcript_by_speaker[sid] = []
            seen_per_speaker[sid] = set()

        text = " ".join(t["text"] for t in call["tokens"])
        start = call["tokens"][0]["start"] if call["tokens"] else None
        key = (text, start)

        if key in seen_per_speaker[sid]:
            dupes_removed += 1
            continue
        seen_per_speaker[sid].add(key)

        transcript_by_speaker[sid].append({
            "words": [{"text": t["text"], "start": t["start"], "end": t["end"]} for t in call["tokens"]],
            "text": text,
            "start": start,
            "end": call["tokens"][-1]["end"] if call["tokens"] else None,
        })

    # Sort each speaker's segments by start time
    for sid in transcript_by_speaker:
        transcript_by_speaker[sid].sort(key=lambda s: s["start"] or 0)

    print("\n" + "=" * 70)
    print("FINAL TRANSCRIPT")
    print("=" * 70)
    if dupes_removed:
        print(f"  (removed {dupes_removed} duplicate segments)")
    for sid in sorted(transcript_by_speaker.keys(), key=lambda x: int(x) if x.isdigit() else x):
        print(f"  Speaker {sid}: {len(transcript_by_speaker[sid])} segments")

    with open("transcript.json", "w") as f:
        json.dump(transcript_by_speaker, f, indent=2)

    # ── Report ─────────────────────────────────────────────────────────
    print("\n" + "-" * 70)
    if errors:
        print(f"FAILED — {len(errors)} error(s):")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    else:
        print("PASSED — all assertions OK")
        print(f"  ✓ {len(collector.calls)} callbacks with correct token format")
        print(f"  ✓ {total_tokens} tokens all lowercased with 'text' and 'start' keys")
        print(f"  ✓ total_results_received matches final result count ({final_count})")
        print(f"  ✓ speakers: {speakers_seen}")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Replay Deepgram responses through AudioProcessor")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print each transcript segment")
    parser.add_argument("--dir", type=str, default=None, help="Path to deepgram_responses directory")
    args = parser.parse_args()

    if args.dir:
        resp_dir = Path(args.dir)
    else:
        resp_dir = Path(__file__).parent.parent / "deepgram_responses"

    if not resp_dir.exists():
        print(f"Error: directory not found: {resp_dir}")
        sys.exit(1)

    asyncio.run(run_replay(resp_dir, verbose=args.verbose))


if __name__ == "__main__":
    main()
