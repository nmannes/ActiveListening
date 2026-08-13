"""Tests for the market history fetcher (scripts/fetch_market_history.py)."""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))

from scripts import fetch_market_history as mh  # noqa: E402


def candle(ts, close="0.60", previous="0.50", ask="0.61", bid="0.59", dollars=False):
    suffix = "_dollars" if dollars else ""
    return {"end_period_ts": ts,
            "price": {f"close{suffix}": close, f"previous{suffix}": previous},
            "yes_ask": {f"close{suffix}": ask},
            "yes_bid": {f"close{suffix}": bid}}


TARGET = 1_000_000


def test_pick_price_24h_empty():
    out = mh.pick_price_24h([], TARGET, dollars=False)
    assert out["price_24h"] is None and out["price_ts"] is None
    assert out["n_candles"] == 0


def test_pick_price_24h_latest_candle_before_target():
    candles = [candle(TARGET - 12 * 3600, close="0.55"),
               candle(TARGET - 3 * 3600, close="0.62"),
               candle(TARGET + 2 * 3600, close="0.99")]  # after target: ignored
    out = mh.pick_price_24h(candles, TARGET, dollars=False)
    assert out["price_24h"] == 0.62
    assert out["price_ts"] == TARGET - 3 * 3600
    assert out["fallback"] is False
    assert out["yes_ask_24h"] == 0.61 and out["yes_bid_24h"] == 0.59
    assert out["n_candles"] == 2


def test_pick_price_24h_boundary_inclusive():
    assert mh.pick_price_24h([candle(TARGET)], TARGET, dollars=False)["price_24h"] == 0.60


def test_pick_price_24h_all_null_closes_fallback_previous():
    c = candle(TARGET - 3600)
    c["price"]["close"] = None
    out = mh.pick_price_24h([c], TARGET, dollars=False)
    assert out["price_24h"] == 0.50 and out["fallback"] is True


def test_pick_price_24h_no_trade_at_all():
    c = candle(TARGET - 3600)
    c["price"] = {"close": None, "previous": None}
    out = mh.pick_price_24h([c], TARGET, dollars=False)
    assert out["price_24h"] is None


def test_pick_price_24h_stale_price_discarded():
    # trade 48h before target (60h before resolution) is too stale to trade on
    c = candle(TARGET - 48 * 3600, close="0.55")
    out = mh.pick_price_24h([c], TARGET, dollars=False)
    assert out["price_24h"] is None
    # 24h before target is fine
    assert mh.pick_price_24h([candle(TARGET - 24 * 3600)], TARGET,
                             dollars=False)["price_24h"] == 0.60


def test_pick_price_24h_dollars_suffix():
    # live-endpoint candles carry _dollars fields
    c = candle(TARGET - 3600, dollars=True)
    out = mh.pick_price_24h([c], TARGET, dollars=True)
    assert out["price_24h"] == 0.60


def test_candle_path():
    assert mh.candle_path("S", "T", historical=False) == "series/S/markets/T/candlesticks"
    assert mh.candle_path("S", "T", historical=True) == "historical/markets/T/candlesticks"


def test_parse_close_variable_fraction_digits():
    # Python 3.10 fromisoformat rejects 5-digit fractions — regression test
    # for the crash that wedged the full backfill
    d = mh.parse_close("2026-01-27T19:14:30.18935+00:00")
    assert d.timestamp() == mh.parse_close("2026-01-27T19:14:30Z").timestamp()
    d = mh.parse_close("2025-10-23T22:11:25.726042Z")
    assert d.timestamp() == mh.parse_close("2025-10-23T22:11:25Z").timestamp()


def test_fetch_one_bad_close_time_does_not_crash(monkeypatch):
    monkeypatch.setattr(mh, "_fetch", lambda path: {"candlesticks": []})
    market = {"ticker": "T1", "event_ticker": "E1", "series_ticker": "S1",
              "word": "W", "result": "yes"}
    meta = {"T1": {"close_time": "2026-01-27T19:14:30.18935+00:00"}}
    r = mh.fetch_one(market, meta, datetime(2026, 6, 7, tzinfo=timezone.utc))
    assert r["price_24h"] is None and r["endpoint"] == "historical"


def test_fetch_one_endpoint_routing(monkeypatch):
    monkeypatch.setattr(mh, "_fetch", lambda path: {"candlesticks": []})
    market = {"ticker": "KXEARNINGSMENTIONSPOT-26AUG04-CHURN",
              "event_ticker": "KXEARNINGSMENTIONSPOT-26AUG04",
              "series_ticker": "KXEARNINGSMENTIONSPOT",
              "word": "Churn", "result": "yes"}
    old = datetime(2026, 5, 1, tzinfo=timezone.utc)   # before cutoff 2026-06-07
    new = datetime(2026, 7, 1, tzinfo=timezone.utc)   # after cutoff
    cutoff = datetime(2026, 6, 7, tzinfo=timezone.utc)
    meta = {"KXEARNINGSMENTIONSPOT-26AUG04-CHURN": {"close_time": old.isoformat()}}
    r = mh.fetch_one(market, meta, cutoff)
    assert r["endpoint"] == "historical"
    assert r["target_ts"] == int(old.timestamp()) - 24 * 3600
    meta = {"KXEARNINGSMENTIONSPOT-26AUG04-CHURN": {"close_time": new.isoformat()}}
    r = mh.fetch_one(market, meta, cutoff)
    assert r["endpoint"] == "live"


def test_fetch_one_missing_meta(monkeypatch):
    monkeypatch.setattr(mh, "_fetch", lambda path: {"candlesticks": []})
    market = {"ticker": "T1", "event_ticker": "E1", "series_ticker": "S1",
              "word": "W", "result": "yes"}
    r = mh.fetch_one(market, {}, datetime.now(timezone.utc))
    assert r["price_24h"] is None and r["close_time_iso"] is None
