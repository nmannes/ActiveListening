#!/usr/bin/env python
"""
fetch_transcripts.py — Fetch historical earnings call transcripts into the
local dataset (transcripts/{TICKER}/), with Redis-backed resume state.

Usage:
    PYTHONPATH=. python scripts/fetch_transcripts.py TOST AMD
    PYTHONPATH=. python scripts/fetch_transcripts.py --from-markets --quarters 8
    PYTHONPATH=. python scripts/fetch_transcripts.py TOST --force --delay 2

Tickers can be passed explicitly, or derived automatically from cached
Kalshi earnings markets with --from-markets (company codes are extracted
from keyword leg tickers, e.g. KXEARNINGSMENTIONSPOT-26AUG04-RETA → SPOT).
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.transcript_fetcher import (  # noqa: E402
    DEFAULT_DELAY_SECS,
    KALSHI_CODE_TO_SLUG,
    fetch_ticker,
    sp500_tickers,
    tickers_from_markets,
)


def main():
    ap = argparse.ArgumentParser(
        description="Fetch historical earnings call transcripts from stockanalysis.com",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    ap.add_argument("tickers", nargs="*", help="Stock tickers to fetch")
    ap.add_argument("--quarters", type=int, default=8, help="Most recent N quarters per ticker")
    ap.add_argument("--force", action="store_true", help="Re-fetch even if already in the dataset")
    ap.add_argument("--from-markets", action="store_true",
                    help="Derive tickers from cached Kalshi earnings markets")
    ap.add_argument("--watchlist", action="store_true",
                    help="Also fetch the S&P 500 watchlist (broad universe ahead of listings)")
    ap.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECS,
                    help="Minimum seconds between requests (rate-limit pacing)")
    args = ap.parse_args()

    tickers = list(args.tickers)
    if args.from_markets:
        auto = tickers_from_markets()
        if not auto:
            print("No tickers derived from market caches — is cache/matched_markets.json populated?")
            sys.exit(1)
        if not tickers:
            tickers = auto
        else:
            tickers = list(dict.fromkeys(tickers + auto))
        print(f"Derived {len(tickers)} tickers from market caches: {', '.join(tickers)}")
    if args.watchlist:
        wl = sp500_tickers(delay=args.delay)
        print(f"Watchlist: {len(wl)} S&P 500 tickers")
        tickers = list(dict.fromkeys(tickers + wl))
    if not tickers:
        ap.error("no tickers given — pass tickers or use --from-markets")

    # [transcripts] markers: refresh_dataset.py parses [i/n] to advance its own
    # beat budget (and the BullMQ worker mirrors it into the job progress bar),
    # so the per-ticker loop below must keep emitting one flushed line per
    # ticker — it is the only sign of life during a full watchlist sweep.
    print(f"[transcripts] total_tickers={len(tickers)}", flush=True)
    results = []
    for i, t in enumerate(tickers, 1):
        slug = KALSHI_CODE_TO_SLUG.get(t.upper())
        summary = fetch_ticker(t, quarters=args.quarters, force=args.force,
                               delay=args.delay, slug=slug)
        results.append(summary)
        print(f"[transcripts] [{i}/{len(tickers)}] {t}: {summary['status']} "
              f"avail={summary['available']} new={summary['fetched']} "
              f"failed={summary['failed']}", flush=True)

    print()
    print(f"{'TICKER':<8} {'STATUS':<13} {'AVAIL':<6} {'FETCHED':<8} {'SKIPPED':<8} {'FAILED':<7} DETAIL")
    for s in results:
        detail = "; ".join(s["errors"][:3])
        print(f"{s['ticker']:<8} {s['status']:<13} {s['available']:<6} {s['fetched']:<8} "
              f"{s['skipped']:<8} {s['failed']:<7} {detail}")

    n_fetched = sum(s["fetched"] for s in results)
    n_failed = sum(s["failed"] for s in results)
    n_no_cov = sum(1 for s in results if s["status"] == "no_coverage")
    print()
    print(f"Done: {n_fetched} transcripts fetched, {n_failed} failed, "
          f"{n_no_cov} tickers with no coverage.")


if __name__ == "__main__":
    main()
