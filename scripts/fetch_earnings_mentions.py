#!/usr/bin/env python
"""
fetch_earnings_mentions.py — Collect Kalshi earnings-mention markets
(word → yes/no ground truth for past earnings calls).

Sources, merged by event_ticker:
  1. /series          — enumerate all KXEARNINGSMENTION* series (157 companies)
  2. /markets?series_ticker=...         — live markets (active + recently settled)
  3. /historical/markets?series_ticker= — settled markets older than the ~3-month
     cutoff. THIS is where pre-cutoff markets live — the live endpoints
     return old events with empty markets (e.g. DIS-26MAY06). Old events also
     use a day-less ticker format (KXEARNINGSMENTIONAAPL-25MAY), so the
     historical markets are the ONLY source for 2025+ events.
  4. /events/{event_ticker} — per-event metadata (sub_title call dates,
     settlement_sources). The paginated /events feed (status=settled /
     archived=true) does NOT return earnings-mention events, so metadata is
     fetched directly for each event ticker the market walks produced.

The call date is parsed from sub_title ("On Oct 23, 2025") — authoritative;
falling back to the event ticker suffix (-25OCT24 / day-less -25MAY → 1st of
month) only when the event has no metadata.

Output: data/earnings_mentions.jsonl — one event per line:
{
  "event_ticker", "series_ticker", "title", "sub_title", "call_date",
  "settlement_sources",
  "markets": [{"ticker", "word", "result", "status"}, ...]
}

Usage:
    PYTHONPATH=. python scripts/fetch_earnings_mentions.py
    PYTHONPATH=. python scripts/fetch_earnings_mentions.py --max-age-days 730
"""

import argparse
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"
OUT_FILE = Path(__file__).parent.parent / "data" / "earnings_mentions.jsonl"

PAGE_LIMIT = 1500
API_PACE = 0.25  # seconds between requests
RETRY_BACKOFF = [2, 5, 10]  # seconds between retries on 429/5xx/empty responses

# "On Oct 23, 2025" (abbreviated month) or "On October 23, 2025"
_SUB_TITLE_DATE_RE = re.compile(r"On ([A-Z][a-z]{2,9} \d{1,2}, \d{4})")
# new format: KXEARNINGSMENTIONDIS-26MAY06 ; old format: KXEARNINGSMENTIONAAPL-25MAY
# End-anchored: the date suffix is the last thing in the event ticker (an
# earlier version required a trailing "-" that no real ticker has, which made
# the ticker fallback dead code and silently nulled call dates whenever the
# events feed had no metadata).
_TICKER_DATE_RE = re.compile(r"-(\d{2})([A-Z]{3})(\d{2})?$")

_MONTHS = {m: i + 1 for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}


_last_request_ts = 0.0


def _pace():
    """Keep requests at least API_PACE seconds apart (Kalshi returns empty
    bodies under rapid-fire load)."""
    global _last_request_ts
    now = time.time()
    wait = API_PACE - (now - _last_request_ts)
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.time()


def api_get(path: str) -> dict:
    req = urllib.request.Request(BASE_URL + "/" + path.lstrip("/"),
                                 headers={"Accept": "application/json"})
    for attempt in range(len(RETRY_BACKOFF) + 1):
        _pace()
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
        except (urllib.error.URLError, OSError) as e:
            if attempt == len(RETRY_BACKOFF):
                raise
            time.sleep(RETRY_BACKOFF[attempt])
            continue
        # Kalshi rate-limits with empty 200s — retry those too
        if not data:
            if attempt == len(RETRY_BACKOFF):
                return {}
            time.sleep(RETRY_BACKOFF[attempt])
            continue
        return data
    return {}


def is_earnings(event: dict) -> bool:
    return "earnings" in (event.get("event_ticker") or "").lower()


def parse_call_date(event: dict):
    m = _SUB_TITLE_DATE_RE.search(event.get("sub_title") or "")
    if m:
        for fmt in ("%b %d, %Y", "%B %d, %Y"):
            try:
                return datetime.strptime(m.group(1), fmt).date()
            except ValueError:
                continue
    tm = _TICKER_DATE_RE.search(event.get("event_ticker") or "")
    if tm:
        yy = int(tm.group(1)) + 2000
        mm = _MONTHS.get(tm.group(2))
        dd = int(tm.group(3)) if tm.group(3) else 1  # old day-less format → 1st
        if mm and dd <= 31:
            try:
                return datetime(yy, mm, dd).date()
            except ValueError:
                pass
    return None


