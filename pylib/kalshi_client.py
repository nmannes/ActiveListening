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


class Order(BaseModel):
    action: str
    book_side: str
    client_order_id: str
    created_time: str
    fill_count_fp: str
    initial_count_fp: str
    last_update_time: str
    maker_fees_dollars: str
    maker_fill_cost_dollars: str
    no_price_dollars: str
    order_id: str
    outcome_side: str
    remaining_count_fp: str
    side: str
    status: str
    subaccount_number: int
    taker_fees_dollars: str
    taker_fill_cost_dollars: str
    ticker: str
    type: str
    user_id: str
    yes_price_dollars: str


class OrderResponse(BaseModel):
    order: Order

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
        action: str = "buy",
        side: str = "yes",
        yes_price: int = 1,
    ):
        params = {
            "ticker": ticker,
            "type": "limit",
            "action": action,
            "side": side.lower(),
            "count": count,
            "time_in_force": "immediate_or_cancel",
            "client_order_id": f"auto_{int(time.time() * 1000)}",
            "yes_price": yes_price,
        }

        path = "/portfolio/orders"
        url = self.base_url + path
        headers = self._get_auth_headers("POST", url)

        response = self.session.post(url, json=params, headers=headers)

        try:
            response.raise_for_status()
            return OrderResponse.model_validate(response.json())
        except requests.exceptions.HTTPError as e:
            logger.error(f"Kalshi API error: {response.status_code} - {response.text}")
            raise e

    def place_market_order(
        self,
        ticker: str,
        dollar_amount: float,
        side: str = "yes",
    ):
        """Place a market order spending up to dollar_amount dollars.

        Uses buy_max_cost (in cents) to cap total spend, with type=market
        to fill at the best available price.
        """
        buy_max_cost = round(dollar_amount * 100)
        params = {
            "ticker": ticker,
            "type": "market",
            "action": "buy",
            "side": side.lower(),
            "buy_max_cost": buy_max_cost,
            "client_order_id": f"auto_{int(time.time() * 1000)}",
        }

        path = "/portfolio/orders"
        url = self.base_url + path
        headers = self._get_auth_headers("POST", url)

        response = self.session.post(url, json=params, headers=headers)

        try:
            response.raise_for_status()
            return OrderResponse.model_validate(response.json())
        except requests.exceptions.HTTPError as e:
            logger.error(f"Kalshi API error: {response.status_code} - {response.text}")
            raise e
