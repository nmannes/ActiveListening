#!/usr/bin/env python3
"""Quick integration test for OrderbookTracker against Kalshi demo."""

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

os.environ.setdefault("KALSHI_KEY_ID", "4c141bfe-6e97-4baa-acd4-4e615dc10b8d")
os.environ.setdefault("KALSHI_PRIVATE_KEY_PATH", "./demo_private_key.txt")

from pylib.kalshi_client import KalshiClient
from pylib.orderbook_tracker import OrderbookTracker

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


async def main():
    kalshi = KalshiClient(
        key_id=os.environ["KALSHI_KEY_ID"],
        private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
        environment="demo",
    )

    # Pick 3 tickers from live markets (NBA Summer League spreads, Jul 2026)
    tickers = [
        "KXNBASUMMERSPREAD-26JUL16DALOKC-DAL25",
        "KXNBASUMMERSPREAD-26JUL16DALOKC-DAL22",
        "KXNBASUMMERSPREAD-26JUL16DALOKC-DAL19",
    ]

    tracker = OrderbookTracker(tickers=tickers, kalshi=kalshi, environment="demo")
    task = asyncio.create_task(tracker.run())

    print("Waiting for snapshots...")
    try:
        await tracker.wait_ready(timeout=20.0)
    except asyncio.TimeoutError:
        print("Timed out waiting for snapshots")
        tracker.stop()
        task.cancel()
        return 1

    print()
    for ticker in tickers:
        best_ask = tracker.get_best_yes_ask(ticker)
        best_bid = tracker.get_best_yes_bid(ticker)
        print(f"{ticker}:")
        print(f"  best YES ask : ${best_ask:.4f}" if best_ask else f"  best YES ask : None")
        print(f"  best YES bid : ${best_bid:.4f}" if best_bid else f"  best YES bid : None")
        print()

    tracker.stop()
    task.cancel()
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
