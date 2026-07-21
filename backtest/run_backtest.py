#!/usr/bin/env python3
"""
run_backtest.py — Time-synced backtest of a single session with full gate evaluation.

Combines ReplayRunner's time-synced token feeding and periodic speaker identification
with BacktestSignalHandler's full gate evaluation (orderbook via Kalshi API, session cap)
and P&L computation. Unlike the legacy backtest/replay.py + backtest/simulate.py pipeline,
this models the real-time constraint: speaker identification only knows about
audio/transcript up to the current virtual time.

Orderbook pricing and settlement data come from the Kalshi API (get_market_full),
NOT from local SQLite snapshots. Market data is pre-fetched for all tickers at the
start of the backtest.

Usage:
    PYTHONPATH=. python backtest/run_backtest.py s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14
    PYTHONPATH=. python backtest/run_backtest.py s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14 \\
        --market scheduled/kxnbamention-26apr28phibos.json \\
        --interval 10 --duration 1200

Kalshi API credentials are read from environment variables (matching the live system):
    KALSHI_KEY_ID — Kalshi API key ID
    KALSHI_PRIVATE_KEY_PATH — path to RSA private key PEM file
    KALSHI_ENVIRONMENT — "prod" (default) or "demo"

Gate defaults (override with env vars or CLI):
    MIN_CONFIDENCE=0.80        Skip trades below this confidence
    MIN_YES_ASK_PRICE=0.02     Skip when YES ask <= 2¢ (market likely resolved YES)
    MAX_SESSION_LOSS=100.0     Cap cumulative session cost
"""

import argparse
import asyncio
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(REPO_ROOT))

from pylib.replay_runner import ReplayRunner
from pylib.kalshi_client import KalshiClient
from backtest.signal_handler import BacktestSignalHandler
from backtest.orderbook import compute_stream_start, fetch_market_data

SCHEDULED_DIR = REPO_ROOT / "scheduled"


# ── Helpers ─────────────────────────────────────────────────────────────────

def load_market(session_dir: Path, market_arg: str | None = None) -> dict | None:
    """Load market JSON from --market, session dir, or scheduled/."""
    if market_arg:
        market_path = Path(market_arg)
        if not market_path.is_absolute():
            market_path = REPO_ROOT / market_path
        if market_path.exists():
            return json.loads(market_path.read_text())
        print(f"ERROR: Market file not found: {market_path}")
        return None

    slug = session_dir.name
    parts = slug.split("_")
    clean_slug = parts[0]

    for candidate in [
        session_dir / f"{clean_slug}.json",
        SCHEDULED_DIR / f"{clean_slug}.json",
    ]:
        if candidate.exists():
            return json.loads(candidate.read_text())

    print(f"ERROR: No market JSON found for slug '{clean_slug}'")
    return None


def make_handler_factory(market_data, market, gate_config):
    """Return a handler_factory callable for ReplayRunner."""
    def factory(trade_processor, virtual_time):
        return BacktestSignalHandler(
            trade_processor,
            virtual_time,
            market_data=market_data,
            market=market,
            gate_config=gate_config,
        )
    return factory


def init_kalshi_client() -> KalshiClient | None:
    """Initialize KalshiClient from environment variables. Returns None if not configured."""
    key_id = os.environ.get("KALSHI_KEY_ID")
    private_key_path = os.environ.get("KALSHI_PRIVATE_KEY_PATH")
    if not key_id or not private_key_path:
        return None
    environment = os.environ.get("KALSHI_ENVIRONMENT", "prod")
    return KalshiClient(key_id, private_key_path, environment)


# ── Output formatting ──────────────────────────────────────────────────────

