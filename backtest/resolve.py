#!/usr/bin/env python3
"""Fetch and cache market resolutions from Kalshi API.

Reads tickers from signals.jsonl files (or takes them directly),
fetches resolution status from Kalshi, and caches to cache/resolutions.json.

Usage:
    python backtest/resolve.py --signals-dir backtest_data/kxnbamention-26apr28phibos
    python backtest/resolve.py --tickers TICKER1 TICKER2
"""

import argparse
import json
import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
CACHE_DIR = REPO_ROOT / "cache"
CACHE_FILE = CACHE_DIR / "resolutions.json"


def load_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text())
    return {}


def save_cache(cache: dict):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(json.dumps(cache, indent=2))


def extract_tickers_from_signals_dir(signals_dir: Path) -> set[str]:
    """Extract unique tickers from a signals.jsonl file."""
    signals_file = signals_dir / "signals.jsonl"
    if not signals_file.exists():
        signals_file = Path(signals_dir)  # might be the file itself
    if not signals_file.exists():
        print(f"No signals.jsonl found in {signals_dir}")
        return set()

    tickers = set()
    with open(signals_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                signal = json.loads(line)
                tickers.add(signal["ticker"])
            except (json.JSONDecodeError, KeyError):
                continue
    return tickers


def resolve_tickers(tickers: set[str], key_id: str, private_key_path: str, environment: str = "prod") -> dict:
    """Fetch resolutions from Kalshi API for a set of tickers."""
    from pylib.kalshi_client import KalshiClient

    client = KalshiClient(key_id=key_id, private_key_path=private_key_path, environment=environment)
    results = {}

    for ticker in sorted(tickers):
        print(f"  Fetching {ticker}...", end=" ")
        market = client.get_market(ticker)
        if market is None:
            print("FAILED")
            continue

        status = market.get("status", "unknown")
        result = market.get("result")  # "yes", "no", or None
        title = market.get("title", ticker)
        close_time = market.get("close_time", "")

        results[ticker] = {
            "status": status,
            "result": result,
            "title": title,
            "close_time": close_time,
        }
        result_str = result.upper() if result else "unresolved"
        print(f"{status} → {result_str} ({title[:60]})")

    return results


def main():
    parser = argparse.ArgumentParser(description="Fetch and cache market resolutions")
    parser.add_argument("--signals-dir", help="Directory containing signals.jsonl (or path to the file)")
    parser.add_argument("--tickers", nargs="+", help="Tickers to fetch directly")
    parser.add_argument("--key-id", default=os.environ.get("KALSHI_KEY_ID", ""), help="Kalshi API key ID")
    parser.add_argument("--private-key", default=os.environ.get("KALSHI_PRIVATE_KEY", ""), help="Path to RSA private key")
    parser.add_argument("--environment", default="prod", choices=["prod", "demo"], help="API environment")
    parser.add_argument("--show-cache", action="store_true", help="Print current cache contents and exit")
    args = parser.parse_args()

    if args.show_cache:
        cache = load_cache()
        for ticker, info in sorted(cache.items()):
            result = info.get("result", "?") or "unresolved"
            print(f"  {ticker}: {info.get('status', '?')} → {result}")
        print(f"\n{len(cache)} tickers cached")
        return

    tickers: set[str] = set()
    if args.signals_dir:
        tickers.update(extract_tickers_from_signals_dir(Path(args.signals_dir)))
    if args.tickers:
        tickers.update(args.tickers)

    if not tickers:
        parser.print_help()
        print("\nERROR: Provide --signals-dir or --tickers")
        sys.exit(1)

    cache = load_cache()
    missing = tickers - set(cache.keys())
    already = tickers & set(cache.keys())

    if already:
        print(f"{len(already)} tickers already cached, {len(missing)} need fetching\n")

    if missing:
        if not args.key_id or not args.private_key:
            print("ERROR: KALSHI_KEY_ID and KALSHI_PRIVATE_KEY env vars required for API access")
            print(f"  Missing: {', '.join(sorted(missing))}")
            sys.exit(1)

        print(f"Fetching {len(missing)} tickers...")
        new_results = resolve_tickers(missing, args.key_id, args.private_key, args.environment)
        cache.update(new_results)
        save_cache(cache)
        print(f"\nUpdated cache at {CACHE_FILE} ({len(cache)} total)")

    # Print summary of requested tickers
    print(f"\nResolution summary for {len(tickers)} tickers:")
    yes_count = 0
    no_count = 0
    unresolved = 0
    for ticker in sorted(tickers):
        info = cache.get(ticker, {})
        result = info.get("result")
        if result == "yes":
            yes_count += 1
            print(f"  {ticker}: YES — {info.get('title', '')[:60]}")
        elif result == "no":
            no_count += 1
            print(f"  {ticker}: NO — {info.get('title', '')[:60]}")
        else:
            unresolved += 1
            status = info.get("status", "unknown")
            print(f"  {ticker}: {status} (unresolved)")

    print(f"\n  YES: {yes_count}, NO: {no_count}, unresolved: {unresolved}")


if __name__ == "__main__":
    main()
