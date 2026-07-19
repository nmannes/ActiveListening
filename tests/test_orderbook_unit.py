#!/usr/bin/env python3
"""Unit tests for OrderbookTracker — mock WebSocket, verify book logic."""

import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent))

from pylib.orderbook_tracker import Orderbook, OrderbookTracker


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_kalshi():
    k = MagicMock()
    k.get_ws_auth_headers.return_value = {"KALSHI-ACCESS-KEY": "test"}
    return k


@pytest.fixture
def tracker(mock_kalshi):
    return OrderbookTracker(
        tickers=["TICKER-A", "TICKER-B"],
        kalshi=mock_kalshi,
        environment="demo",
    )


# ── Orderbook (the value object) ────────────────────────────────────────────

class TestOrderbook:
    def test_empty_book_has_no_yes_or_no(self):
        b = Orderbook()
        assert b.yes == {}
        assert b.no == {}

    def test_slots_restrict_attributes(self):
        b = Orderbook()
        with pytest.raises(AttributeError):
            b.other = 42


# ── OrderbookTracker init ───────────────────────────────────────────────────

class TestInit:
    def test_stores_tickers(self, tracker, mock_kalshi):
        assert tracker._tickers == ["TICKER-A", "TICKER-B"]
        assert tracker._kalshi is mock_kalshi

    def test_demo_url(self, tracker):
        assert "demo-api" in tracker._ws_url

    def test_prod_url(self, mock_kalshi):
        t = OrderbookTracker(["X"], mock_kalshi, environment="prod")
        assert "api.elections" in t._ws_url

    def test_ready_not_set_initially(self, tracker):
        assert not tracker._ready.is_set()

    def test_books_empty_initially(self, tracker):
        assert tracker._books == {}


# ── has_book ────────────────────────────────────────────────────────────────

class TestHasBook:
    def test_true_after_snapshot(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("TICKER-A"))
        assert tracker.has_book("TICKER-A")

    def test_false_for_unknown(self, tracker):
        assert not tracker.has_book("NONEXISTENT")


# ── get_best_yes_bid ────────────────────────────────────────────────────────