def walk_series() -> list:
    """All earnings-mention series tickers from /series."""
    data = api_get("/series?limit=200")
    tickers = sorted(s["ticker"] for s in (data.get("series") or [])
                     if (s.get("ticker") or "").startswith("KXEARNINGSMENTION"))
    print(f"series: {len(tickers)} earnings series")
    return tickers


def walk_paged(path: str, label: str, max_pages: int = PAGE_LIMIT) -> list:
    """Walk a cursor-paginated list endpoint, collecting items."""
    items = []
    cursor = None
    for page in range(1, max_pages + 1):
        p = path + ("&" if "?" in path else "?") + "limit=200"
        if cursor:
            p += f"&cursor={cursor}"
        data = api_get(p)  # api_get prepends BASE_URL — pass a path, not a URL
        key = "markets" if "markets" in path else "events"
        batch = data.get(key) or []
        items.extend(batch)
        cursor = data.get("cursor")
        if not batch or not cursor:
            break
    print(f"{label}: {len(items)} items")
    return items


def market_record(m: dict) -> dict:
    return {
        "ticker": m.get("ticker"),
        "word": (m.get("custom_strike") or {}).get("Word"),
        "result": m.get("result"),
        "status": m.get("status"),
    }


def main():
    ap = argparse.ArgumentParser(description="Collect Kalshi earnings-mention markets")
    ap.add_argument("--out", type=Path, default=OUT_FILE, help="Output JSONL path")
    ap.add_argument("--max-age-days", type=int, default=730,
                    help="Skip events older than this many days (2-year lookback)")
    args = ap.parse_args()

    # 1. enumerate series, pull markets from BOTH live and historical endpoints
    series = walk_series()
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

    # 2. per-event metadata. The paginated settled/archived /events feeds do
    # not include earnings-mention events (verified: 0 across the feed), so
    # fetch each market-derived event ticker directly — one paced GET each.
    min_close = (datetime.now() - timedelta(days=args.max_age_days)).date()
    tickers = sorted(markets_by_event)
    meta = {}
    n_fail = 0
    for i, t in enumerate(tickers, 1):
        try:
            e = (api_get(f"events/{t}") or {}).get("event") or {}
        except Exception:
            e = {}
        if e.get("event_ticker"):
            meta[t] = e
        elif not e:
            n_fail += 1
        if i % 50 == 0 or i == len(tickers):
            print(f"metadata: {i}/{len(tickers)} events "
                  f"({len(meta)} with data, {n_fail} 404/empty)", flush=True)

    cutoff = datetime.now().date() - timedelta(days=args.max_age_days)
    n_markets = n_results = 0
    companies = set()
    with open(args.out, "w") as f:
        for ticker in sorted(set(list(meta) + list(markets_by_event))):
            e = meta.get(ticker, {"event_ticker": ticker})
            markets = markets_by_event.get(ticker) or (e.get("markets") or [])
            call_date = parse_call_date(e)
            if call_date and call_date < cutoff:
                continue
            record = {
                "event_ticker": ticker,
                "series_ticker": e.get("series_ticker")
                    or re.sub(r"-\d{2}[A-Z]{3}\d{0,2}$", "", ticker),
                "title": e.get("title"),
                "sub_title": e.get("sub_title"),
                "call_date": call_date.isoformat() if call_date else None,
                "settlement_sources": e.get("settlement_sources"),
                "markets": sorted({m["ticker"]: m for m in map(market_record, markets)}.values(),
                                  key=lambda m: m["ticker"] or ""),
            }
            f.write(json.dumps(record) + "\n")
            companies.add(record["series_ticker"])
            n_markets += len(record["markets"])
            n_results += sum(1 for m in record["markets"] if m.get("result"))

    n_events = sum(1 for _ in open(args.out))
    print(f"Saved {n_events} events / {n_markets} markets ({n_results} resolved) "
          f"/ {len(companies)} companies to {args.out}")


if __name__ == "__main__":
    main()
