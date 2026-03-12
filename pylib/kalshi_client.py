"""
kalshi_client.py — Thin wrapper around the Kalshi Python sync SDK.
"""

import logging
import time
from pathlib import Path

logger = logging.getLogger("remote_server")


class KalshiClient:
    """Thin wrapper around the Kalshi Python sync SDK."""

    def __init__(self, key_id: str, private_key_path: str, environment: str = "prod"):
        from kalshi_python_sync import Configuration, ApiClient, OrdersApi, MarketApi, PortfolioApi

        self.key_id = key_id
        self.private_key_path = private_key_path
        self.environment = environment

        base_path = (
            "https://api.elections.kalshi.com/trade-api/v2"
            if environment == "prod"
            else "https://demo-api.kalshi.co/trade-api/v2"
        )

        config = Configuration(host=base_path)
        api_client = ApiClient(config)
        
        from kalshi_python_sync.auth import KalshiAuth
        private_key = Path(private_key_path).read_text()
        api_client.kalshi_auth = KalshiAuth(key_id=key_id, private_key_pem=private_key)

        self.orders_api = OrdersApi(api_client)
        self.market_api = MarketApi(api_client)
        self.portfolio_api = PortfolioApi(api_client)
        logger.info(f"Kalshi SDK initialized for {base_path}")

    def place_fill_or_kill_order(self, ticker: str, count: int, action: str = "buy",
                                  side: str = "yes", order_type: str = "market",
                                  yes_price: int = None, no_price: int = None):
        params = {
            "ticker": ticker,
            "action": action,
            "side": side.lower(),
            "count": count,
            "type": order_type,
            "time_in_force": "immediate_or_cancel",
            "client_order_id": f"auto_{int(time.time() * 1000)}",
        }

        if yes_price is not None:
            params["yes_price"] = yes_price
        if no_price is not None:
            params["no_price"] = no_price

        # Default prices for market orders
        if order_type == "market" and yes_price is None and no_price is None:
            if side.lower() == "yes":
                params["yes_price"] = 90
            else:
                params["no_price"] = 10

        return self.orders_api.create_order(**params)
