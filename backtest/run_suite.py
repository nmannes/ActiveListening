#!/usr/bin/env python3
"""
run_suite.py — Run the full backtest pipeline on every non-test session in s3/.

Discovers sessions with Deepgram transcripts + market JSON, replays each through
keyword matching, simulates fills through trading gates, and aggregates results
into a master summary.

Usage:
    PYTHONPATH=. python backtest/run_suite.py                 # Full suite
    PYTHONPATH=. python backtest/run_suite.py --workers 8     # Parallel
    PYTHONPATH=. python backtest/run_suite.py --dry-run       # List sessions only
    PYTHONPATH=. python backtest/run_suite.py --type kxnba    # NBA only
    PYTHONPATH=. python backtest/run_suite.py --slug kxnbamention-26apr28phibos
"""

import argparse
import csv
import json
import os
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
S3_DIR = REPO_ROOT / "s3"
SCHEDULED_DIR = REPO_ROOT / "scheduled"
MARKET_TRACKING_DIR = REPO_ROOT / "market_tracking"
OUTPUT_DIR = REPO_ROOT / "backtest_data"

TEST_PATTERN = re.compile(r"test|sample", re.I)

REPLAY_SCRIPT = str(Path(__file__).parent / "replay.py")
SIMULATE_SCRIPT = str(Path(__file__).parent / "simulate.py")


# ── Discovery ────────────────────────────────────────────────────────────

def discover_sessions(market_type: str | None = None, slug_filter: str | None = None) -> list[dict]:
    """Find all backtestable sessions in s3/.

    A session is backtestable if it has deepgram_responses/ and a market JSON.
    Returns a list of dicts with keys: slug, session_dir, market_json, db_path.
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
        db_path = MARKET_TRACKING_DIR / f"{slug}.db"
        sessions.append({
            "slug": slug,
            "session_dir": d,
            "market_json": market_json,
            "db_path": db_path if db_path.exists() else None,
            "has_db": db_path.exists(),
        })

    return sessions


# ── Phase 1: Replay ──────────────────────────────────────────────────────

def run_replay(session: dict) -> dict:
    """Run replay.py on a single session. Returns result dict."""
    slug = session["slug"]
    out_dir = OUTPUT_DIR / slug
    signals_path = out_dir / "signals.jsonl"

    result = {
        "slug": slug,
        "session_dir": str(session["session_dir"]),
        "status": "pending",
        "signals_count": 0,
        "error": None,
    }

    # Skip if already replayed
    if signals_path.exists():
        try:
            count = sum(1 for _ in open(signals_path))
            result["status"] = "replayed"
            result["signals_count"] = count
            return result
        except Exception:
            pass

    cmd = [
        sys.executable, REPLAY_SCRIPT, str(session["session_dir"]),
        "--output", str(signals_path),
    ]

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600,
            env={**os.environ, "PYTHONPATH": str(REPO_ROOT)},
        )
        if proc.returncode != 0:
            result["status"] = "replay_failed"
            result["error"] = proc.stderr[-500:] if proc.stderr else "Unknown error"
            return result

        if signals_path.exists():
            count = sum(1 for _ in open(signals_path))
            result["signals_count"] = count
            result["status"] = "replayed"
        else:
            result["status"] = "replayed_empty"

    except subprocess.TimeoutExpired:
        result["status"] = "replay_timeout"
        result["error"] = "Timed out after 600s"
    except Exception as e:
        result["status"] = "replay_error"
        result["error"] = str(e)

    return result


# ── Phase 2: Simulate ────────────────────────────────────────────────────

def run_simulate(session: dict) -> dict:
    """Run simulate.py on a single session's signals. Returns result dict."""
    slug = session["slug"]
    signals_path = OUTPUT_DIR / slug / "signals.jsonl"

    result = {
        "slug": slug,
        "status": "pending",
        "trades": 0,
        "gated": 0,
        "total_signals": 0,
        "total_pnl": 0.0,
        "total_cost": 0.0,
        "wins": 0,
        "losses": 0,
        "unresolved": 0,
        "error": None,
    }

    if not signals_path.exists():
        result["status"] = "no_signals"
        return result

    cmd = [
        sys.executable, SIMULATE_SCRIPT, str(signals_path),
        "--session-dir", str(session["session_dir"]),
        "--market", str(session["market_json"]),
    ]
    if session.get("db_path"):
        cmd.extend(["--db", str(session["db_path"])])

    try:
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300,
            env={**os.environ, "PYTHONPATH": str(REPO_ROOT)},
        )
        if proc.returncode != 0:
            result["status"] = "simulate_failed"
            result["error"] = proc.stderr[-500:] if proc.stderr else "Unknown error"
            return result

        # Parse output for summary stats
        for line in proc.stdout.splitlines():
            line = line.strip()
            if "Total signals:" in line:
                result["total_signals"] = int(line.split(":")[-1].strip())
            elif "Trades executed:" in line:
                result["trades"] = int(line.split(":")[-1].strip())
            elif "Wins:" in line:
                result["wins"] = int(line.split(":")[-1].strip())
            elif "Losses:" in line:
                result["losses"] = int(line.split(":")[-1].strip())
            elif "Unresolved:" in line:
                result["unresolved"] = int(line.split(":")[-1].strip())
            elif "Total cost:" in line:
                result["total_cost"] = float(line.split("$")[-1].strip())
            elif "Total P&L:" in line:
                result["total_pnl"] = float(line.split("$")[-1].strip())
            elif "Gate skips:" in line:
                result["status"] = "simulated"

        result["status"] = "simulated"

    except subprocess.TimeoutExpired:
        result["status"] = "simulate_timeout"
        result["error"] = "Timed out after 300s"
    except Exception as e:
        result["status"] = "simulate_error"
        result["error"] = str(e)

    return result


