"""
kalshi_client.py — Thin wrapper around the Kalshi REST API using requests.
"""

import logging
import time
import base64
import requests
from pathlib import Path
from pydantic import BaseModel
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.hazmat.backends import default_backend


class OrderV2(BaseModel):
    """Response from POST /portfolio/events/orders (v2)."""

    order_id: str
    fill_count: str
    remaining_count: str
    ts_ms: int
    client_order_id: str = ""
    average_fill_price: str = "0"
    average_fee_paid: str = "0"

    @property
    def status(self) -> str:
        filled = float(self.fill_count)
        if filled > 0:
            return "filled" if float(self.remaining_count) == 0 else "partially_filled"
        return "resting"

    @property
    def taker_fill_cost_dollars(self) -> str:
        return str(float(self.fill_count) * float(self.average_fill_price))

logger = logging.getLogger("remote_server")


class KalshiClient:
    """Thin wrapper around the Kalshi REST API."""

    def __init__(self, key_id: str, private_key_path: str, environment: str = "prod"):
        self.key_id = key_id
        self.private_key_path = private_key_path
        self.environment = environment

        self.base_url = (
            "https://api.elections.kalshi.com/trade-api/v2"
            if environment == "prod"
            else "https://demo-api.kalshi.co/trade-api/v2"
        )

        # Load the RSA private key
        private_key_bytes = Path(private_key_path).read_bytes()
        loaded_key = serialization.load_pem_private_key(
            private_key_bytes, password=None, backend=default_backend()
        )
        if not isinstance(loaded_key, RSAPrivateKey):
            raise ValueError("Private key must be an RSA key")
        self.private_key = loaded_key

        self.session = requests.Session()
        logger.info(f"Kalshi API initialized for {self.base_url}")

    def _get_auth_headers(self, method: str, url: str) -> dict:
        """Create Kalshi authentication headers for a request."""
        from urllib.parse import urlparse

        current_time_milliseconds = int(time.time() * 1000)
        timestamp_str = str(current_time_milliseconds)

        # Extract path from URL for signing
        parsed = urlparse(url)
        path = parsed.path

        # Create message to sign: timestamp + method + path
        msg_string = timestamp_str + method.upper() + path

        # Sign the message using RSA-PSS
        message = msg_string.encode("utf-8")
        signature = self.private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH
            ),
            hashes.SHA256(),
        )
        signature_b64 = base64.b64encode(signature).decode("utf-8")

        return {
            "Content-Type": "application/json",
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-SIGNATURE": signature_b64,
            "KALSHI-ACCESS-TIMESTAMP": timestamp_str,
        }

    def place_fill_or_kill_order(
        self,
        ticker: str,
        count: int,
        side: str = "yes",
        price_cents: int = 1,
    ):
        """Place a fill-or-kill limit order via v2 API.

        side: "yes" (buy YES) or "no" (buy NO via selling YES).
        price_cents: limit price in cents (1-99).
        """
        v2_side, v2_price = self._to_v2_params(side, price_cents)
        params = {
            "ticker": ticker,
            "side": v2_side,
            "price": v2_price,
            "count": str(count),
            "time_in_force": "fill_or_kill",
            "self_trade_prevention_type": "taker_at_cross",
            "client_order_id": f"auto_{int(time.time() * 1000)}",
        }

        response = self._post_order(params)
        try:
            response.raise_for_status()
            return OrderV2(**response.json())
        except requests.exceptions.HTTPError as e:
            logger.error(f"Kalshi API error: {response.status_code} - {response.text}")
            raise e

    def place_market_order(
        self,
        ticker: str,
        dollar_amount: float,
        side: str = "yes",
        best_ask_dollars: float | None = None,
    ):
        """Place an aggressive limit order spending up to dollar_amount dollars.

        Uses best_ask_dollars + 5¢ as the limit price when the orderbook
        tracker provides a current best ask. Falls back to 99¢ otherwise
        (simulating a market order). The 5¢ buffer preserves fill probability
        while capping how far the order can walk up a thin book.
        """
        ASK_BUFFER = 0.05
        if best_ask_dollars is not None and best_ask_dollars > 0:
            price_cents = min(99, round((best_ask_dollars + ASK_BUFFER) * 100))
        else:
            price_cents = 99
        v2_side, v2_price = self._to_v2_params(side, price_cents)
        count = max(1, int(dollar_amount / (price_cents / 100)))
        params = {
            "ticker": ticker,
            "side": v2_side,
            "price": v2_price,
            "count": str(count),
            "time_in_force": "immediate_or_cancel",
            "self_trade_prevention_type": "taker_at_cross",
            "client_order_id": f"auto_{int(time.time() * 1000)}",
        }

        response = self._post_order(params)
        try:
            response.raise_for_status()
            return OrderV2(**response.json())
        except requests.exceptions.HTTPError as e:
            logger.error(f"Kalshi API error: {response.status_code} - {response.text}")
            raise e

    def _to_v2_params(self, side: str, price_cents: int) -> tuple[str, str]:
        """Map legacy side ("yes"/"no") + price in cents to v2 (bid/ask, price string).

        bid = buy YES. ask = sell YES (economically buy NO at 1 - price).
        """
        if side.lower() == "yes":
            return ("bid", f"{price_cents / 100:.2f}")
        else:
            # buy NO -> sell YES (ask) at 1 - price
            return ("ask", f"{(100 - price_cents) / 100:.2f}")

    def get_ws_auth_headers(self) -> dict:
        """Create auth headers for the Kalshi WebSocket connection."""
        path = "/trade-api/ws/v2"
        current_time_milliseconds = int(time.time() * 1000)
        timestamp_str = str(current_time_milliseconds)
        msg_string = timestamp_str + "GET" + path
        message = msg_string.encode("utf-8")
        signature = self.private_key.sign(
            message,
            padding.PSS(
                mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH
            ),
            hashes.SHA256(),
        )
        signature_b64 = base64.b64encode(signature).decode("utf-8")
        return {
            "KALSHI-ACCESS-KEY": self.key_id,
            "KALSHI-ACCESS-SIGNATURE": signature_b64,
            "KALSHI-ACCESS-TIMESTAMP": timestamp_str,
        }

    def _post_order(self, params: dict) -> requests.Response:
        path = "/portfolio/events/orders"
        url = self.base_url + path
        headers = self._get_auth_headers("POST", url)
        return self.session.post(url, json=params, headers=headers)
