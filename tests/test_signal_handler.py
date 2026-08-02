#!/usr/bin/env python3
"""Unit tests for SignalHandler — session loss cap and trade gating."""

import asyncio
import sys
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from pylib.signal_handler import SignalHandler


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_config():
    cfg = MagicMock()
    cfg.trade_for_real = True
    cfg.min_confidence = 0.80
    cfg.min_yes_ask_price = 0.02
    cfg.max_session_loss = 100.0
    cfg.buy_max_cost = 5
    return cfg


@pytest.fixture
def mock_server(mock_config):
    srv = MagicMock()
    srv.config = mock_config
    return srv


@pytest.fixture
def mock_session(mock_server):
    sess = MagicMock()
    sess.server = mock_server
    sess.session_id = "test-session-1"
    sess.market = {"title": "Test Market", "slug": "test-market"}
    sess.keyword_index = {}
    sess.orderbook_tracker = None
    return sess


@pytest.fixture
def handler(mock_session):
    return SignalHandler(mock_session)


@pytest.fixture
def sample_match():
    return {
        "key": "touchdown",
        "value": "KXNBAMENTION-TEST-TOUCHDOWN",
        "min_confidence": 0.92,
    }


@pytest.fixture
def sample_token():
    return {"confidence": 0.95, "start": 120.0, "end": 121.5}


@contextmanager
def patch_execute_trade_deps():
    """Patch asyncio, send_telegram, and remove_market_from_index for
    sync tests that call _execute_trade directly."""
    loop = MagicMock()
    with patch("asyncio.get_running_loop", return_value=loop):
        with patch("pylib.signal_handler.send_telegram"):
            with patch("pylib.signal_handler.remove_market_from_index"):
                yield


# ── Initial state ───────────────────────────────────────────────────────────

class TestInit:
    def test_session_cost_starts_at_zero(self, handler):
        assert handler.session_cost_total == 0.0

    def test_session_cost_is_float(self, handler):
        assert isinstance(handler.session_cost_total, float)


# ── Session cap gate ────────────────────────────────────────────────────────

class TestSessionCapGate:
    """Tests for the max_session_loss gate in _execute_trade."""

    def test_trade_allowed_when_under_cap(self, handler, mock_session, sample_match):
        """First trade with $1 dollar amount — well under $100 cap."""
        handler.session_cost_total = 10.0
        mock_order = MagicMock()
        mock_order.status = "filled"
        mock_order.taker_fill_cost_dollars = 0.85
        handler._place_order = MagicMock(return_value=mock_order)

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_called_once()
        assert handler.session_cost_total == 10.85

    def test_trade_blocked_when_over_cap(self, handler, mock_session, sample_match):
        """Dollar amount would push session total past $100 cap."""
        handler.session_cost_total = 99.50
        handler._place_order = MagicMock()

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_not_called()
        assert handler.session_cost_total == 99.50

    def test_trade_blocked_when_exactly_at_cap(self, handler, mock_session, sample_match):
        """Already at $100 — any trade would exceed."""
        handler.session_cost_total = 100.0
        handler._place_order = MagicMock()

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_not_called()
        assert handler.session_cost_total == 100.0

    def test_trade_allowed_when_exactly_at_cap_boundary(self, handler, mock_session, sample_match):
        """At $99, a $1 trade is allowed (exactly hits cap)."""
        handler.session_cost_total = 99.0
        mock_order = MagicMock()
        mock_order.status = "filled"
        mock_order.taker_fill_cost_dollars = 1.00
        handler._place_order = MagicMock(return_value=mock_order)

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_called_once()
        assert handler.session_cost_total == 100.0

    def test_large_dollar_amount_blocked_near_cap(self, handler, mock_session, sample_match):
        """$25 trade when $80 already spent — blocked because 80+25 > 100."""
        handler.session_cost_total = 80.0
        handler._place_order = MagicMock()

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=25.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_not_called()
        assert handler.session_cost_total == 80.0

    def test_cap_is_float_comparison(self, handler, mock_session, mock_config, sample_match):
        """Verify cap comparison works with float values."""
        mock_config.max_session_loss = 50.0
        handler.session_cost_total = 49.99
        mock_order = MagicMock()
        mock_order.status = "filled"
        mock_order.taker_fill_cost_dollars = 0.01
        handler._place_order = MagicMock(return_value=mock_order)

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=0.01, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_called_once()
        assert handler.session_cost_total == 50.0