# ── Main ─────────────────────────────────────────────────────────────────

def print_summary(results: list[dict], phase: str):
    """Print an aggregate table of results."""
    if not results:
        print("No results to show.")
        return

    headers = list(results[0].keys())
    widths = {h: len(h) for h in headers}
    for r in results:
        for h in headers:
            widths[h] = max(widths[h], len(str(r.get(h, ""))))

    sep = "  ".join("─" * (widths[h] + 2) for h in headers)
    print(sep)
    header_line = "  ".join(f" {h:<{widths[h]}} " for h in headers)
    print(header_line)
    print(sep)

    for r in results:
        vals = []
        for h in headers:
            v = r.get(h, "")
            if isinstance(v, float):
                s = f"${v:+.2f}" if h in ("total_pnl",) else f"${v:.2f}"
            else:
                s = str(v)
            vals.append(f" {s:<{widths[h]}} ")
        print("  ".join(vals))

    print(sep)


def main():
    parser = argparse.ArgumentParser(
        description="Run backtest suite on all non-test sessions"
    )
    parser.add_argument("--workers", "-w", type=int, default=4, help="Parallel workers (default: 4)")
    parser.add_argument("--type", help="Only run sessions of a specific market type (e.g. kxnba, kxwc)")
    parser.add_argument("--slug", help="Only run a single session by slug")
    parser.add_argument("--dry-run", action="store_true", help="List sessions without running")
    parser.add_argument("--force", "-f", action="store_true", help="Re-run replay even if signals exist")
    parser.add_argument("--csv", help="Export aggregate results to CSV")
    args = parser.parse_args()

    sessions = discover_sessions(market_type=args.type, slug_filter=args.slug)
    if not sessions:
        print("No sessions found.")
        return

    with_db = sum(1 for s in sessions if s["has_db"])
    print(f"Found {len(sessions)} sessions ({with_db} with orderbook DB)")

    if args.dry_run:
        for i, s in enumerate(sessions):
            db_tag = " [DB]" if s["has_db"] else ""
            print(f"  {i+1:3d}. {s['slug']}{db_tag}")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Phase 1: Replay
    print(f"\n{'='*60}")
    print(f"PHASE 1: REPLAY ({len(sessions)} sessions, {args.workers} workers)")
    print(f"{'='*60}")

    t0 = time.time()
    replay_results: list[dict] = []

    if args.force:
        # Delete existing signals to force re-replay
        for s in sessions:
            sp = OUTPUT_DIR / s["slug"] / "signals.jsonl"
            if sp.exists():
                sp.unlink()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(run_replay, s): s for s in sessions}
        for i, future in enumerate(as_completed(futures)):
            result = future.result()
            replay_results.append(result)
            status = result["status"]
            signals = result.get("signals_count", 0)
            marker = "✓" if status == "replayed" else "✗"
            print(f"  [{i+1:3d}/{len(sessions)}] {marker} {result['slug']:<45s} "
                  f"{signals:>4d} signals  ({status})")
            if result.get("error"):
                print(f"         ERROR: {result['error'][:120]}")

    t1 = time.time()
    print(f"\nReplay phase: {t1 - t0:.1f}s")

    # Phase 2: Simulate
    print(f"\n{'='*60}")
    print(f"PHASE 2: SIMULATE ({len(sessions)} sessions)")
    print(f"{'='*60}")

    simulate_results: list[dict] = []
    for i, s in enumerate(sessions):
        result = run_simulate(s)
        simulate_results.append(result)
        status = result["status"]
        trades = result.get("trades", 0)
        pnl = result.get("total_pnl", 0)
        marker = "✓" if status == "simulated" else "✗"
        print(f"  [{i+1:3d}/{len(sessions)}] {marker} {result['slug']:<45s} "
              f"{trades:>3d} trades  P&L=${pnl:+.2f}  ({status})")

    t2 = time.time()
    print(f"\nSimulate phase: {t2 - t1:.1f}s")
    print(f"Total time: {t2 - t0:.1f}s")

    # Phase 3: Aggregate
    print(f"\n{'='*60}")
    print(f"AGGREGATE RESULTS")
    print(f"{'='*60}")

    total_sessions = len(simulate_results)
    total_signals = sum(r.get("total_signals", 0) for r in simulate_results)
    total_trades = sum(r.get("trades", 0) for r in simulate_results)
    total_wins = sum(r.get("wins", 0) for r in simulate_results)
    total_losses = sum(r.get("losses", 0) for r in simulate_results)
    total_cost = sum(r.get("total_cost", 0) for r in simulate_results)
    total_pnl = sum(r.get("total_pnl", 0) for r in simulate_results)
    total_unresolved = sum(r.get("unresolved", 0) for r in simulate_results)

    resolved = total_wins + total_losses
    win_rate = (total_wins / resolved * 100) if resolved > 0 else 0
    roi = (total_pnl / total_cost * 100) if total_cost > 0 else 0

    # Sessions with trades
    active = [r for r in simulate_results if r.get("trades", 0) > 0]
    profitable = [r for r in simulate_results if r.get("total_pnl", 0) > 0]
    losing = [r for r in simulate_results if r.get("total_pnl", 0) < 0]

    print(f"\n  Sessions processed:   {total_sessions}")
    print(f"  Total signals:        {total_signals}")
    print(f"  Total trades:         {total_trades}")
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
    for r in simulate_results:
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

    # Export CSV
    if args.csv:
        csv_path = Path(args.csv)
        if not csv_path.is_absolute():
            csv_path = REPO_ROOT / csv_path
        fieldnames = ["slug", "status", "total_signals", "trades", "wins", "losses",
                      "unresolved", "total_cost", "total_pnl"]
        with open(csv_path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in sorted(simulate_results, key=lambda r: r.get("total_pnl", 0)):
                writer.writerow(r)
        print(f"\n  Exported to {csv_path}")

    # Failures
    failures = [r for r in simulate_results if r["status"] not in ("simulated", "no_signals")]
    if failures:
        print(f"\n  Failures ({len(failures)}):")
        for r in failures:
            print(f"    {r['slug']}: {r['status']} — {r.get('error', '')[:100]}")


if __name__ == "__main__":
    main()
