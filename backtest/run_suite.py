#!/usr/bin/env python3
"""
run_suite.py — Run time-synced backtests on every non-test session in s3/.

Discovers sessions with Deepgram transcripts + market JSON, runs each through
the unified ReplayRunner + BacktestSignalHandler pipeline (time-synced token
feeding, periodic speaker identification, full gate evaluation, P&L), and
aggregates results into a master summary.

Orderbook pricing and settlement data come from the Kalshi API (get_market_full),
NOT from local SQLite snapshots. Market data is pre-fetched for all unique tickers
across all sessions before running backtests.

Unlike the legacy pipeline (replay.py + simulate.py subprocesses), this models
the real-time constraint: speaker identification only knows about audio/transcript
up to the current virtual time, and the whitelist evolves gradually.

Usage:
    PYTHONPATH=. python backtest/run_suite.py                 # Full suite
    PYTHONPATH=. python backtest/run_suite.py --workers 4     # Parallel
    PYTHONPATH=. python backtest/run_suite.py --dry-run       # List sessions only
    PYTHONPATH=. python backtest/run_suite.py --type kxnba    # NBA only
    PYTHONPATH=. python backtest/run_suite.py --slug kxnbamention-26apr28phibos

Kalshi API credentials from environment:
    KALSHI_KEY_ID, KALSHI_PRIVATE_KEY_PATH, KALSHI_ENVIRONMENT (default: prod)
"""

import argparse
import asyncio
import csv
import os
import re
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pylib.kalshi_client import KalshiClient
from backtest.run_backtest import run_backtest, load_market
from backtest.orderbook import fetch_market_data

S3_DIR = REPO_ROOT / "s3"
SCHEDULED_DIR = REPO_ROOT / "scheduled"

TEST_PATTERN = re.compile(r"test|sample", re.I)


# ── Discovery ────────────────────────────────────────────────────────────────

def discover_sessions(market_type: str | None = None, slug_filter: str | None = None) -> list[dict]:
    """Find all backtestable sessions in s3/.

    A session is backtestable if it has deepgram_responses/ and a market JSON.
    Returns a list of dicts with keys: slug, session_dir, market_json.
    """
    sessions: list[dict] = []
    seen_slugs: set[str] = set()

    for d in sorted(S3_DIR.iterdir()):
        if not d.is_dir():
            continue
        if TEST_PATTERN.search(d.name):
            continue

        slug = d.name.split("_")[0]
        if market_type and not slug.startswith(market_type):
            continue
        if slug_filter and slug != slug_filter:
            continue

        if slug in seen_slugs:
            continue

        dg_dir = d / "deepgram_responses"
        if not dg_dir.is_dir():
            continue

        market_json = d / f"{slug}.json"
        if not market_json.exists():
            market_json = SCHEDULED_DIR / f"{slug}.json"
        if not market_json.exists():
            continue

        seen_slugs.add(slug)
        sessions.append({
            "slug": slug,
            "session_dir": d,
            "market_json": market_json,
        })

    return sessions


# ── Per-session backtest ─────────────────────────────────────────────────────

async def run_session_backtest(
    session: dict,
    market_data: dict[str, dict],
    gate_config: dict,
    interval_secs: int,
    max_duration_secs: int,
    semaphore: asyncio.Semaphore,
) -> dict:
    """Run a time-synced backtest on a single session. Returns result dict."""
    slug = session["slug"]

    result = {
        "slug": slug,
        "status": "pending",
        "total_signals": 0,
        "trades": 0,
        "blocked": 0,
        "wins": 0,
        "losses": 0,
        "unresolved": 0,
        "total_cost": 0.0,
        "total_pnl": 0.0,
        "error": None,
    }

    async with semaphore:
        try:
            market = load_market(session["session_dir"])
            if not market:
                result["status"] = "no_market"
                result["error"] = "Could not load market JSON"
                return result

            summary = await run_backtest(
                session["session_dir"],
                market,
                market_data=market_data,
                kalshi_client=None,
                interval_secs=interval_secs,
                max_duration_secs=max_duration_secs,
                gate_config=gate_config,
                verbose=False,
            )

            result.update({
                "status": "completed",
                "total_signals": summary["total_signals"],
                "trades": summary["trades"],
                "blocked": summary["blocked"],
                "wins": summary["wins"],
                "losses": summary["losses"],
                "unresolved": summary["unresolved"],
                "total_cost": summary["total_cost"],
                "total_pnl": summary["total_pnl"],
            })

        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)[:200]

    return result


# ── Orchestration ────────────────────────────────────────────────────────────