def print_results_table(signals: list, gate_config: dict):
    """Print the same summary table as simulate.py."""
    print(f"\nGates: min_confidence={gate_config['min_confidence']}, "
          f"min_yes_ask_price={gate_config['min_yes_ask_price']}, "
          f"max_session_loss={gate_config['max_session_loss']}\n")

    print("=" * 90)
    print(f"{'Time':>8s}  {'Keyword':<20s} {'Ticker':<40s} {'Fill':>7s} {'Qty':>7s} {'Cost':>7s} {'Res':>5s} {'P&L':>8s}")
    print("-" * 90)

    total_pnl = 0.0
    total_cost = 0.0
    wins = 0
    losses = 0
    trades = [s for s in signals if s.would_trade]
    blocked = [s for s in signals if not s.would_trade]

    for t in trades:
        ts = t.elapsed_secs
        ts_display = f"{ts:.1f}s" if ts < 3600 else f"{ts/60:.1f}m"
        is_win = (t.pnl or 0) > 0
        is_loss = (t.pnl or 0) < 0
        if is_win:
            wins += 1
        if is_loss:
            losses += 1
        total_pnl += t.pnl or 0
        total_cost += t.dollar_amount or 0

        print(f"{ts_display:>8s}  {t.keyword:<20s} {t.ticker:<40s} "
              f"${t.fill_price or 0:<6.4f} {t.contracts or 0:>7.1f} "
              f"${t.dollar_amount or 0:<6.2f} {t.resolution or '?':>5s} "
              f"${t.pnl or 0:>+8.2f}")

    print("-" * 90)

    # Summary
    resolved = wins + losses
    win_rate = (wins / resolved * 100) if resolved > 0 else 0
    roi = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Total signals:       {len(signals)}")
    print(f"  Trades executed:     {len(trades)}")
    print(f"  Blocked signals:     {len(blocked)}")
    print(f"  Wins:                {wins}")
    print(f"  Losses:              {losses}")
    print(f"  Unresolved:          {len(trades) - resolved}")
    print(f"  Win rate:            {win_rate:.1f}%")
    print(f"  Total cost:          ${total_cost:.2f}")
    print(f"  Total P&L:           ${total_pnl:+.2f}")
    print(f"  ROI:                 {roi:+.1f}%")

    # Gate skips breakdown
    if blocked:
        gate_skips: dict[str, int] = defaultdict(int)
        for s in blocked:
            # Simplify blocked_by to a category
            reason = s.blocked_by.split("_")[0] if "_" in s.blocked_by else s.blocked_by
            gate_skips[reason] += 1
        print(f"\n  Gate skips:")
        for reason, count in sorted(gate_skips.items(), key=lambda x: -x[1]):
            print(f"    {reason}: {count}")

    # Show blocked signals at higher verbosity
    if blocked:
        print(f"\n  Blocked signal details:")
        for s in blocked:
            print(f"    t={s.elapsed_secs:.1f}s [{s.speaker_id}] \"{s.keyword}\" → "
                  f"{s.ticker}  ({s.blocked_by})")

    return {
        "total_signals": len(signals),
        "trades": len(trades),
        "blocked": len(blocked),
        "wins": wins,
        "losses": losses,
        "unresolved": len(trades) - resolved,
        "total_cost": total_cost,
        "total_pnl": total_pnl,
        "win_rate": win_rate,
        "roi": roi,
    }


def print_firing_timeline(firings: list):
    """Print speaker identification firings."""
    print(f"\n{'='*60}")
    print(f"IDENTIFICATION FIRINGS ({len(firings)})")
    print(f"{'='*60}")
    for i, f in enumerate(firings, 1):
        labels_str = ", ".join(f"{sid}→{label}" for sid, label in f.profile_labels.items()) or "(none)"
        print(f"  [{i}] t={f.elapsed_secs:6.0f}s  words={f.total_words:5d}  labels={labels_str}")
    if not firings:
        print("  (no firings — no SpeakerRecognitionLoop ran)")


# ── Main ────────────────────────────────────────────────────────────────────

