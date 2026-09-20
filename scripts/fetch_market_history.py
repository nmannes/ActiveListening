#!/usr/bin/env python
"""
fetch_market_history.py — Historical prices for finalized earnings-mention markets.

For every finalized market in data/earnings_mentions.jsonl, fetch hourly
candlesticks over the days before its close_time and record the last traded
YES price at each entry lead in LEAD_HOURS (default: 96h, 72h, 48h, 36h,
24h, 18h, 12h, 6h, 3h, 1h before resolution). A backtest can then evaluate
the same strategy at any entry time; the 24h lead is the historical default
(the last price before the earnings call made trading impractical).

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
 n_candles, endpoint, plus for every lead L: price_<L>h, ts_<L>h,
 yes_ask_<L>h, yes_bid_<L>h, fallback_<L>h}

Resumable: markets already present in the output file are skipped (each
line is written immediately after its fetch, so a crash loses at most the
in-flight batch). Use a fresh --out path (or truncate) to re-sample more
leads — existing rows are never rewritten.

Usage:
    PYTHONPATH=. python scripts/fetch_market_history.py
    PYTHONPATH=. python scripts/fetch_market_history.py --limit 5 --workers 4
    PYTHONPATH=. python scripts/fetch_market_history.py --out data/market_history_leads.jsonl
"""

import argparse
import json
import math
import os
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

# Entry leads sampled per market: the price of the last hourly candle at or
# before close_time − LEAD_HOURS[i] (staleness guard below). 24h is the
# historical default entry the backtests trade at; the others exist so the
# edge can be measured at any time before resolution.
LEAD_HOURS = [96, 72, 48, 36, 24, 18, 12, 6, 3, 1]
TARGET_LEAD_H = 24      # price 24h before resolution (legacy default lead)
MAX_STALE_H = 36        # discard prices whose trade is > 36h older than the target
WINDOW_DAYS = max(3, math.ceil((max(LEAD_HOURS) + MAX_STALE_H) / 24))
                        # candle window before close_time; covers the deepest
                        # lead plus its staleness allowance
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


def _count_field(c: dict, base: str):
    """Raw value of a candle count field, tolerating both endpoint spellings.

    The live series endpoint returns fixed-point strings under ``volume_fp`` /
    ``open_interest_fp``; the historical endpoint returns ``volume`` /
    ``open_interest``. Reading only one spelling would silently score the
    historical markets (~70% of the corpus) as zero-volume.
    """
    for key in (f"{base}_fp", base):
        if c.get(key) is not None:
            return c[key]
    return None


def _candle_fields(c: dict, dollars: bool) -> tuple:
    """(end_period_ts, trade_close, previous_close, yes_ask_close,
    yes_bid_close, volume, open_interest)."""
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
        _count_field(c, "volume"),
        _count_field(c, "open_interest"),
    )


def _cum_volume(candles: List[dict], entry_ts, dollars: bool) -> Optional[float]:
    """Contracts traded after the entry candle through close.

    The fill budget for a resting order: the strategy enters `lead` hours before
    close, so any flow arriving before resolution can fill it. Candles at or
    before the entry candle are excluded because that volume is already gone.
    """
    if not isinstance(entry_ts, (int, float)):
        return None
    total = 0.0
    for c in candles:
        ts, _c, _p, _a, _b, vol, _oi = _candle_fields(c, dollars)
        if not isinstance(ts, (int, float)) or ts <= entry_ts:
            continue
        v = _to_float(vol)
        if v:
            total += v
    return total