async def run_suite_async(
    sessions: list[dict],
    workers: int,
    gate_config: dict,
    interval_secs: int,
    max_duration_secs: int,
    kalshi_client: KalshiClient | None,
) -> list[dict]:
    """Run backtests on all sessions with async concurrency control.

    Pre-fetches market data for all unique tickers across all sessions
    from the Kalshi API before running backtests.
    """
    semaphore = asyncio.Semaphore(workers)

    # Collect all unique tickers across all sessions
    all_tickers: set[str] = set()
    for s in sessions:
        try:
            market = load_market(s["session_dir"])
            if market:
                for ticker in market.get("keywords", {}).values():
                    all_tickers.add(ticker)
        except Exception:
            continue

    # Pre-fetch market data from Kalshi API once for all sessions
    market_data: dict[str, dict] = {}
    if kalshi_client and all_tickers:
        print(f"Fetching market data for {len(all_tickers)} unique tickers from Kalshi API...")
        market_data = await fetch_market_data(kalshi_client, list(all_tickers))
        print(f"  Got data for {len(market_data)}/{len(all_tickers)} tickers\n")

    tasks = [
        run_session_backtest(s, market_data, gate_config, interval_secs,
                            max_duration_secs, semaphore)
        for s in sessions
    ]

    results = []
    for i, coro in enumerate(asyncio.as_completed(tasks)):
        result = await coro
        results.append(result)
        status = result["status"]
        trades = result.get("trades", 0)
        pnl = result.get("total_pnl", 0)
        marker = "✓" if status == "completed" else "✗"
        print(f"  [{i+1:3d}/{len(sessions)}] {marker} {result['slug']:<45s} "
              f"{trades:>3d} trades  P&L=${pnl:+.2f}  ({status})")
        if result.get("error"):
            print(f"         ERROR: {result['error'][:120]}")

    return results


def init_kalshi_client() -> KalshiClient | None:
    """Initialize KalshiClient from environment variables. Returns None if not configured."""
    key_id = os.environ.get("KALSHI_KEY_ID")
    private_key_path = os.environ.get("KALSHI_PRIVATE_KEY_PATH")
    if not key_id or not private_key_path:
        return None
    environment = os.environ.get("KALSHI_ENVIRONMENT", "prod")
    return KalshiClient(key_id, private_key_path, environment)


# ── Aggregate printing ──────────────────────────────────────────────────────