class TestBestYesBid:
    def test_none_when_no_book(self, tracker):
        assert tracker.get_best_yes_bid("NONEXISTENT") is None

    def test_none_when_no_yes_side(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[]))
        assert tracker.get_best_yes_bid("T") is None

    def test_highest_yes_price(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[
            ("0.42", "10"), ("0.55", "5"), ("0.30", "20")
        ]))
        assert tracker.get_best_yes_bid("T") == 0.55

    def test_single_yes_level(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.73", "100")]))
        assert tracker.get_best_yes_bid("T") == 0.73

    def test_cent_boundaries(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.99", "1"), ("0.01", "1")]))
        assert tracker.get_best_yes_bid("T") == 0.99


# ── get_best_yes_ask ────────────────────────────────────────────────────────

class TestBestYesAsk:
    def test_none_when_no_book(self, tracker):
        assert tracker.get_best_yes_ask("NONEXISTENT") is None

    def test_none_when_no_no_side(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", no_levels=[]))
        assert tracker.get_best_yes_ask("T") is None

    def test_lowest_no_price(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", no_levels=[
            ("0.60", "10"), ("0.45", "5"), ("0.80", "20")
        ]))
        assert tracker.get_best_yes_ask("T") == 0.45

    def test_single_no_level(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", no_levels=[("0.88", "50")]))
        assert tracker.get_best_yes_ask("T") == 0.88

    def test_cent_boundaries(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", no_levels=[("0.01", "1"), ("0.99", "1")]))
        assert tracker.get_best_yes_ask("T") == 0.01


# ── wait_ready ──────────────────────────────────────────────────────────────

class TestWaitReady:
    def test_returns_immediately_if_already_set(self, tracker):
        tracker._ready.set()
        # Should not raise TimeoutError
        asyncio.run(tracker.wait_ready(timeout=0.01))

    def test_times_out_gracefully_when_not_set(self):
        """wait_ready catches TimeoutError internally — it logs and returns."""
        t = OrderbookTracker(["X"], MagicMock(), environment="demo")
        # Should not raise; it logs a warning and returns
        asyncio.run(t.wait_ready(timeout=0.01))
        assert not t._ready.is_set()

    def test_ready_set_after_snapshot(self, tracker):
        assert not tracker._ready.is_set()
        tracker._handle_snapshot(_snapshot_msg("TICKER-A"))
        assert tracker._ready.is_set()


# ── _handle_snapshot ────────────────────────────────────────────────────────

class TestHandleSnapshot:
    def test_populates_yes_and_no_levels(self, tracker):
        msg = _snapshot_msg(
            "TICKER-A",
            yes_levels=[("0.50", "100"), ("0.51", "50")],
            no_levels=[("0.52", "75"), ("0.53", "25")],
        )
        tracker._handle_snapshot(msg)
        book = tracker._books["TICKER-A"]
        assert book.yes == {50: 100, 51: 50}
        assert book.no == {52: 75, 53: 25}

    def test_rounds_floating_prices_to_cents(self, tracker):
        msg = _snapshot_msg("T", yes_levels=[("0.333", "10")])
        tracker._handle_snapshot(msg)
        # round(0.333 * 100) = round(33.3) = 33
        assert 33 in tracker._books["T"].yes

    def test_handles_empty_levels_gracefully(self, tracker):
        msg = _snapshot_msg("T", yes_levels=None, no_levels=None)
        # msg with no yes_dollars_fp / no_dollars_fp keys
        raw = {"type": "orderbook_snapshot", "msg": {"market_ticker": "T"}}
        tracker._handle_snapshot(raw)
        book = tracker._books["T"]
        assert book.yes == {}
        assert book.no == {}

    def test_ignores_msg_without_ticker(self, tracker):
        tracker._handle_snapshot({"type": "orderbook_snapshot", "msg": {}})
        assert tracker._books == {}

    def test_reads_ticker_from_top_level_data(self, tracker):
        """When ticker is at data level, not nested in msg."""
        raw = {
            "type": "orderbook_snapshot",
            "market_ticker": "TOPLEVEL",
            "yes_dollars_fp": [("0.10", "5")],
        }
        tracker._handle_snapshot(raw)
        assert tracker.has_book("TOPLEVEL")

    def test_replaces_existing_book_on_new_snapshot(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.99", "10")]))
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.01", "1")]))
        book = tracker._books["T"]
        assert book.yes == {1: 1}
        assert 99 not in book.yes


# ── _handle_delta ───────────────────────────────────────────────────────────

class TestHandleDelta:
    def test_adds_new_price_level_to_yes(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.50", "10")]))
        tracker._handle_delta(_delta_msg("T", side="yes", price=50, delta=5))
        assert tracker._books["T"].yes[50] == 15

    def test_adds_new_price_level_to_no(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", no_levels=[("0.60", "20")]))
        tracker._handle_delta(_delta_msg("T", side="no", price=60, delta=10))
        assert tracker._books["T"].no[60] == 30

    def test_removes_price_when_qty_drops_to_zero(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.50", "5")]))
        tracker._handle_delta(_delta_msg("T", side="yes", price=50, delta=-5))
        assert 50 not in tracker._books["T"].yes

    def test_removes_price_when_qty_goes_negative(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.50", "5")]))
        tracker._handle_delta(_delta_msg("T", side="yes", price=50, delta=-10))
        assert 50 not in tracker._books["T"].yes

    def test_creates_new_price_level_with_positive_delta(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[]))
        tracker._handle_delta(_delta_msg("T", side="yes", price=75, delta=3))
        assert tracker._books["T"].yes[75] == 3

    def test_ignores_delta_before_snapshot(self, tracker):
        tracker._handle_delta(_delta_msg("T", side="yes", price=50, delta=5))
        assert not tracker.has_book("T")

    def test_ignores_unknown_side(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T"))
        tracker._handle_delta({"type": "orderbook_delta", "msg": {
            "market_ticker": "T", "side": "maybe", "price": 50, "delta": 1,
        }})
        assert tracker._books["T"].yes == {}

    def test_ignores_missing_price(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T"))
        tracker._handle_delta({"type": "orderbook_delta", "msg": {
            "market_ticker": "T", "side": "yes", "delta": 1,
        }})
        assert tracker._books["T"].yes == {}

    def test_ignores_missing_delta(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T"))
        tracker._handle_delta({"type": "orderbook_delta", "msg": {
            "market_ticker": "T", "side": "yes", "price": 50,
        }})
        assert tracker._books["T"].yes == {}

    def test_uses_price_dollars_field(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.50", "10")]))
        tracker._handle_delta({"type": "orderbook_delta", "msg": {
            "market_ticker": "T", "side": "yes",
            "price_dollars": "0.42", "delta": 3,
        }})
        assert 42 in tracker._books["T"].yes

    def test_uses_delta_fp_field(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.50", "10")]))
        tracker._handle_delta({"type": "orderbook_delta", "msg": {
            "market_ticker": "T", "side": "yes",
            "price": 50, "delta_fp": "7",
        }})
        assert tracker._books["T"].yes[50] == 17

    def test_reads_fields_from_top_level(self, tracker):
        """Delta fields can be at data top level, not nested in msg."""
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.50", "10")]))
        tracker._handle_delta({
            "type": "orderbook_delta",
            "market_ticker": "T",
            "side": "yes",
            "price": 50,
            "delta": 2,
        })
        assert tracker._books["T"].yes[50] == 12


# ── appears_resolved_no ──────────────────────────────────────────────────────

class TestAppearsResolvedNo:
    def test_false_when_no_book(self, tracker):
        """No data — don't block trades we can't judge."""
        assert not tracker.appears_resolved_no("NONEXISTENT")

    def test_false_when_book_has_no_yes_bids(self, tracker):
        """Empty YES side is no liquidity, not resolved-NO evidence."""
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[]))
        assert not tracker.appears_resolved_no("T")

    def test_true_when_best_bid_is_zero(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.00", "100")]))
        assert tracker.appears_resolved_no("T")

    def test_true_when_best_bid_is_one_cent(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.01", "50")]))
        assert tracker.appears_resolved_no("T")

    def test_false_when_bid_above_one_cent(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.02", "10")]))
        assert not tracker.appears_resolved_no("T")

    def test_false_when_healthy_market(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[
            ("0.40", "100"), ("0.45", "200"), ("0.50", "300"),
        ]))
        assert not tracker.appears_resolved_no("T")

    def test_true_when_only_low_bids_present(self, tracker):
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[
            ("0.00", "1000"), ("0.01", "500"),
        ]))
        assert tracker.appears_resolved_no("T")

    def test_true_even_with_high_asks(self, tracker):
        """Resolved-no is about YES bid weakness; asks don't matter."""
        tracker._handle_snapshot(_snapshot_msg("T",
            yes_levels=[("0.01", "10")],
            no_levels=[("0.99", "100")],
        ))
        assert tracker.appears_resolved_no("T")

    def test_stale_bid_removed_via_delta(self, tracker):
        """After delta removes bids, empty YES side is not resolved-NO evidence."""
        tracker._handle_snapshot(_snapshot_msg("T", yes_levels=[("0.05", "10")]))
        assert not tracker.appears_resolved_no("T")
        tracker._handle_delta(_delta_msg("T", side="yes", price=5, delta=-10))
        assert not tracker.appears_resolved_no("T")


# ── appears_resolved_no with MVE → leg mapping ───────────────────────────────

@pytest.fixture
def mve_tracker(mock_kalshi):
    """Tracker with MVE→legs mapping: MVE ticker delegates to leg tickers."""
    return OrderbookTracker(
        tickers=["MVE-X", "LEG-A", "LEG-B"],
        kalshi=mock_kalshi,
        environment="demo",
        mve_to_legs={"MVE-X": ["LEG-A", "LEG-B"]},
    )


class TestMveAppearsResolvedNo:
    def test_mve_resolved_when_all_legs_have_low_bids(self, mve_tracker):
        """MVE is resolved NO when every leg has YES bid <= 0.01."""
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-A", yes_levels=[("0.01", "10")]))
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-B", yes_levels=[("0.00", "5")]))
        assert mve_tracker.appears_resolved_no("MVE-X")

    def test_mve_not_resolved_when_any_leg_has_healthy_bid(self, mve_tracker):
        """MVE is NOT resolved if at least one leg has YES bid > 0.01."""
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-A", yes_levels=[("0.01", "10")]))
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-B", yes_levels=[("0.55", "100")]))
        assert not mve_tracker.appears_resolved_no("MVE-X")

    def test_mve_not_resolved_when_leg_has_no_book(self, mve_tracker):
        """MVE is NOT resolved if any leg's book hasn't arrived yet."""
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-A", yes_levels=[("0.01", "10")]))
        # LEG-B has no book → can't judge → not resolved
        assert not mve_tracker.appears_resolved_no("MVE-X")

    def test_mve_not_resolved_when_leg_has_empty_yes_side(self, mve_tracker):
        """MVE is NOT resolved if any leg has no YES bids."""
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-A", yes_levels=[("0.01", "10")]))
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-B", yes_levels=[]))
        assert not mve_tracker.appears_resolved_no("MVE-X")

    def test_non_mve_ticker_unaffected(self, mve_tracker):
        """A ticker without legs in the mapping works as before."""
        mve_tracker._handle_snapshot(_snapshot_msg("LEG-A", yes_levels=[("0.01", "10")]))
        assert mve_tracker.appears_resolved_no("LEG-A")


# ── stop ────────────────────────────────────────────────────────────────────

class TestStop:
    def test_sets_stopped_flag(self, tracker):
        assert not tracker._stopped
        tracker.stop()
        assert tracker._stopped

    def test_stopped_tracker_does_not_reconnect(self):
        """run() exits immediately when stopped before connect."""
        t = OrderbookTracker([], MagicMock(), environment="demo")
        t._stopped = True
        asyncio.run(t.run())  # should return immediately


# ── Helpers ─────────────────────────────────────────────────────────────────

def _snapshot_msg(
    ticker: str,
    *,
    yes_levels: list | None = None,
    no_levels: list | None = None,
) -> dict:
    msg: dict = {"market_ticker": ticker}
    if yes_levels is not None:
        msg["yes_dollars_fp"] = yes_levels
    if no_levels is not None:
        msg["no_dollars_fp"] = no_levels
    return {"type": "orderbook_snapshot", "msg": msg}


def _delta_msg(
    ticker: str,
    *,
    side: str,
    price: int,
    delta: int,
) -> dict:
    return {
        "type": "orderbook_delta",
        "msg": {
            "market_ticker": ticker,
            "side": side,
            "price": price,
            "delta": delta,
        },
    }