def _to_float(v) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def pick_price_at(candles: List[dict], target_ts: int, dollars: bool) -> dict:
    """Last traded close at or before target_ts (defaulting to the previous
    close when a candle has no trades), with a staleness guard.

    Generic over the entry lead: target_ts = close_time − lead, so the same
    candle window yields the price at any horizon. Returns {price, ts, ask,
    bid, fallback, n_candles}.
    """
    chosen = {"ts": None, "close": None, "prev": None, "ask": None,
              "bid": None, "vol": None, "oi": None}
    n_candles = 0
    for c in candles:
        ts, close, prev, ask, bid, vol, oi = _candle_fields(c, dollars)
        if not isinstance(ts, (int, float)) or ts > target_ts:
            continue
        n_candles += 1
        if chosen["ts"] is None or ts > chosen["ts"]:
            chosen = {"ts": ts, "close": _to_float(close),
                      "prev": _to_float(prev), "ask": _to_float(ask),
                      "bid": _to_float(bid), "vol": _to_float(vol),
                      "oi": _to_float(oi)}

    if chosen["ts"] is None:
        return {"price": None, "ts": None, "fallback": False,
                "ask": None, "bid": None, "volume": None, "oi": None,
                "n_candles": 0}

    price, fallback = chosen["close"], False
    if price is None:
        price, fallback = chosen["prev"], True
    if price is None or chosen["ts"] < target_ts - MAX_STALE_H * 3600:
        price = None
    return {"price": price, "ts": chosen["ts"], "fallback": fallback,
            "ask": chosen["ask"], "bid": chosen["bid"],
            "volume": chosen["vol"], "oi": chosen["oi"],
            "n_candles": n_candles}


def pick_price_24h(candles: List[dict], target_ts: int, dollars: bool) -> dict:
    """Legacy wrapper around pick_price_at with the 24h-lead field names
    (kept for the tests and any consumer of the original schema)."""
    o = pick_price_at(candles, target_ts, dollars)
    return {"price_24h": o["price"], "price_ts": o["ts"],
            "fallback": o["fallback"], "yes_ask_24h": o["ask"],
            "yes_bid_24h": o["bid"], "n_candles": o["n_candles"]}


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


# Marks a row as written by a schema that records liquidity, even when the
# endpoint returned no volume fields for it. Without a terminal marker a
# genuinely volume-less market would be re-fetched on every run forever.
MARKER_FIELD = "vol_ok"


def existing_rows(path: Path) -> Dict[str, dict]:
    """{ticker: row} for everything already fetched. Last occurrence wins."""
    rows: Dict[str, dict] = {}
    if not path.exists():
        return rows
    for line in path.open():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if row.get("ticker"):
            rows[row["ticker"]] = row
    return rows


def has_volume(row: dict) -> bool:
    """True if `row` was fetched under the current schema.

    Keyed on the presence of every per-lead volume key, not truthiness: a
    market that genuinely never traded still carries the keys and must not be
    re-fetched forever. Rows written before the liquidity fields existed lack
    them, so they are re-fetched — which is what backfills the file in place.
    """
    if row.get(MARKER_FIELD) is False:
        return True                      # terminally volume-less; don't retry
    return all(f"vol_{lead}h" in row for lead in LEAD_HOURS)


def fetch_one(m: dict, meta: Dict[str, dict], cutoff: Optional[datetime]) -> dict:
    """Candlesticks + per-lead prices for one market (no I/O side effects)."""
    code = (m["series_ticker"] or "").replace("KXEARNINGSMENTION", "")
    record = {**m, "code": code, "close_time_iso": None, "target_ts": None,
              "price_24h": None, "price_ts": None, "fallback": False,
              "yes_ask_24h": None, "yes_bid_24h": None, "n_candles": 0,
              "endpoint": None, "vol_ok": False}
    for lead in LEAD_HOURS:
        record[f"price_{lead}h"] = None
        record[f"ts_{lead}h"] = None
        record[f"yes_ask_{lead}h"] = None
        record[f"yes_bid_{lead}h"] = None
        record[f"fallback_{lead}h"] = False
        record[f"vol_{lead}h"] = None
        record[f"oi_{lead}h"] = None
        record[f"volcum_{lead}h"] = None
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
        # Terminal: the endpoint returned no volume field at all for this
        # market, so a re-fetch would return the same nothing.
        record["vol_ok"] = any(_count_field(c, "volume") is not None
                               for c in candles)
        n_24 = 0
        for lead in LEAD_HOURS:
            target = int(close_ts - lead * 3600)
            o = pick_price_at(candles, target, not historical)
            record[f"price_{lead}h"] = o["price"]
            record[f"ts_{lead}h"] = o["ts"]
            record[f"yes_ask_{lead}h"] = o["ask"]
            record[f"yes_bid_{lead}h"] = o["bid"]
            record[f"fallback_{lead}h"] = o["fallback"]
            record[f"vol_{lead}h"] = o["volume"]
            record[f"oi_{lead}h"] = o["oi"]
            record[f"volcum_{lead}h"] = _cum_volume(candles, o["ts"],
                                                    not historical)
            if lead == 24:
                n_24 = o["n_candles"]
        # legacy 24h aliases (price/ask/bid already set by the loop above)
        record["price_ts"] = record["ts_24h"]
        record["fallback"] = record["fallback_24h"]
        record["n_candles"] = n_24
    except Exception:
        pass  # leave the record with null price fields; resume will skip it
    return record


