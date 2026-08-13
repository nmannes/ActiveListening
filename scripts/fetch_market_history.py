#!/usr/bin/env python
"""
fetch_market_history.py — Historical prices for finalized earnings-mention markets.

For every finalized market in data/earnings_mentions.jsonl, fetch hourly
candlesticks over the 30 days before its close_time and record the last
traded YES price ~24h before resolution (close_time − 86400s). That is the
entry price a backtest would trade at — the last price before the earnings
call made trading impractical.

Candlesticks come from two endpoints split at /historical/cutoff
(market_settled_ts): markets closed before the cutoff live on
/historical/markets/{ticker}/candlesticks, newer ones on
/series/{series}/markets/{ticker}/candlesticks. The two return the same
shape except live fields carry a "_dollars" suffix.

The ~4,600 market fetches run on a thread pool (--workers, default 8). The
historical candlesticks endpoint sustains only ~5 requests/second (measured:
more concurrency just produces 429s), so a global pacing lock keeps request
starts >= PACE apart across all workers — the threads only overlap response
latency — and the retry backoff absorbs the residual 429s.

Output: data/market_history.jsonl — one market per line:
{ticker, event_ticker, series_ticker, code, word, result, close_time_iso,
 target_ts, price_24h, price_ts, fallback, yes_ask_24h, yes_bid_24h,
 n_candles, endpoint}

Resumable: markets already present in the output file are skipped (each
line is written immediately after its fetch, so a crash loses at most the
in-flight batch).

Usage:
    PYTHONPATH=. python scripts/fetch_market_history.py
    PYTHONPATH=. python scripts/fetch_market_history.py --limit 5 --workers 4
"""

import argparse
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.fetch_earnings_mentions import BASE_URL, walk_series  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MENTIONS = ROOT / "data" / "earnings_mentions.jsonl"
OUT_FILE = ROOT / "data" / "market_history.jsonl"

WINDOW_DAYS = 3         # candle window before close_time; the staleness guard
                        # discards candles older than target − 36h anyway, so
                        # 3 days covers everything pick_price_24h can use
TARGET_LEAD_H = 24      # price 24h before resolution
MAX_STALE_H = 36        # discard prices whose trade is > 36h older than the target
RETRY_BACKOFF = [2, 5, 10]
PACE = 0.25             # minimum seconds between request starts, globally
                        # (measured: the endpoint sustains ~4-5 req/s; faster
                        # just produces 429s and backoff sleeps)

_pace_lock = threading.Lock()
_last_request_ts = 0.0


def _pace():
    global _last_request_ts
    with _pace_lock:
        now = time.time()
        wait = PACE - (now - _last_request_ts)
        if wait > 0:
            time.sleep(wait)
        _last_request_ts = time.time()


def _fetch(path: str) -> dict:
    """Paced GET with the same retry logic as fetch_earnings_mentions.api_get."""
    req = urllib.request.Request(BASE_URL + "/" + path.lstrip("/"),
                                 headers={"Accept": "application/json"})
    _pace()
    for attempt in range(len(RETRY_BACKOFF) + 1):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return {}
            if e.code == 429 or e.code >= 500:
                if attempt == len(RETRY_BACKOFF):
                    raise
                time.sleep(RETRY_BACKOFF[attempt])
                continue
            raise
        except (urllib.error.URLError, OSError):
            if attempt == len(RETRY_BACKOFF):
                raise
            time.sleep(RETRY_BACKOFF[attempt])
            continue
        if not data:
            if attempt == len(RETRY_BACKOFF):
                return {}
            time.sleep(RETRY_BACKOFF[attempt])
            continue
        return data
    return {}