# ── Accumulation across multiple trades ─────────────────────────────────────

class TestMultiTradeAccumulation:
    """Tests that session_cost_total accumulates correctly across trades."""

    def test_three_trades_accumulate(self, handler, mock_session):
        handler.session_cost_total = 0.0

        for i in range(3):
            match = {"key": f"word-{i}", "value": f"TICKER-{i}", "min_confidence": 0.90}
            mock_order = MagicMock()
            mock_order.status = "filled"
            mock_order.taker_fill_cost_dollars = 0.95
            handler._place_order = MagicMock(return_value=mock_order)

            with patch_execute_trade_deps():
                handler._execute_trade(match, dollar_amount=1.0, confidence=0.92, start=float(i * 10), end=float(i * 10 + 1))

        assert handler.session_cost_total == pytest.approx(2.85, rel=1e-9)

    def test_fourth_trade_blocked_after_accumulation(self, handler, mock_session):
        """Three $33 trades = $99. Fourth $2 trade would exceed $100."""
        handler.session_cost_total = 0.0

        for i in range(3):
            match = {"key": f"word-{i}", "value": f"TICKER-{i}", "min_confidence": 0.90}
            mock_order = MagicMock()
            mock_order.status = "filled"
            mock_order.taker_fill_cost_dollars = 33.00
            handler._place_order = MagicMock(return_value=mock_order)

            with patch_execute_trade_deps():
                handler._execute_trade(match, dollar_amount=33.0, confidence=0.92, start=float(i * 10), end=float(i * 10 + 1))

        assert handler.session_cost_total == 99.0

        # 4th trade at $2 — 99 + 2 = 101 > 100, should be blocked
        match4 = {"key": "word-4", "value": "TICKER-4", "min_confidence": 0.90}
        handler._place_order = MagicMock()

        with patch_execute_trade_deps():
            handler._execute_trade(match4, dollar_amount=2.0, confidence=0.92, start=40.0, end=41.0)

        handler._place_order.assert_not_called()
        assert handler.session_cost_total == 99.0


# ── Different cap values from config ────────────────────────────────────────

class TestConfigurableCap:
    """Tests that the cap value comes from config and is respected."""

    def test_cap_50_blocks_at_50(self, handler, mock_config, sample_match):
        mock_config.max_session_loss = 50.0
        handler.session_cost_total = 49.50
        handler._place_order = MagicMock()

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_not_called()

    def test_cap_50_allows_at_49(self, handler, mock_config, sample_match):
        mock_config.max_session_loss = 50.0
        handler.session_cost_total = 48.0
        mock_order = MagicMock()
        mock_order.status = "filled"
        mock_order.taker_fill_cost_dollars = 1.00
        handler._place_order = MagicMock(return_value=mock_order)

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_called_once()

    def test_zero_cap_blocks_everything(self, handler, mock_config, sample_match):
        """max_session_loss=0 should block every trade."""
        mock_config.max_session_loss = 0.0
        handler._place_order = MagicMock()

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=0.01, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_not_called()


# ── Telegram notification on cap skip ───────────────────────────────────────

class TestCapSkipNotification:
    def test_sends_telegram_on_cap_skip(self, handler, mock_session, mock_config, sample_match):
        """When cap blocks a trade, a Telegram notification is queued."""
        mock_config.max_session_loss = 100.0
        handler.session_cost_total = 99.90
        handler._place_order = MagicMock()

        loop = MagicMock()
        with patch("asyncio.get_running_loop", return_value=loop):
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        handler._place_order.assert_not_called()

        # send_telegram is passed to loop.run_in_executor, not called directly.
        # Verify at least one run_in_executor call contains the cap-skip message.
        cap_calls = [
            c for c in loop.run_in_executor.call_args_list
            if len(c[0]) >= 3 and "session cap reached" in str(c[0][2]).lower()
        ]
        assert len(cap_calls) >= 1, (
            f"Expected a run_in_executor call with 'session cap reached', "
            f"got: {loop.run_in_executor.call_args_list}"
        )


# ── Integration with handle_signal ──────────────────────────────────────────