def print_aggregate(results: list[dict]):
    """Print aggregate backtest results."""
    completed = [r for r in results if r["status"] == "completed"]
    total_sessions = len(completed)
    total_signals = sum(r.get("total_signals", 0) for r in completed)
    total_trades = sum(r.get("trades", 0) for r in completed)
    total_blocked = sum(r.get("blocked", 0) for r in completed)
    total_wins = sum(r.get("wins", 0) for r in completed)
    total_losses = sum(r.get("losses", 0) for r in completed)
    total_cost = sum(r.get("total_cost", 0) for r in completed)
    total_pnl = sum(r.get("total_pnl", 0) for r in completed)
    total_unresolved = sum(r.get("unresolved", 0) for r in completed)

    resolved = total_wins + total_losses
    win_rate = (total_wins / resolved * 100) if resolved > 0 else 0
    roi = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    active = [r for r in completed if r.get("trades", 0) > 0]
    profitable = [r for r in completed if r.get("total_pnl", 0) > 0]
    losing = [r for r in completed if r.get("total_pnl", 0) < 0]

    print(f"\n  Sessions processed:   {total_sessions}")
    print(f"  Total signals:        {total_signals}")
    print(f"  Total trades:         {total_trades}")
    print(f"  Blocked signals:      {total_blocked}")
    print(f"  Wins:                 {total_wins}")
    print(f"  Losses:               {total_losses}")
    print(f"  Unresolved:           {total_unresolved}")
    print(f"  Win rate:             {win_rate:.1f}%")
    print(f"  Total cost:           ${total_cost:.2f}")
    print(f"  Total P&L:            ${total_pnl:+.2f}")
    print(f"  ROI:                  {roi:+.1f}%")
    print(f"  Profitable sessions:  {len(profitable)}/{len(active)}")
    print(f"  Losing sessions:      {len(losing)}/{len(active)}")

    # Aggregate by market type
    by_type: dict[str, dict] = {}
    for r in completed:
        mtype = r["slug"].split("-")[0] if "-" in r["slug"] else r["slug"]
        if mtype not in by_type:
            by_type[mtype] = {"sessions": 0, "trades": 0, "signals": 0,
                              "cost": 0.0, "pnl": 0.0, "wins": 0, "losses": 0}
        bt = by_type[mtype]
        bt["sessions"] += 1
        bt["trades"] += r.get("trades", 0)
        bt["signals"] += r.get("total_signals", 0)
        bt["cost"] += r.get("total_cost", 0)
        bt["pnl"] += r.get("total_pnl", 0)
        bt["wins"] += r.get("wins", 0)
        bt["losses"] += r.get("losses", 0)

    print(f"\n  By market type:")
    print(f"  {'Type':<30s} {'Sessions':>8s} {'Trades':>7s} {'Cost':>8s} {'P&L':>10s} {'ROI':>8s}")
    print(f"  {'─'*30} {'─'*8} {'─'*7} {'─'*8} {'─'*10} {'─'*8}")
    for mtype in sorted(by_type.keys(), key=lambda k: -by_type[k]["pnl"]):
        bt = by_type[mtype]
        bt_roi = (bt["pnl"] / bt["cost"] * 100) if bt["cost"] > 0 else 0
        print(f"  {mtype:<30s} {bt['sessions']:>8d} {bt['trades']:>7d} "
              f"${bt['cost']:>7.2f} ${bt['pnl']:>+9.2f} {bt_roi:>+7.1f}%")

    # Failures
    failures = [r for r in results if r["status"] not in ("completed",)]
    if failures:
        print(f"\n  Failures ({len(failures)}):")
        for r in failures:
            print(f"    {r['slug']}: {r['status']} — {r.get('error', '')[:100]}")


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Run time-synced backtest suite on all non-test sessions"
    )
    parser.add_argument("--workers", "-w", type=int, default=4, help="Parallel workers (default: 4)")
    parser.add_argument("--type", help="Only run sessions of a specific market type (e.g. kxnba, kxwc)")
    parser.add_argument("--slug", help="Only run a single session by slug")
    parser.add_argument("--dry-run", action="store_true", help="List sessions without running")
    parser.add_argument("--csv", help="Export aggregate results to CSV")
    parser.add_argument("--interval", type=int, default=10, help="Seconds between identification runs (default: 10)")
    parser.add_argument("--duration", type=int, default=1200, help="Event duration in seconds (default: 1200)")
    parser.add_argument("--min-confidence", type=float, default=None)
    parser.add_argument("--min-yes-ask-price", type=float, default=None)
    parser.add_argument("--max-session-loss", type=float, default=None)
    args = parser.parse_args()

    sessions = discover_sessions(market_type=args.type, slug_filter=args.slug)
    if not sessions:
        print("No sessions found.")
        return

    print(f"Found {len(sessions)} sessions")

    if args.dry_run:
        for i, s in enumerate(sessions):
            print(f"  {i+1:3d}. {s['slug']}")
        return

    # Initialize Kalshi client for market data
    kalshi_client = init_kalshi_client()
    if kalshi_client:
        print(f"Kalshi API client initialized ({kalshi_client.environment})")
    else:
        print("Kalshi API not configured (set KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH)")
        print("  → Using default fill prices ($0.50) for all trades")

    gate_config = {
        "min_confidence": args.min_confidence if args.min_confidence is not None
            else float(os.environ.get("MIN_CONFIDENCE", "0.80")),
        "min_yes_ask_price": args.min_yes_ask_price if args.min_yes_ask_price is not None
            else float(os.environ.get("MIN_YES_ASK_PRICE", "0.02")),
        "max_session_loss": args.max_session_loss if args.max_session_loss is not None
            else float(os.environ.get("MAX_SESSION_LOSS", "100.0")),
    }

    print(f"\n{'='*60}")
    print(f"RUNNING BACKTESTS ({len(sessions)} sessions, {args.workers} workers)")
    print(f"{'='*60}")
    print(f"  Interval: {args.interval}s, Duration: {args.duration}s")
    print(f"  Gates: min_confidence={gate_config['min_confidence']}, "
          f"min_yes_ask_price={gate_config['min_yes_ask_price']}, "
          f"max_session_loss={gate_config['max_session_loss']}")
    print()

    t0 = time.time()

    results = asyncio.run(run_suite_async(
        sessions, args.workers, gate_config, args.interval, args.duration,
        kalshi_client,
    ))

    t1 = time.time()
    print(f"\nTotal time: {t1 - t0:.1f}s")

    # ── Aggregate ────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"AGGREGATE RESULTS")
    print(f"{'='*60}")
    print_aggregate(results)

    # Export CSV
    if args.csv:
        csv_path = Path(args.csv)
        if not csv_path.is_absolute():
            csv_path = REPO_ROOT / csv_path
        completed = [r for r in results if r["status"] == "completed"]
        fieldnames = ["slug", "status", "total_signals", "trades", "blocked",
                      "wins", "losses", "unresolved", "total_cost", "total_pnl"]
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in sorted(completed, key=lambda r: r.get("total_pnl", 0)):
                writer.writerow(r)
        print(f"\n  Exported to {csv_path}")


if __name__ == "__main__":
    main()
