#!/usr/bin/env python3
"""Download session data from S3 for backtesting.

Usage:
    python backtest/fetch_data.py --slug kxnbamention-26apr28phibos
    python backtest/fetch_data.py --s3-dir s3/kxnbamention-26apr28phibos_2026-04-29_02-27-14
    python backtest/fetch_data.py --slugs sessions.txt
"""

import argparse
import json
import shutil
import sys
from pathlib import Path

# Paths relative to repo root
REPO_ROOT = Path(__file__).parent.parent
S3_DIR = REPO_ROOT / "s3"
SCHEDULED_DIR = REPO_ROOT / "scheduled"
MARKET_TRACKING_DIR = REPO_ROOT / "market_tracking"
OUTPUT_DIR = REPO_ROOT / "backtest_data"


def find_session_dir(slug: str) -> Path | None:
    """Find the s3/ directory matching a session slug."""
    matches = []
    for d in S3_DIR.iterdir():
        if d.is_dir() and d.name.startswith(slug):
            if (d / "deepgram_responses").is_dir():
                matches.append(d)
    if not matches:
        return None
    if len(matches) > 1:
        print(f"  Multiple matches for '{slug}':")
        for m in matches:
            print(f"    {m.relative_to(REPO_ROOT)}")
        print(f"  Using {matches[0].relative_to(REPO_ROOT)}")
    return matches[0]


def fetch_session(slug: str, session_dir: Path, include_orderbook: bool = True) -> bool:
    """Fetch all data for a session into backtest_data/<slug>/."""
    out_dir = OUTPUT_DIR / slug
    out_dir.mkdir(parents=True, exist_ok=True)

    # Copy deepgram_responses
    dg_src = session_dir / "deepgram_responses"
    if not dg_src.is_dir():
        print(f"  ERROR: No deepgram_responses/ in {session_dir}")
        return False

    dg_dst = out_dir / "deepgram_responses"
    if dg_dst.exists():
        shutil.rmtree(dg_dst)
    shutil.copytree(dg_src, dg_dst)
    dg_count = len(list(dg_dst.glob("dg_*.json")))
    print(f"  Copied {dg_count} Deepgram responses")

    # Copy market JSON — check session dir first, then scheduled/
    market_dst = out_dir / "market.json"
    market_src = session_dir / f"{slug}.json"
    if not market_src.exists():
        market_src = SCHEDULED_DIR / f"{slug}.json"
    if market_src.exists():
        shutil.copy2(market_src, market_dst)
        market = json.loads(market_dst.read_text())
        kw_count = len(market.get("keywords", {}))
        print(f"  Copied market JSON with {kw_count} keywords")
    else:
        print(f"  WARNING: No market JSON found for '{slug}'")

    # Copy orderbook DB
    if include_orderbook:
        db_path = MARKET_TRACKING_DIR / f"{slug}.db"
        if db_path.exists():
            for ext in [".db", ".db-wal", ".db-shm"]:
                src = MARKET_TRACKING_DIR / f"{slug}{ext}"
                if src.exists():
                    shutil.copy2(src, out_dir / f"{slug}{ext}")
            print(f"  Copied orderbook database")
        else:
            print(f"  No orderbook DB (expected: {slug}.db)")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Fetch session data (transcripts + market JSON + orderbook) for backtesting"
    )
    parser.add_argument("--slug", help="Session slug (e.g. kxnbamention-26apr28phibos)")
    parser.add_argument("--slugs", help="File with one slug per line")
    parser.add_argument("--s3-dir", help="Direct path to s3 session directory")
    parser.add_argument("--no-orderbook", action="store_true", help="Skip orderbook DB copy")
    args = parser.parse_args()

    slugs: list[tuple[str, Path | None]] = []

    if args.slug:
        slugs.append((args.slug, None))
    if args.slugs:
        with open(args.slugs) as f:
            for line in f:
                line = line.strip()
                if line:
                    slugs.append((line, None))
    if args.s3_dir:
        s3_path = Path(args.s3_dir)
        if not s3_path.is_absolute():
            s3_path = REPO_ROOT / s3_path
        if not s3_path.is_dir():
            print(f"ERROR: {args.s3_dir} is not a valid directory")
            sys.exit(1)
        slug = s3_path.name
        slugs.append((slug, s3_path))

    if not slugs:
        parser.print_help()
        print("\nERROR: Provide --slug, --slugs, or --s3-dir")
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    include_ob = not args.no_orderbook

    for slug, override_dir in slugs:
        print(f"\nFetching {slug}...")
        session_dir = override_dir or find_session_dir(slug)
        if not session_dir:
            print(f"  ERROR: No session directory found for '{slug}'")
            continue
        fetch_session(slug, session_dir, include_orderbook=include_ob)

    print(f"\nDone. Data in {OUTPUT_DIR}/")


if __name__ == "__main__":
    main()
