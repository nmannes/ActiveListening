import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from collections import defaultdict
from pylib.trade_processor import TradeProcessor
from pylib.signal_detector import SignalDetector
from pylib.signal_handler import SignalHandler
from pylib.keyword_matching import build_keyword_index
from pylib.kalshi_client import OrderV2


class MockServerConfig:
    def __init__(self):
        self.trade_for_real = True
        self.buy_count = 10
        self.buy_max_cost = 5
        self.last_words_count = 5
        self.min_confidence = 0


class MockKalshiClient:
    def __init__(self):
        self.place_market_order = MagicMock(return_value=OrderV2(
            order_id="test-order-id",
            fill_count="10.00",
            remaining_count="0.00",
            ts_ms=0,
            client_order_id="auto_test",
            average_fill_price="0.9000",
        ))


class MockServer:
    def __init__(self):
        self.config = MockServerConfig()
        self.kalshi = MockKalshiClient()


class MockSession:
    def __init__(self):
        self.session_id = "test_session"
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


# ── SignalDetector tests (pure functions, no async) ──────────────────────────

class TestSignalDetector:
    def test_feed_token_returns_none_when_no_match(self):
        idx = build_keyword_index({"cherry blossom": "CHERRY-YES"})
        detector = SignalDetector()
        assert detector.feed_token("0", "hello", idx) is None

    def test_feed_token_returns_match_on_keyword(self):
        idx = build_keyword_index({"cherry blossom": "CHERRY-YES"})
        detector = SignalDetector()
        detector.feed_token("0", "cherry", idx)
        match = detector.feed_token("0", "blossom", idx)
        assert match == {"key": "cherry blossom", "value": "CHERRY-YES"}

    def test_feed_token_buffers_per_speaker(self):
        idx = build_keyword_index({"hello": "HELLO-YES"})
        detector = SignalDetector()
        detector.feed_token("0", "hel", idx)
        detector.feed_token("1", "hel", idx)
        assert detector.speaker_buffers["0"] == ["hel"]
        assert detector.speaker_buffers["1"] == ["hel"]


# ── SignalHandler tests ──────────────────────────────────────────────────────

class TestSignalHandler:
    def _make_session(self):
        return MockSession()

    @pytest.mark.asyncio
    async def test_skips_trade_when_speaker_not_whitelisted(self):
        session = self._make_session()
        handler = SignalHandler(session)

        with patch("pylib.signal_handler.send_telegram"):
            await handler.handle_signal(
                {"key": "cherry blossom", "value": "CHERRY-YES"},
                speaker_id="1",
                token={"text": "blossom", "start": 0.6},
            )

        session.server.kalshi.place_market_order.assert_not_called()

    @pytest.mark.asyncio
    async def test_places_order_for_whitelisted_speaker(self):
        session = self._make_session()
        handler = SignalHandler(session)
        handler.add_trading_speaker("0")

        with patch("pylib.signal_handler.send_telegram"):
            await handler.handle_signal(
                {"key": "cherry blossom", "value": "CHERRY-YES"},
                speaker_id="0",
                token={"text": "blossom", "start": 0.6},
            )

        session.server.kalshi.place_market_order.assert_called_once_with(
            ticker="CHERRY-YES", dollar_amount=10
        )

    @pytest.mark.asyncio
    async def test_skips_when_trade_for_real_is_false(self):
        session = self._make_session()
        session.server.config.trade_for_real = False
        handler = SignalHandler(session)
        handler.add_trading_speaker("0")

        with patch("pylib.signal_handler.send_telegram"):
            await handler.handle_signal(
                {"key": "cherry blossom", "value": "CHERRY-YES"},
                speaker_id="0",
                token={"text": "blossom", "start": 0.6},
            )

        session.server.kalshi.place_market_order.assert_not_called()

    @pytest.mark.asyncio
    async def test_skips_when_confidence_below_threshold(self):
        session = self._make_session()
        session.server.config.min_confidence = 0.8
        handler = SignalHandler(session)
        handler.add_trading_speaker("0")

        with patch("pylib.signal_handler.send_telegram"):
            await handler.handle_signal(
                {"key": "cherry blossom", "value": "CHERRY-YES"},
                speaker_id="0",
                token={"text": "blossom", "start": 0.6, "confidence": 0.3},
            )

        session.server.kalshi.place_market_order.assert_not_called()


# ── TradeProcessor integration tests ─────────────────────────────────────────

class TestTradeProcessorIntegration:
    @pytest.mark.asyncio
    async def test_whitelisted_speaker_triggers_trade(self):
        session = MockSession()
        with patch("pylib.signal_handler.send_telegram"):
            processor = TradeProcessor(session)
            processor.add_trading_speaker("0")
            await processor.process_tokens(
                [{"text": "cherry", "start": 0.1}, {"text": "blossom", "start": 0.6}],
                speaker_id="0",
            )
        session.server.kalshi.place_market_order.assert_called_once_with(
            ticker="CHERRY-YES", dollar_amount=10
        )

    @pytest.mark.asyncio
    async def test_unwhitelisted_speaker_only_notifies(self):
        session = MockSession()
        with patch("pylib.signal_handler.send_telegram"):
            processor = TradeProcessor(session)
            await processor.process_tokens(
                [{"text": "cherry", "start": 0.1}, {"text": "blossom", "start": 0.6}],
                speaker_id="1",
            )
        session.server.kalshi.place_market_order.assert_not_called()