def parse_close(iso: str) -> datetime:
    """Kalshi close_time, e.g. '2025-10-23T22:11:25.726042Z' or
    '2026-01-27T19:14:30.18935+00:00' (variable fraction digits — Python 3.10
    fromisoformat rejects 5-digit fractions, so parse the second prefix and
    assume UTC, which is what Kalshi timestamps always are)."""
    return datetime.strptime(iso[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)


def fetch_cutoff() -> Optional[datetime]:
    """market_settled_ts from /historical/cutoff — markets older than this
    must be queried via the historical candlesticks endpoint."""
    data = _fetch("historical/cutoff")
    raw = (data or {}).get("market_settled_ts")
    if not raw:
        return None
    return parse_close(raw)


def _walk_paged(path: str) -> list:
    items = []
    cursor = None
    for _ in range(10):
        p = path + ("&" if "?" in path else "?") + "limit=200"
        if cursor:
            p += f"&cursor={cursor}"
        data = _fetch(p)
        key = "markets" if "markets" in path else "events"
        batch = data.get(key) or []
        items.extend(batch)
        cursor = data.get("cursor")
        if not batch or not cursor:
            break
    return items


def walk_series_markets(s: str) -> list:
    """Markets for one series, from live + historical endpoints."""
    out = []
    for path in (f"markets?series_ticker={s}", f"historical/markets?series_ticker={s}"):
        try:
            out.extend(_walk_paged(path))
        except Exception:
            continue
    return out


def walk_market_meta(series: List[str], workers: int) -> Dict[str, dict]:
    """{ticker: {close_time, result, status}} for every earnings-mention
    market, from both the live and historical market endpoints."""
    out: Dict[str, dict] = {}
    lock = threading.Lock()
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for ms in ex.map(walk_series_markets, series):
            for m in ms:
                ticker = m.get("ticker")
                if not ticker:
                    continue
                with lock:
                    out[ticker] = {"close_time": m.get("close_time"),
                                   "result": m.get("result"),
                                   "status": m.get("status")}
    return out


def candle_path(series: str, ticker: str, historical: bool) -> str:
    if historical:
        return f"historical/markets/{ticker}/candlesticks"
    return f"series/{series}/markets/{ticker}/candlesticks"


def _candle_fields(c: dict, dollars: bool) -> tuple:
    """(end_period_ts, trade_close, previous_close, yes_ask_close, yes_bid_close)."""
    suffix = "_dollars" if dollars else ""
    price = c.get("price") or {}
    ask = c.get("yes_ask") or {}
    bid = c.get("yes_bid") or {}
    return (
        c.get("end_period_ts"),
        price.get(f"close{suffix}"),
        price.get(f"previous{suffix}"),
        ask.get(f"close{suffix}"),
        bid.get(f"close{suffix}"),
    )


def _to_float(v) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def pick_price_24h(candles: List[dict], target_ts: int, dollars: bool) -> dict:
    """Last traded close at or before target_ts (defaulting to the previous
    close when a candle has no trades), with a staleness guard.

    Returns {price_24h, price_ts, fallback, yes_ask_24h, yes_bid_24h, n_candles}.
    """
    chosen_ts = chosen_close = chosen_prev = chosen_ask = chosen_bid = None
    n_candles = 0
    for c in candles:
        ts, close, prev, ask, bid = _candle_fields(c, dollars)
        if not isinstance(ts, (int, float)) or ts > target_ts:
            continue
        n_candles += 1
        if chosen_ts is None or ts > chosen_ts:
            chosen_ts = ts
            chosen_close = _to_float(close)
            chosen_prev = _to_float(prev)
            chosen_ask = _to_float(ask)
            chosen_bid = _to_float(bid)

    if chosen_ts is None:
        return {"price_24h": None, "price_ts": None, "fallback": False,
                "yes_ask_24h": None, "yes_bid_24h": None, "n_candles": 0}

    price, fallback = chosen_close, False
    if price is None:
        price, fallback = chosen_prev, True
    if price is None or chosen_ts < target_ts - MAX_STALE_H * 3600:
        price = None
    return {"price_24h": price, "price_ts": chosen_ts, "fallback": fallback,
            "yes_ask_24h": chosen_ask, "yes_bid_24h": chosen_bid,
            "n_candles": n_candles}


def load_mentions(path: Path) -> tuple:
    """Finalized markets from earnings_mentions.jsonl plus event→call_date."""
    rows = []
    call_dates = {}
    for line in path.open():
        if not line.strip():
            continue
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("event_ticker") and ev.get("call_date"):
            call_dates[ev["event_ticker"]] = ev["call_date"]
        for m in ev.get("markets") or []:
            if m.get("status") == "finalized" and m.get("result"):
                rows.append({"ticker": m["ticker"], "event_ticker": ev["event_ticker"],
                             "series_ticker": ev.get("series_ticker"),
                             "word": m.get("word"), "result": m.get("result")})
    return rows, call_dates


def existing_tickers(path: Path) -> set:
    done = set()
    if not path.exists():
        return done
    for line in path.open():
        try:
            done.add(json.loads(line)["ticker"])
        except (json.JSONDecodeError, KeyError):
            continue
    return done


def fetch_one(m: dict, meta: Dict[str, dict], cutoff: Optional[datetime]) -> dict:
    """Candlesticks + 24h-before price for one market (no I/O side effects)."""
    code = (m["series_ticker"] or "").replace("KXEARNINGSMENTION", "")
    record = {**m, "code": code, "close_time_iso": None, "target_ts": None,
              "price_24h": None, "price_ts": None, "fallback": False,
              "yes_ask_24h": None, "yes_bid_24h": None, "n_candles": 0,
              "endpoint": None}
    meta_row = meta.get(m["ticker"])
    close_iso = meta_row.get("close_time") if meta_row else None
    if not close_iso:
        return record
    try:
        close_ts = parse_close(close_iso).timestamp()
        record["close_time_iso"] = close_iso
        record["target_ts"] = int(close_ts - TARGET_LEAD_H * 3600)
        historical = cutoff is not None and close_ts < cutoff.timestamp()
        record["endpoint"] = "historical" if historical else "live"
        path = candle_path(m["series_ticker"], m["ticker"], historical)
        query = f"{path}?start_ts={int(close_ts - WINDOW_DAYS * 86400)}" \
                f"&end_ts={int(close_ts)}&period_interval=60"
        data = _fetch(query)
        candles = (data or {}).get("candlesticks") or []
        record.update(pick_price_24h(candles, record["target_ts"], not historical))
    except Exception:
        pass  # leave the record with null price fields; resume will skip it
    return record


def main():
    ap = argparse.ArgumentParser(description="Fetch historical prices for finalized earnings-mention markets")
    ap.add_argument("--out", type=Path, default=OUT_FILE)
    ap.add_argument("--limit", type=int, default=0, help="Fetch at most N markets (smoke run)")
    ap.add_argument("--workers", type=int, default=8, help="Parallel fetches")
    args = ap.parse_args()

    cutoff = fetch_cutoff()
    print(f"historical cutoff: {cutoff}")

    markets, _ = load_mentions(MENTIONS)
    print(f"{len(markets)} finalized markets in {MENTIONS.name}")

    series = sorted({m["series_ticker"] for m in markets if m["series_ticker"]})
    meta = walk_market_meta(series, args.workers)
    print(f"metadata for {len(meta)} markets")

    done = existing_tickers(args.out)
    todo = [m for m in markets if m["ticker"] not in done]
    print(f"resume: {len(done)} already fetched, {len(todo)} to go")
    if args.limit:
        todo = todo[:args.limit]

    n_price = n_error = 0
    lock = threading.Lock()
    with args.out.open("a") as f:
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futures = {ex.submit(fetch_one, m, meta, cutoff): m for m in todo}
            for i, fut in enumerate(as_completed(futures), 1):
                record = fut.result()
                with lock:
                    if record["price_24h"] is not None:
                        n_price += 1
                    elif record["close_time_iso"]:
                        n_error += 1
                    f.write(json.dumps(record) + "\n")
                    f.flush()
                if i % 100 == 0 or i == len(todo):
                    print(f"  {i}/{len(todo)} ({n_price} with price, {n_error} without)")

    print(f"Wrote {len(todo)} markets to {args.out}: {n_price} with a 24h-before price, "
          f"{n_error} without (never traded / fetch failed)")


if __name__ == "__main__":
    main()
