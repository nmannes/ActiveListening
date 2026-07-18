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
        handler.trading_speakers.add("speaker-1")
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
