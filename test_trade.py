import os
import time
import logging
from pathlib import Path

# Load env file
env_file = Path(__file__).parent / ".env.prod"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

from pylib.kalshi_client import KalshiClient

logging.basicConfig(level=logging.INFO)

def test_trade():
    kalshi = KalshiClient(
        key_id=os.environ["KALSHI_KEY_ID"],
        private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
        environment="prod"
    )

    ticker = "KXNCAABMENTION-26MAR20SCUUK-NIL"
    buy_count = 1

    print("Testing place_fill_or_kill_order...")
    order_result = None
    try:
        t0_trade = time.time()
        order_result = kalshi.place_fill_or_kill_order(
            order_type="limit",
            yes_price=1,
            ticker=ticker,
            count=buy_count,
        )
        t1_trade = time.time()
        print(f"[TRADE] Successfully placed order for {ticker} (took {t1_trade - t0_trade:.4f}s)")
        print(f"Result: {order_result}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[TRADE] Error placing order. error: {e}, result: {order_result}")

if __name__ == "__main__":
    test_trade()