def _write_rows(path: Path, rows: Dict[str, dict]) -> None:
    """Write the full row set. Callers swap the result in with os.replace so
    a reader never observes a half-written file."""
    with path.open("w") as f:
        for r in rows.values():
            f.write(json.dumps(r) + "\n")


def main():
    ap = argparse.ArgumentParser(description="Fetch historical prices for finalized earnings-mention markets")
    ap.add_argument("--out", type=Path, default=OUT_FILE)
    ap.add_argument("--limit", type=int, default=0, help="Fetch at most N markets (smoke run)")
    ap.add_argument("--workers", type=int, default=8, help="Parallel fetches")
    args = ap.parse_args()

    markets, _ = load_mentions(MENTIONS)
    print(f"{len(markets)} finalized markets in {MENTIONS.name}", flush=True)

    rows = existing_rows(args.out)
    todo = [m for m in markets if not has_volume(rows.get(m["ticker"]) or {})]
    print(f"resume: {len(rows)} rows on disk, {len(todo)} to fetch", flush=True)
    if args.limit:
        todo = todo[:args.limit]
    if not todo:
        print("nothing to do")
        return

    # A close time already on disk stands in for the metadata walk, so
    # re-fetching a market costs one candlestick call instead of also
    # re-walking every series it belongs to.
    meta = {t: {"close_time": r.get("close_time_iso"), "result": r.get("result"),
                "status": "finalized"}
            for t, r in rows.items() if r.get("close_time_iso")}
    need_meta = sorted({m["series_ticker"] for m in todo
                        if m["ticker"] not in meta and m["series_ticker"]})
    if need_meta:
        print(f"walking metadata for {len(need_meta)} new series", flush=True)
        meta.update(walk_market_meta(need_meta, args.workers))
    print(f"close time known for {len(meta)} markets", flush=True)

    cutoff = fetch_cutoff()
    print(f"historical cutoff: {cutoff}", flush=True)

    n_price = n_error = 0
    tmp = args.out.with_name(args.out.name + ".tmp")
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futures = {ex.submit(fetch_one, m, meta, cutoff): m for m in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            record = fut.result()
            rows[record["ticker"]] = record
            if record["price_24h"] is not None:
                n_price += 1
            elif record["close_time_iso"]:
                n_error += 1
            if i % 100 == 0 or i == len(todo):
                _write_rows(tmp, rows)       # checkpoint: a crash loses nothing
                print(f"  {i}/{len(todo)} ({n_price} with price, "
                      f"{n_error} without)", flush=True)
    _write_rows(tmp, rows)
    os.replace(tmp, args.out)

    print(f"Wrote {len(rows)} markets to {args.out} ({len(todo)} fetched): "
          f"{n_price} with a 24h-before price, {n_error} without "
          f"(never traded / fetch failed)")


if __name__ == "__main__":
    main()