class TestHandleSignalIntegration:
    """Tests that handle_signal delegates to _execute_trade with cap tracking."""

    @pytest.mark.asyncio
    async def test_handle_signal_passes_through_to_execute_trade(
        self, handler, mock_session, sample_match, sample_token
    ):
        """When all gates pass, handle_signal should call _execute_trade."""
        handler.add_trading_speaker("speaker-1")
        handler._send_signal_telegram = MagicMock()
        handler._notify_client = AsyncMock()
        called_with = {}

        def capture(*args, **kwargs):
            called_with["dollar_amount"] = kwargs.get("dollar_amount", args[1] if len(args) > 1 else None)

        handler._execute_trade = MagicMock(side_effect=capture)

        with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0):
            await handler.handle_signal(sample_match, "speaker-1", sample_token)

        handler._execute_trade.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_signal_skips_non_trading_speaker(
        self, handler, mock_session, sample_match, sample_token
    ):
        """Non-whitelisted speaker should skip before reaching cap check."""
        handler._send_signal_telegram = MagicMock()
        handler._notify_client = AsyncMock()
        handler._execute_trade = MagicMock()

        await handler.handle_signal(sample_match, "unknown-speaker", sample_token)

        handler._execute_trade.assert_not_called()


# ── Order failure does not increment cost ───────────────────────────────────

class TestOrderFailure:
    def test_failed_order_does_not_increment_total(self, handler, mock_session, sample_match):
        handler.session_cost_total = 10.0
        handler._place_order = MagicMock(return_value=None)

        with patch_execute_trade_deps():
            handler._execute_trade(sample_match, dollar_amount=1.0, confidence=0.92, start=10.0, end=11.0)

        # Cost should be unchanged since order returned None
        assert handler.session_cost_total == 10.0


# ── Multi-market fixtures ────────────────────────────────────────────────────

@pytest.fixture
def multi_market_session(mock_server):
    """Session with two markets sharing a stream."""
    sess = MagicMock()
    sess.server = mock_server
    sess.session_id = "multi-test-1"
    sess.market = {"title": "Bernie Market", "slug": "kxbernie-test"}
    sess.markets = [
        {"title": "Bernie Market", "slug": "kxbernie-test",
         "speakerEntities": ["Bernie Sanders"],
         "keywords": {"cherry blossom": "BERNIE-CHERRY", "shared word": "BERNIE-SHARED"},
         "keywordConfigs": {"cherry blossom": {"dollarAmount": 3}}},
        {"title": "Moore Market", "slug": "kxmoore-test",
         "speakerEntities": ["Wes Moore"],
         "keywords": {"apple pie": "MOORE-APPLE", "shared word": "MOORE-SHARED"},
         "keywordConfigs": {}},
    ]
    sess.keyword_index = {}
    sess.keyword_indexes = []
    sess.keyword_to_market = {
        "cherry blossom": [0],
        "shared word": [0, 1],
        "apple pie": [1],
    }
    sess.speaker_to_markets = {
        "bernie sanders": [0],
        "wes moore": [1],
    }
    sess.orderbook_tracker = None
    return sess


@pytest.fixture
def multi_handler(multi_market_session):
    return SignalHandler(multi_market_session)


# ── Multi-market: Market resolution ──────────────────────────────────────────

class TestMultiMarketResolution:
    """Tests for _get_markets and _resolve_markets."""

    def test_get_markets_returns_list_when_set(self, multi_handler, multi_market_session):
        markets = multi_handler._get_markets()
        assert len(markets) == 2
        assert markets[0]["slug"] == "kxbernie-test"

    def test_get_markets_falls_back_to_single_market(self, handler, mock_session):
        mock_session.market = {"slug": "single"}
        mock_session.markets = []  # not a real list
        markets = handler._get_markets()
        assert len(markets) == 1
        assert markets[0] == mock_session.market

    def test_resolve_markets_unique_keyword(self, multi_handler):
        markets = multi_handler._resolve_markets("cherry blossom")
        assert len(markets) == 1
        assert markets[0][1] == 0  # market index
        assert markets[0][0]["slug"] == "kxbernie-test"

    def test_resolve_markets_shared_keyword(self, multi_handler):
        markets = multi_handler._resolve_markets("shared word")
        assert len(markets) == 2
        assert markets[0][1] == 0
        assert markets[1][1] == 1

    def test_resolve_markets_unknown_keyword_defaults_to_zero(self, multi_handler):
        markets = multi_handler._resolve_markets("nonexistent")
        assert len(markets) == 1
        assert markets[0][1] == 0

    def test_resolve_markets_backward_compat_int_value(self, handler, mock_session):
        mock_session.markets = [{"slug": "single", "speakerEntities": []}]
        mock_session.keyword_to_market = {"test word": 0}  # int, not list
        markets = handler._resolve_markets("test word")
        assert len(markets) == 1
        assert markets[0][1] == 0


