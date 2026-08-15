#!/usr/bin/env python
"""
fetch_mention_markets.py — Collect Kalshi appearance "mention" markets
(word → yes/no ground truth for past TV appearances, e.g. "What will Hakeem
Jeffries say during Meet the Press?").

Mirrors fetch_earnings_mentions.py: same public API, pacing, and retry policy;
the series filter is every *MENTION series except the earnings product.

  1. /series — enumerate mention series (endswith MENTION, not KXEARNINGSMENTION)
  2. /markets?series_ticker=...         — live markets (active + recently settled)
  3. /historical/markets?series_ticker= — settled markets older than the cutoff
  4. /events (status=settled + archived=true, nested markets) — event metadata
     (start_time → show date)

Output: data/mention_markets.jsonl — one event per line:
{
  "event_ticker", "series_ticker", "title", "sub_title", "show_date",
  "settlement_sources",
  "markets": [{"ticker", "word", "result", "status"}, ...]
}

Usage:
    PYTHONPATH=. python scripts/fetch_mention_markets.py
    PYTHONPATH=. python scripts/fetch_mention_markets.py --max-age-days 365
"""

import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.fetch_earnings_mentions import (  # noqa: E402
    PAGE_LIMIT,
    api_get,
    market_record,
    walk_paged,
    walk_series,
)

OUT_FILE = Path(__file__).resolve().parent.parent / "data" / "mention_markets.jsonl"

_TICKER_DATE_RE = re.compile(r"-(\d{2})([A-Z]{3})(\d{2})?$")
_MONTHS = {m: i + 1 for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}


def is_mention_series(ticker: str) -> bool:
    """Every word-market series except the earnings product."""
    return ticker.endswith("MENTION") and not ticker.startswith("KXEARNINGSMENTION")


def mention_series() -> list:
    data = api_get("/series?limit=200")
    tickers = sorted(s["ticker"] for s in (data.get("series") or [])
                     if is_mention_series(s.get("ticker") or ""))
    print(f"series: {len(tickers)} mention series: {', '.join(tickers[:15])}"
          + (" ..." if len(tickers) > 15 else ""))
    return tickers


def series_of(event_ticker: str) -> str:
    return _TICKER_DATE_RE.sub("", event_ticker or "")


def parse_show_date(event: dict):
    """Event start_time (epoch) → ISO date; fall back to the ticker."""
    ts = event.get("start_time")
    if ts:
        return datetime.fromtimestamp(ts, tz=timezone.utc).date().isoformat()
    tm = _TICKER_DATE_RE.search(event.get("event_ticker") or "")
    if tm:
        yy = int(tm.group(1)) + 2000
        mm = _MONTHS.get(tm.group(2))
        dd = int(tm.group(3)) if tm.group(3) else 1  # day-less ticker → 1st
        if mm and dd <= 31:
            try:
                return datetime(yy, mm, dd).date().isoformat()
            except ValueError:
                pass
    return None


def main():
    ap = argparse.ArgumentParser(description="Collect Kalshi appearance mention markets")
    ap.add_argument("--out", type=Path, default=OUT_FILE, help="Output JSONL path")
    ap.add_argument("--max-age-days", type=int, default=730,
                    help="Skip events older than this many days")
    args = ap.parse_args()

    series = mention_series()
    series_set = set(series)
    markets_by_event = {}
    for s in series:
        for path, label in ((f"markets?series_ticker={s}", "live"),
                            (f"historical/markets?series_ticker={s}", "hist")):
            try:
                ms = walk_paged(path, f"{label} {s}")
            except Exception as e:
                print(f"{label} {s}: FAILED {e}")
                continue
            for m in ms:
                ev = m.get("event_ticker")
                if ev:
                    markets_by_event.setdefault(ev, []).append(m)

    min_close = (datetime.now() - timedelta(days=args.max_age_days)).date()
    min_close_ts = int(datetime.combine(min_close, datetime.min.time())
                       .replace(tzinfo=timezone.utc).timestamp())
    events = []
    for path, label in ((f"events?status=settled&min_close_ts={min_close_ts}", "settled"),
                        (f"events?archived=true&min_close_ts={min_close_ts}", "archived")):
        try:
            events += walk_paged(path, label)
        except Exception as e:
            print(f"{label}: FAILED {e}")
    meta = {}
    for e in events:
        if series_of(e.get("event_ticker")) in series_set:
            meta.setdefault(e.get("event_ticker"), e)

    cutoff = datetime.now().date() - timedelta(days=args.max_age_days)
    n_markets = n_results = 0
    series_used = set()
    with open(args.out, "w") as f:
        for ticker in sorted(set(list(meta) + list(markets_by_event))):
            e = meta.get(ticker, {"event_ticker": ticker})
            markets = markets_by_event.get(ticker) or (e.get("markets") or [])
            show_date = parse_show_date(e)
            if show_date and show_date < cutoff.isoformat():
                continue
            record = {
                "event_ticker": ticker,
                "series_ticker": e.get("series_ticker") or series_of(ticker),
                "title": e.get("title"),
                "sub_title": e.get("sub_title"),
                "show_date": show_date,
                "settlement_sources": e.get("settlement_sources"),
                "markets": sorted({m["ticker"]: m for m in map(market_record, markets)}.values(),
                                  key=lambda m: m["ticker"] or ""),
            }
            f.write(json.dumps(record) + "\n")
            series_used.add(record["series_ticker"])
            n_markets += len(record["markets"])
            n_results += sum(1 for m in record["markets"] if m.get("result"))

    n_events = sum(1 for _ in open(args.out))
    print(f"Saved {n_events} events / {n_markets} markets ({n_results} resolved) "
          f"/ {len(series_used)} series to {args.out}")


if __name__ == "__main__":
    main()
