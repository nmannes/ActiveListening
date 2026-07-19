#!/usr/bin/env python3
"""
replay.py — Replay Deepgram responses through keyword matching and capture signals.

For each historical session:
  1. Reads dg_*.json files from deepgram_responses/ in lexicographic order
  2. Builds keyword index from the market JSON
  3. Deduplicates tokens per speaker, feeds through SignalDetector.feed_token()
  4. Captures every keyword match with metadata (keyword, ticker, timestamp, confidence, speaker)
  5. Applies speaker whitelist based on event type:
     - Sports (NBA/MLB/NHL/NCAA): top 3 speakers by word count are trading speakers
     - Earnings calls: any speaker with ≥100 words is auto-allowlisted
     - Other: top 2 speakers, or speakers from speaker_labels.json if available
  6. Writes signals.jsonl with one JSON line per signal

Usage:
    PYTHONPATH=. python backtest/replay.py s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14
    PYTHONPATH=. python backtest/replay.py s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14 --market scheduled/kxnbamention-26apr28phibos.json
"""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pylib.keyword_matching import build_keyword_index
from pylib.signal_detector import SignalDetector

SCHEDULED_DIR = REPO_ROOT / "scheduled"
OUTPUT_DIR = REPO_ROOT / "backtest_data"


# ── Event type detection ──────────────────────────────────────────────────

def detect_event_type(slug: str) -> str:
    """Determine event category from the market slug."""
    s = slug.lower()
    if any(k in s for k in ("nba", "mlb", "nhl", "ncaa", "nfl", "soccer", "wcment")):
        return "sports"
    if "earnings" in s:
        return "earnings"
    if any(k in s for k in ("hearing", "hegseth", "secpress", "steyer",
                              "bernie", "trump", "rfk", "vance")):
        return "political"
    if "latenight" in s:
        return "tv"
    return "other"


# ── Speaker whitelist ─────────────────────────────────────────────────────

def build_speaker_whitelist(
    event_type: str,
    speaker_word_counts: dict[str, int],
    speaker_labels: dict[str, str] | None = None,
) -> set[str]:
    """Return the set of speaker IDs allowed to trigger trades."""
    if event_type == "sports":
        # Announcers have the most speaking time across the full event duration
        top = sorted(speaker_word_counts.items(), key=lambda x: x[1], reverse=True)
        whitelist = {sid for sid, _ in top[:3]}

    elif event_type == "earnings":
        # Any speaker with substantial speaking time is likely a company exec
        whitelist = {sid for sid, c in speaker_word_counts.items() if c >= 100}

    elif event_type in ("political", "tv", "other"):
        if speaker_labels:
            whitelist = set(speaker_labels.keys())
        else:
            top = sorted(speaker_word_counts.items(), key=lambda x: x[1], reverse=True)
            whitelist = {sid for sid, _ in top[:2]}

    print(f"  Event type: {event_type}")
    print(f"  Speaker word counts: {dict(speaker_word_counts)}")
    print(f"  Whitelisted speakers: {whitelist}")
    return whitelist


# ── Token deduplication ───────────────────────────────────────────────────

class TokenDeduper:
    """Per-speaker dedup, mirroring TradeProcessor._update_transcript logic."""

    def __init__(self):
        self._seen: dict[str, set[str]] = defaultdict(set)

    def dedupe(self, speaker_id: str, tokens: list[dict]) -> list[dict]:
        """Return tokens not yet seen for this speaker, sorted by start time."""
        seen = self._seen[speaker_id]
        new: list[dict] = []
        for t in sorted(tokens, key=lambda x: x.get("start", 0)):
            text = t["text"].strip()
            if not text or text in seen:
                continue
            seen.add(text)
            new.append(t)
        return new


# ── Market JSON loading ───────────────────────────────────────────────────

def load_market(session_dir: Path, market_arg: str | None = None) -> dict | None:
    """Load market JSON from --market, session dir, or scheduled/."""
    if market_arg:
        market_path = Path(market_arg)
        if not market_path.is_absolute():
            market_path = REPO_ROOT / market_path
        if market_path.exists():
            return json.loads(market_path.read_text())
        print(f"ERROR: Market file not found: {market_path}")
        return None

    slug = session_dir.name
    parts = slug.split("_")
    clean_slug = parts[0]

    for candidate in [
        session_dir / f"{clean_slug}.json",
        SCHEDULED_DIR / f"{clean_slug}.json",
    ]:
        if candidate.exists():
            return json.loads(candidate.read_text())

    print(f"ERROR: No market JSON found for slug '{clean_slug}'")
    return None


# ── Main replay ───────────────────────────────────────────────────────────

def replay_session(session_dir: Path, market: dict, speaker_labels: dict[str, str] | None = None) -> list[dict]:
    """Replay all Deepgram responses and capture keyword matches.

    Returns list of signal dicts with keys:
      keyword, ticker, timestamp, end, confidence, avg_confidence,
      confidences, speaker_id, whitelisted, event_type
    """
    dg_dir = session_dir / "deepgram_responses"
    if not dg_dir.is_dir():
        print(f"ERROR: No deepgram_responses/ in {session_dir}")
        return []

    response_files = sorted(dg_dir.glob("dg_*.json"))
    print(f"Found {len(response_files)} Deepgram responses")

    keyword_index = build_keyword_index(market.get("keywords", {}))
    detector = SignalDetector()
    deduper = TokenDeduper()
    speaker_word_counts: dict[str, int] = defaultdict(int)
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

        formatted_tokens = [
            {
                "text": w["word"].lower(),
                "start": w["start"],
                "end": w["end"],
                "confidence": round(w.get("confidence", 0), 3),
            }
            for w in words
        ]

        new_tokens = deduper.dedupe(speaker_id, formatted_tokens)
        speaker_word_counts[speaker_id] += len(new_tokens)

        for token in new_tokens:
            match = detector.feed_token(speaker_id, token, keyword_index)
            if match:
                signals.append({
                    "keyword": match["key"],
                    "ticker": match["value"],
                    "timestamp": token["start"],
                    "end": token["end"],
                    "confidence": match["min_confidence"],
                    "avg_confidence": match["avg_confidence"],
                    "confidences": match["confidences"],
                    "speaker_id": speaker_id,
                })

        processed += 1

    print(f"Processed {processed} responses, {sum(speaker_word_counts.values())} unique words, captured {len(signals)} signals")

    # Apply speaker whitelist
    slug = market.get("slug", session_dir.name.split("_")[0])
    event_type = detect_event_type(slug)
    whitelist = build_speaker_whitelist(event_type, speaker_word_counts, speaker_labels)

    for sig in signals:
        sig["whitelisted"] = sig["speaker_id"] in whitelist
        sig["event_type"] = event_type

    whitelisted_signals = sum(1 for s in signals if s["whitelisted"])
    print(f"  {whitelisted_signals}/{len(signals)} signals from whitelisted speakers")

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

    # Load speaker labels if available
    speaker_labels: dict[str, str] | None = None
    labels_path = REPO_ROOT / "data" / "speaker_labels.json"
    if labels_path.exists():
        all_labels = json.loads(labels_path.read_text())
        for key, labels in all_labels.items():
            if key.startswith(market.get("slug", "")):
                speaker_labels = labels
                print(f"Found speaker labels for {key}")
                break

    signals = replay_session(session_dir, market, speaker_labels)

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