# ── Multi-market: Speaker whitelisting ───────────────────────────────────────

class TestMultiMarketSpeakerWhitelist:
    """Tests for add_trading_speaker with market indices."""

    def test_add_speaker_for_specific_market(self, multi_handler):
        was_new = multi_handler.add_trading_speaker("0", market_indices=[0])
        assert was_new
        assert multi_handler.trading_speakers["0"] == {0}

    def test_add_speaker_for_all_markets(self, multi_handler):
        multi_handler.add_trading_speaker("0")  # market_indices=None → all
        assert multi_handler.trading_speakers["0"] == {0, 1}

    def test_add_speaker_multiple_calls_union(self, multi_handler):
        multi_handler.add_trading_speaker("0", market_indices=[0])
        was_new = multi_handler.add_trading_speaker("0", market_indices=[1])
        assert was_new  # new market index added
        assert multi_handler.trading_speakers["0"] == {0, 1}

    def test_add_speaker_duplicate_not_new(self, multi_handler):
        multi_handler.add_trading_speaker("0", market_indices=[0])
        was_new = multi_handler.add_trading_speaker("0", market_indices=[0])
        assert not was_new
        assert multi_handler.trading_speakers["0"] == {0}

    def test_set_trading_speakers_all_markets(self, multi_handler):
        multi_handler.set_trading_speakers(["0", "1"])
        assert multi_handler.trading_speakers["0"] == {0, 1}
        assert multi_handler.trading_speakers["1"] == {0, 1}

    def test_set_trading_speakers_specific_market(self, multi_handler):
        multi_handler.set_trading_speakers(["0"], market_indices=[0])
        assert multi_handler.trading_speakers["0"] == {0}


# ── Multi-market: handle_signal routing ──────────────────────────────────────

