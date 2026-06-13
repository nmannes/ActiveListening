#!/usr/bin/env python3
"""Test Kalshi order placement via the v2 /portfolio/events/orders endpoint.

Usage:
    python scripts/test_order.py <TICKER> [DOLLAR_AMOUNT] [--side yes|no] [--env prod|demo]
    python scripts/test_order.py KXPSAKIMENTION-26JUN12-TRUM
    python scripts/test_order.py KXPSAKIMENTION-26JUN12-TRUM 5 --side no

Requires:
    KALSHI_KEY_ID
    KALSHI_PRIVATE_KEY_PATH
"""

import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pylib.kalshi_client import KalshiClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Test Kalshi order placement")
    parser.add_argument("ticker", help="Market ticker (e.g. KXPSAKIMENTION-26JUN12-TRUM)")
    parser.add_argument("dollar_amount", type=float, nargs="?", default=5.0,
                        help="Dollar amount to spend (default: 5)")
    parser.add_argument("--side", choices=["yes", "no"], default="yes",
                        help="Side to buy (default: yes)")
    parser.add_argument("--env", choices=["prod", "demo"], default="prod",
                        help="API environment (default: prod)")
    parser.add_argument("--limit", action="store_true",
                        help="Use fill-or-kill limit order instead of market order")
    args = parser.parse_args()

    key_id = os.environ.get("KALSHI_KEY_ID")
    private_key_path = os.environ.get("KALSHI_PRIVATE_KEY_PATH")
    if not key_id or not private_key_path:
        logger.error("KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH must be set")
        sys.exit(1)

    client = KalshiClient(
        key_id=key_id,
        private_key_path=private_key_path,
        environment=args.env,
    )

    logger.info(f"Placing {'limit' if args.limit else 'market'} order: "
                f"ticker={args.ticker} side={args.side} amount=${args.dollar_amount:.2f}")

    try:
        if args.limit:
            result = client.place_fill_or_kill_order(
                ticker=args.ticker,
                count=max(1, int(args.dollar_amount / 0.99)),
                side=args.side,
                price_cents=99,
            )
        else:
            result = client.place_market_order(
                ticker=args.ticker,
                dollar_amount=args.dollar_amount,
                side=args.side,
            )

        print(f"\nOrder: {result.model_dump_json(indent=2)}")
        print(f"Status: {result.status}")
        print(f"Fill cost: ${float(result.taker_fill_cost_dollars):.2f}")

    except Exception as e:
        logger.exception(f"Order failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
