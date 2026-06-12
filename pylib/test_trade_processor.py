import asyncio
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from collections import defaultdict
from pylib.trade_processor import TradeProcessor
from pylib.keyword_matching import build_keyword_index
from pylib.kalshi_client import Order, OrderResponse


class MockServerConfig:
    def __init__(self):
        self.trade_for_real = True
        self.buy_count = 10
        self.buy_max_cost = 5
        self.last_words_count = 5


class MockKalshiClient:
    def __init__(self):
        self.place_fill_or_kill_order = MagicMock(return_value=OrderResponse(
            order=Order(
                action="buy",
                book_side="bid",
                client_order_id="auto_test",
                created_time="2026-05-31T01:35:30.727688Z",
                fill_count_fp="0.00",
                initial_count_fp="1.00",
                last_update_time="2026-05-31T01:35:30.727688Z",
                maker_fees_dollars="0.000000",
                maker_fill_cost_dollars="0.000000",
                no_price_dollars="0.1000",
                order_id="test-order-id",
                outcome_side="yes",
                remaining_count_fp="0.00",
                side="yes",
                status="canceled",
                subaccount_number=0,
                taker_fees_dollars="0.000000",
                taker_fill_cost_dollars="0.000000",
                ticker="CHERRY-YES",
                type="limit",
                user_id="test-user-id",
                yes_price_dollars="0.9000",
            )
        ))
        self.place_market_order = MagicMock(return_value=OrderResponse(
            order=Order(
                action="buy",
                book_side="bid",
                client_order_id="auto_test",
                created_time="2026-05-31T01:35:30.727688Z",
                fill_count_fp="10.00",
                initial_count_fp="10.00",
                last_update_time="2026-05-31T01:35:30.727688Z",
                maker_fees_dollars="0.000000",
                maker_fill_cost_dollars="0.000000",
                no_price_dollars="0.1000",
                order_id="test-order-id",
                outcome_side="yes",
                remaining_count_fp="0.00",
                side="yes",
                status="filled",
                subaccount_number=0,
                taker_fees_dollars="0.000000",
                taker_fill_cost_dollars="9.000000",
                ticker="CHERRY-YES",
                type="market",
                user_id="test-user-id",
                yes_price_dollars="0.9000",
            )
        ))


class MockServer:
    def __init__(self):
        self.config = MockServerConfig()
        self.kalshi = MockKalshiClient()


class MockSession:
    def __init__(self):
        self.session_id = "test_session"
        self.audio_inbox_lock = MagicMock()
        self.audio_inbox = bytearray()
        self.transcript = defaultdict(list)
        self.transcript_lock = AsyncMock()
        self.server = MockServer()
        self.websocket = AsyncMock()
        self.market = {
            "title": "Cherry Blossom Prediction",
            "keywordConfigs": {
                "cherry blossom": {"dollarAmount": 10}
            },
        }

        keywords = {"cherry blossom": "CHERRY-YES"}
        self.keyword_index = build_keyword_index(keywords)


def test_trade_processor_with_whitelist_notifies_and_trades():
    """Verify that whitelisted speaker triggers both Telegram and Kalshi order."""

    async def run_test():
        session = MockSession()
        with patch("asyncio.get_running_loop") as mock_get_loop, patch(
            "pylib.trade_processor.send_telegram"
        ) as mock_telegram:
            mock_loop = MagicMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor.side_effect = lambda executor, func, *args: func(
                *args
            )

            processor = TradeProcessor(session)
            processor.add_trading_speaker("0")

            tokens = [
                {"text": "cherry", "start": 0.1},
                {"text": "blossom", "start": 0.6},
            ]
            await processor.process_tokens(tokens, speaker_id="0")

            # Verify Telegram notification
            mock_telegram.assert_called()
            # Verify Kalshi order
            session.server.kalshi.place_market_order.assert_called_once_with(
                ticker="CHERRY-YES", dollar_amount=10
            )

    asyncio.run(run_test())


def test_trade_processor_without_whitelist_only_notifies():
    """Verify that unwhitelisted speaker triggers Telegram but NOT Kalshi order."""

    async def run_test():
        session = MockSession()
        with patch("asyncio.get_running_loop") as mock_get_loop, patch(
            "pylib.trade_processor.send_telegram"
        ) as mock_telegram:
            mock_loop = MagicMock()
            mock_get_loop.return_value = mock_loop
            mock_loop.run_in_executor.side_effect = lambda executor, func, *args: func(
                *args
            )

            processor = TradeProcessor(session)
            # speaker "1" is NOT whitelisted

            tokens = [
                {"text": "cherry", "start": 0.1},
                {"text": "blossom", "start": 0.6},
            ]
            await processor.process_tokens(tokens, speaker_id="1")

            # Verify Telegram notification
            mock_telegram.assert_called()
            # Verify Kalshi order was NOT triggered
            session.server.kalshi.place_market_order.assert_not_called()

    asyncio.run(run_test())