class TestMultiMarketSignalRouting:
    """Tests that handle_signal routes to the correct market."""

    @pytest.mark.asyncio
    async def test_signal_routes_to_correct_market_for_unique_keyword(
        self, multi_handler, multi_market_session, sample_token
    ):
        """Bernie's keyword should route to Bernie's market."""
        multi_handler.add_trading_speaker("speaker-1")  # whitelisted for both
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        captured_market = {}

        def capture(match, dollar_amount, confidence, start, end, best_ask, market=None):
            if market:
                captured_market["slug"] = market.get("slug")

        multi_handler._execute_trade = MagicMock(side_effect=capture)

        match = {"key": "cherry blossom", "value": "BERNIE-CHERRY", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0):
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        assert captured_market["slug"] == "kxbernie-test"

    @pytest.mark.asyncio
    async def test_signal_blocked_when_speaker_not_whitelisted_for_market(
        self, multi_handler, multi_market_session, sample_token
    ):
        """Speaker whitelisted for market 0 only should not trade market 1 keywords."""
        multi_handler.add_trading_speaker("speaker-1", market_indices=[0])
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        multi_handler._execute_trade = MagicMock()

        match = {"key": "apple pie", "value": "MOORE-APPLE", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0):
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        multi_handler._execute_trade.assert_not_called()

    @pytest.mark.asyncio
    async def test_shared_keyword_trades_first_whitelisted_market(
        self, multi_handler, multi_market_session, sample_token
    ):
        """Shared keyword with speaker whitelisted for both → trades market 0 first."""
        multi_handler.add_trading_speaker("speaker-1")  # whitelisted for both
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        captured_market = {}

        def capture(match, dollar_amount, confidence, start, end, best_ask, market=None):
            if market:
                captured_market["slug"] = market.get("slug")

        multi_handler._execute_trade = MagicMock(side_effect=capture)

        match = {"key": "shared word", "value": "BERNIE-SHARED", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0):
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        # Trades on market 0 (Bernie) since speaker is whitelisted for both
        assert captured_market["slug"] == "kxbernie-test"

    @pytest.mark.asyncio
    async def test_shared_keyword_falls_back_to_second_market(
        self, multi_handler, multi_market_session, sample_token
    ):
        """Shared keyword with speaker only whitelisted for market 1 → trades market 1."""
        multi_handler.add_trading_speaker("speaker-1", market_indices=[1])
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        captured_market = {}

        def capture(match, dollar_amount, confidence, start, end, best_ask, market=None):
            if market:
                captured_market["slug"] = market.get("slug")

        multi_handler._execute_trade = MagicMock(side_effect=capture)

        match = {"key": "shared word", "value": "MOORE-SHARED", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0):
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        # Speaker is only whitelisted for market 1, skips market 0
        assert captured_market["slug"] == "kxmoore-test"

    @pytest.mark.asyncio
    async def test_get_dollar_amount_receives_resolved_market(
        self, multi_handler, multi_market_session, sample_token
    ):
        """get_dollar_amount is called with the keyword's market, not session.market."""
        multi_handler.add_trading_speaker("speaker-1")
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        multi_handler._execute_trade = MagicMock()

        match = {"key": "cherry blossom", "value": "BERNIE-CHERRY", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0) as mock_gda:
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        market_passed = mock_gda.call_args[0][0]
        assert market_passed["slug"] == "kxbernie-test"
        assert "Bernie Sanders" in str(market_passed.get("speakerEntities"))

    @pytest.mark.asyncio
    async def test_moore_keyword_receives_moore_market_for_dollar_amount(
        self, multi_handler, multi_market_session, sample_token
    ):
        """get_dollar_amount receives Moore's market for Moore's keywords."""
        multi_handler.add_trading_speaker("speaker-1")
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        multi_handler._execute_trade = MagicMock()

        match = {"key": "apple pie", "value": "MOORE-APPLE", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=2.0) as mock_gda:
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        market_passed = mock_gda.call_args[0][0]
        assert market_passed["slug"] == "kxmoore-test"

    @pytest.mark.asyncio
    async def test_telegram_message_uses_correct_market_title(
        self, multi_handler, multi_market_session, sample_token
    ):
        """SIGNAL Telegram should reference the correct market's title."""
        multi_handler.add_trading_speaker("speaker-1")
        multi_handler._notify_client = AsyncMock()
        multi_handler._execute_trade = MagicMock()

        match = {"key": "cherry blossom", "value": "BERNIE-CHERRY", "min_confidence": 0.92}
        with patch("pylib.signal_handler.send_telegram") as mock_tg:
            with patch("pylib.signal_handler.get_dollar_amount", return_value=1.0):
                await multi_handler.handle_signal(match, "speaker-1", sample_token)

        # Check that at least one send_telegram call contains market title
        title_calls = [
            c for c in mock_tg.call_args_list
            if "Bernie Market" in str(c)
        ]
        assert len(title_calls) >= 1, f"Expected 'Bernie Market' in Telegram, got: {mock_tg.call_args_list}"

    @pytest.mark.asyncio
    async def test_moore_keyword_routes_to_moore_market(
        self, multi_handler, multi_market_session, sample_token
    ):
        """Wes Moore's keyword → Moore's market, Moore's configs."""
        multi_handler.add_trading_speaker("speaker-1")
        multi_handler._send_signal_telegram = MagicMock()
        multi_handler._notify_client = AsyncMock()
        captured = {}

        def capture(match, dollar_amount, confidence, start, end, best_ask, market=None):
            captured["slug"] = market.get("slug") if market else None
            captured["dollar_amount"] = dollar_amount

        multi_handler._execute_trade = MagicMock(side_effect=capture)

        match = {"key": "apple pie", "value": "MOORE-APPLE", "min_confidence": 0.92}
        with patch("pylib.signal_handler.get_dollar_amount", return_value=2.0):
            await multi_handler.handle_signal(match, "speaker-1", sample_token)

        assert captured["slug"] == "kxmoore-test"
        assert captured["dollar_amount"] == 2.0  # from get_dollar_amount patch, not keywordConfigs