async def run_backtest(
    session_dir: Path,
    market: dict,
    *,
    kalshi_client: KalshiClient | None = None,
    market_data: dict[str, dict] | None = None,
    interval_secs: int = 10,
    max_duration_secs: int = 1200,
    gate_config: dict | None = None,
    verbose: bool = False,
) -> dict:
    """Run a time-synced backtest on a single session. Returns summary dict.

    If *market_data* is provided (pre-fetched by caller), skips the internal
    Kalshi API fetch. Otherwise, fetches via *kalshi_client* if available.
    """

    cfg = gate_config or {
        "min_confidence": float(os.environ.get("MIN_CONFIDENCE", "0.80")),
        "min_yes_ask_price": float(os.environ.get("MIN_YES_ASK_PRICE", "0.02")),
        "max_session_loss": float(os.environ.get("MAX_SESSION_LOSS", "100.0")),
    }

    # Use pre-fetched market data if provided, otherwise fetch from API
    if market_data is not None:
        pass  # caller provided it
    else:
        market_data = {}
        keywords = market.get("keywords", {})
        tickers = list(set(keywords.values()))
        if kalshi_client and tickers:
            print(f"Fetching market data for {len(tickers)} tickers from Kalshi API...")
            market_data = await fetch_market_data(kalshi_client, tickers)
            print(f"  Got data for {len(market_data)}/{len(tickers)} tickers")
        elif tickers:
            print(f"No Kalshi client — using default fill prices for {len(tickers)} tickers")

    handler_factory = make_handler_factory(market_data, market, cfg)

    runner = ReplayRunner(
        session_dir,
        market,
        interval_secs=interval_secs,
        max_duration_secs=max_duration_secs,
        handler_factory=handler_factory,
    )

    print(f"\nBacktest: {session_dir.name}")
    print(f"  Market:    {market.get('title', session_dir.name)}")
    print(f"  Interval:  {interval_secs}s")
    print(f"  Duration:  {max_duration_secs}s ({max_duration_secs // 60} min)")
    print(f"  Kalshi API: {'yes' if kalshi_client else 'no (default fill prices)'}")
    print()

    result = await runner.run()

    # Print firing timeline
    if verbose:
        print_firing_timeline(result.firings)

    # Print results table
    summary = print_results_table(result.signals, cfg)

    # Print final identification state
    if result.profile_labels:
        print(f"\n  Final speaker labels:")
        for sid, label in result.profile_labels.items():
            print(f"    Speaker {sid} → {label}")
    if result.trading_speakers:
        print(f"  Trading whitelist: {result.trading_speakers}")

    return summary


def main():
    parser = argparse.ArgumentParser(
        description="Time-synced backtest with full gate evaluation and P&L"
    )
    parser.add_argument("session_dir", help="Path to session directory with deepgram_responses/")
    parser.add_argument("--market", help="Path to market JSON (auto-detected if omitted)")
    parser.add_argument("--interval", type=int, default=10, help="Seconds between identification runs (default: 10)")
    parser.add_argument("--duration", type=int, default=1200, help="Event duration in seconds (default: 1200)")
    parser.add_argument("--min-confidence", type=float, default=None, help="Minimum keyword confidence")
    parser.add_argument("--min-yes-ask-price", type=float, default=None, help="Min YES ask price before skipping")
    parser.add_argument("--max-session-loss", type=float, default=None, help="Session loss cap")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print firing timeline and blocked signal details")
    args = parser.parse_args()

    session_dir = Path(args.session_dir)
    if not session_dir.is_absolute():
        session_dir = REPO_ROOT / session_dir
    if not session_dir.is_dir():
        print(f"ERROR: {args.session_dir} is not a valid directory")
        sys.exit(1)

    market = load_market(session_dir, args.market)
    if not market:
        sys.exit(1)

    # Build gate config from CLI or env
    gate_config = {
        "min_confidence": args.min_confidence if args.min_confidence is not None
            else float(os.environ.get("MIN_CONFIDENCE", "0.80")),
        "min_yes_ask_price": args.min_yes_ask_price if args.min_yes_ask_price is not None
            else float(os.environ.get("MIN_YES_ASK_PRICE", "0.02")),
        "max_session_loss": args.max_session_loss if args.max_session_loss is not None
            else float(os.environ.get("MAX_SESSION_LOSS", "100.0")),
    }

    # Initialize Kalshi client if credentials are available
    kalshi_client = init_kalshi_client()
    if kalshi_client:
        print(f"Kalshi API client initialized ({kalshi_client.environment})")
    else:
        print("Kalshi API not configured (set KALSHI_KEY_ID and KALSHI_PRIVATE_KEY_PATH)")

    asyncio.run(run_backtest(
        session_dir,
        market,
        kalshi_client=kalshi_client,
        interval_secs=args.interval,
        max_duration_secs=args.duration,
        gate_config=gate_config,
        verbose=args.verbose,
    ))


if __name__ == "__main__":
    main()
