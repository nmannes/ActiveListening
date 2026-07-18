#!/usr/bin/env python3
"""
replay.py — Replay Deepgram transcripts through keyword matching and capture signals.

Reads dg_*.json files from a session directory, feeds words through the real
SignalDetector and find_keyword_match(), and writes every keyword hit to
signals.jsonl. No trading gate evaluation — just raw keyword detections.

Usage:
    PYTHONPATH=. python backtest/replay.py s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14
    PYTHONPATH=. python backtest/replay.py s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14 --market scheduled/kxnbamention-26apr28phibos.json
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pylib.keyword_matching import build_keyword_index
from pylib.signal_detector import SignalDetector

SCHEDULED_DIR = REPO_ROOT / "scheduled"
OUTPUT_DIR = REPO_ROOT / "backtest_data"


def load_market(session_dir: Path, market_arg: str | None = None) -> dict | None:
    """Load market JSON. Checks --market arg, then session dir, then scheduled/."""
    if market_arg:
        market_path = Path(market_arg)
        if not market_path.is_absolute():
            market_path = REPO_ROOT / market_path
        if market_path.exists():
            return json.loads(market_path.read_text())
        print(f"ERROR: Market file not found: {market_path}")
        return None

    slug = session_dir.name
    # Truncate the datetime suffix: "kxnbamention-26apr28phibos_2026-04-29_02-27-14" → "kxnbamention-26apr28phibos"
    # The slug before the first underscore-prefixed datetime portion
    parts = slug.split("_")
    clean_slug = parts[0]  # The session slug is always the first part

    # Check session dir
    market_path = session_dir / f"{clean_slug}.json"
    if market_path.exists():
        return json.loads(market_path.read_text())

    # Check scheduled/
    market_path = SCHEDULED_DIR / f"{clean_slug}.json"
    if market_path.exists():
        return json.loads(market_path.read_text())

    print(f"ERROR: No market JSON found for slug '{clean_slug}'")
    return None


def replay_session(session_dir: Path, market: dict) -> list[dict]:
    """Replay all Deepgram responses and capture keyword matches. Returns list of signal dicts."""
    dg_dir = session_dir / "deepgram_responses"
    if not dg_dir.is_dir():
        print(f"ERROR: No deepgram_responses/ in {session_dir}")
        return []

    response_files = sorted(dg_dir.glob("dg_*.json"))
    print(f"Found {len(response_files)} Deepgram responses")

    keyword_index = build_keyword_index(market.get("keywords", {}))
    detector = SignalDetector()
    signals: list[dict] = []
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

        words = alternatives[0].get("words", [])
        if not words:
            continue

        speaker_id = str(words[0].get("speaker", "0"))

        for w in words:
            text = w["word"].lower().strip()
            if not text:
                continue

            token = {
                "text": text,
                "start": w["start"],
                "end": w["end"],
                "confidence": round(w.get("confidence", 0), 3),
            }

            match = detector.feed_token(speaker_id, token, keyword_index)
            if match:
                signals.append({
                    "keyword": match["key"],
                    "ticker": match["value"],
                    "timestamp": w["start"],  # trigger word start (seconds from stream start)
                    "end": w["end"],
                    "confidence": match["min_confidence"],
                    "avg_confidence": match["avg_confidence"],
                    "confidences": match["confidences"],
                    "speaker_id": speaker_id,
                })

        processed += 1

    print(f"Processed {processed} responses, captured {len(signals)} signals")
    return signals


def main():
    parser = argparse.ArgumentParser(
        description="Replay Deepgram transcripts through keyword matching"
    )
    parser.add_argument("session_dir", help="Path to session directory with deepgram_responses/")
    parser.add_argument("--market", help="Path to market JSON (auto-detected if omitted)")
    parser.add_argument("--output", help="Output path for signals.jsonl (default: backtest_data/<slug>/signals.jsonl)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print each signal as captured")
    args = parser.parse_args()

    session_dir = Path(args.session_dir)
    if not session_dir.is_absolute():
        session_dir = REPO_ROOT / session_dir
    if not session_dir.is_dir():
        print(f"ERROR: {args.session_dir} is not a valid directory")
        sys.exit(1)

    market = load_market(session_dir, args.market)
    if not market:
        sys.exit(1)

    title = market.get("title", "Unknown")
    kw_count = len(market.get("keywords", {}))
    print(f"Market: {title}")
    print(f"Keywords: {kw_count}")

    signals = replay_session(session_dir, market)

    # Determine output path
    if args.output:
        output_path = Path(args.output)
        if not output_path.is_absolute():
            output_path = REPO_ROOT / output_path
    else:
        slug = session_dir.name.split("_")[0]
        output_path = OUTPUT_DIR / slug / "signals.jsonl"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        for sig in signals:
            f.write(json.dumps(sig) + "\n")

    print(f"Wrote {len(signals)} signals to {output_path}")

    if args.verbose:
        for sig in signals:
            print(f"  {sig['timestamp']:8.2f}s  [{sig['speaker_id']}]  {sig['keyword']:20s} → {sig['ticker']}  (conf={sig['confidence']:.3f})")

    # Summary by ticker
    ticker_counts: dict[str, int] = {}
    for sig in signals:
        ticker_counts[sig["ticker"]] = ticker_counts.get(sig["ticker"], 0) + 1
    if ticker_counts:
        print("\nSignals by ticker:")
        for ticker, count in sorted(ticker_counts.items(), key=lambda x: -x[1]):
            print(f"  {ticker}: {count}")


if __name__ == "__main__":
    main()
