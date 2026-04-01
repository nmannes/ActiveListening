import asyncio
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from collections import defaultdict
from pylib.trade_processor import TradeProcessor
from pylib.audio_processor import AudioProcessor
from pylib.keyword_matching import build_keyword_index
from pylib.test_audio_processor import MockWebSocket

class MockServerConfig:
    def __init__(self):
        self.trade_for_real = True
        self.buy_count = 10
        self.last_words_count = 5

class MockKalshiClient:
    def __init__(self):
        self.place_fill_or_kill_order = MagicMock(return_value={"status": "success"})

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
        self.is_content_visible = True
        
        # The mock data contains "cherry blossom", so we use that as the keyword.
        self.market = {
            "title": "Cherry Blossom Prediction",
            "purchasePrice": 90,
            "purchaseCount": 5,
            "keywordConfigs": {
                "cherry blossom": {
                    "purchasePrice": 95,
                    "purchaseCount": 10
                }
            }
        }
        
        keywords = {
            "cherry blossom": "CHERRY-YES"
        }
        self.keyword_index = build_keyword_index(keywords)


def test_trade_processor_with_deepgram_mocks():
    """Verify that piping actual deepgram mock data correctly triggers order placement."""
    async def run_test():
        session = MockSession()
        
        resp_dir = Path(__file__).parent.parent / "deepgram_responses"
        mock_ws = MockWebSocket(resp_dir)
        
        with patch("pylib.trade_processor.send_telegram") as mock_telegram:
            processor = TradeProcessor(session)
            # Add all possible speakers to whitelist so we catch the cherry blossom mention
            for i in range(20):
                processor.add_trading_speaker(str(i))
            
            # Setup audio processor to route tokens to trade processor
            audio_proc = AudioProcessor(session, on_tokens_callback=processor.process_tokens)
            
            # Process mock websocket feed
            await audio_proc.receive_results(mock_ws)
            
            # Verify kalshi api was triggered correctly
            await asyncio.sleep(0.1)
            session.server.kalshi.place_fill_or_kill_order.assert_called_once_with(
                yes_price=95,
                ticker="CHERRY-YES",
                count=10
            )
            
            # Verify index cleanup
            assert "blossom" not in session.keyword_index or len(session.keyword_index["blossom"]) == 0
            
    asyncio.run(run_test())


def test_trade_processor_ignores_unwhitelisted_speaker_with_deepgram_mocks():
    """Verify that if no speakers are whitelisted, the same mock data does NOT trigger an order."""
    async def run_test():
        session = MockSession()
        
        resp_dir = Path(__file__).parent.parent / "deepgram_responses"
        mock_ws = MockWebSocket(resp_dir)
        
        with patch("pylib.trade_processor.send_telegram") as mock_telegram:
            processor = TradeProcessor(session)
            # NOT adding any speakers to processor.trading_speakers
            
            audio_proc = AudioProcessor(session, on_tokens_callback=processor.process_tokens)
            await audio_proc.receive_results(mock_ws)
            await asyncio.sleep(0.1)
            
            session.server.kalshi.place_fill_or_kill_order.assert_not_called()
            
    asyncio.run(run_test())


def test_trade_processor_no_trade_when_content_invisible_with_deepgram_mocks():
    """Verify that if content isn't visible on screen, orders are skipped despite matching tokens."""
    async def run_test():
        session = MockSession()
        session.is_content_visible = False
        
        resp_dir = Path(__file__).parent.parent / "deepgram_responses"
        mock_ws = MockWebSocket(resp_dir)
        
        with patch("pylib.trade_processor.send_telegram") as mock_telegram:
            processor = TradeProcessor(session)
            for i in range(20):
                processor.add_trading_speaker(str(i))
            
            audio_proc = AudioProcessor(session, on_tokens_callback=processor.process_tokens)
            await audio_proc.receive_results(mock_ws)
            await asyncio.sleep(0.1)
            
            session.server.kalshi.place_fill_or_kill_order.assert_not_called()
            
    asyncio.run(run_test())
