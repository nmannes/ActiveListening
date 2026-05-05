#!/usr/bin/env python3
import json
import sqlite3
import re
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Paths
SIGNAL_LOG = "SIGNAL.json"
MARKET_TRACKING_DIR = Path("market_tracking")

def parse_signal_timestamp(ts_str):
    """Parses '2026-05-04 21:36:10.941' into a datetime object."""
    return datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S.%f")

def parse_db_timestamp(ts_str):
    """Parses '2026-05-04T21:36:10.941Z' into a datetime object."""
    ts_str = ts_str.replace('Z', '').replace('T', ' ')
    if '.' in ts_str:
        base, micros = ts_str.split('.')
        micros = micros.ljust(6, '0')[:6]
        ts_str = f"{base}.{micros}"
    else:
        ts_str = f"{ts_str}.000000"
    
    try:
        return datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S.%f")
    except ValueError:
        # Fallback for simpler formats
        return datetime.strptime(ts_str.split('.')[0], "%Y-%m-%d %H:%M:%S")

def format_delta(td):
    """Formats a timedelta as ms."""
    return f"{td.total_seconds() * 1000:.1f}ms"

def main():
    if not os.path.exists(SIGNAL_LOG):
        print(f"Error: {SIGNAL_LOG} not found.")
        return

    with open(SIGNAL_LOG, 'r') as f:
        signals = json.load(f)

    # Store all candidate matches: (session, keyword) -> list of results
    candidates = {}
    skips = {"no_db": 0, "no_ticker": set(), "no_clear": set()}
    unique_signals_in_log = set()

    # Regex to extract session, speaker, and keyword
    signal_re = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) .* \[(.*?)\]\[SIGNAL\] Detected for speaker (\d+): \"(.*?)\"")

    for entry in signals:
        message = entry.get("@message", "")
        match = signal_re.search(message)
        if not match:
            continue

        ts_str, session_id, speaker_id, keyword = match.groups()
        unique_signals_in_log.add((session_id, keyword))
        
        signal_ts = parse_signal_timestamp(ts_str)
        signal_ts_iso = signal_ts.strftime("%Y-%m-%dT%H:%M:%S.%f") + 'Z'
        
        db_path = MARKET_TRACKING_DIR / f"{session_id}.db"
        if not db_path.exists():
            skips["no_db"] += 1
            continue

        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        cursor = conn.cursor()

        # Find all tickers in this DB
        try:
            cursor.execute("SELECT DISTINCT ticker FROM snapshots")
            tickers = [row[0] for row in cursor.fetchall()]
        except sqlite3.OperationalError:
            tickers = []
        
        target_ticker = None
        keyword_clean = keyword.upper().replace(' ', '')
        
        # Matching strategies
        for t in tickers:
            suffix = t.split('-')[-1]
            if suffix == keyword_clean or suffix in keyword_clean or keyword_clean.startswith(suffix):
                target_ticker = t
                break
        if not target_ticker and keyword_clean == "ARTIFICIALINTELLIGENCE":
            for t in tickers:
                if t.endswith("-AI"):
                    target_ticker = t
                    break
        if not target_ticker:
            for t in tickers:
                suffix = t.split('-')[-1]
                if len(suffix) >= 3 and keyword_clean.startswith(suffix):
                    target_ticker = t
                    break

        if not target_ticker:
            skips["no_ticker"].add((session_id, keyword))
            conn.close()
            continue

        # Get price at signal time
        cursor.execute("SELECT price FROM deltas WHERE ticker = ? AND ts < ? ORDER BY ts DESC LIMIT 1", (target_ticker, signal_ts_iso))
        start_price_match = cursor.fetchone()
        start_price = start_price_match[0] if start_price_match else "???"

        # Find the EARLIEST clearing event
        cursor.execute("""
            SELECT ts, price, side, delta FROM deltas 
            WHERE ticker = ? AND ((side = 'no' AND price <= 1) OR (side = 'yes' AND price >= 99))
            ORDER BY ts ASC LIMIT 1
        """, (target_ticker,))
        first_clear_match = cursor.fetchone()
        
        if first_clear_match:
            clear_ts_str, end_price, side, delta = first_clear_match
            clear_ts = parse_db_timestamp(clear_ts_str)
            latency = clear_ts - signal_ts
            abs_latency = abs(latency.total_seconds())
            
            sig_key = (session_id, keyword)
            if sig_key not in candidates or abs_latency < abs(candidates[sig_key]["latency_s"]):
                candidates[sig_key] = {
                    "session": session_id,
                    "keyword": keyword,
                    "signal_ts": ts_str,
                    "clear_ts": clear_ts_str,
                    "status": "FIRST" if latency.total_seconds() > 0 else "LATE",
                    "start_price": start_price,
                    "end_price": end_price,
                    "latency": latency,
                    "latency_s": latency.total_seconds()
                }
        else:
            skips["no_clear"].add((session_id, keyword))

        conn.close()

    # Print results
    print(f"{'Session':<35} | {'Keyword':<15} | {'Signal TS':<23} | {'Clear TS':<23} | {'Stat':<5} | {'Start':<5} | {'End':<5} | {'Latency'}")
    print("-" * 155)

    sorted_results = sorted(candidates.values(), key=lambda x: (x["session"], x["signal_ts"]))
    for r in sorted_results:
        try:
            print(f"{r['session']:<35} | {r['keyword']:<15} | {r['signal_ts']} | {r['clear_ts']:<23} | {r['status']:<5} | {r['start_price']:<5} | {r['end_price']:<5} | {format_delta(r['latency'])}")
        except BrokenPipeError:
            devnull = os.open(os.devnull, os.O_WRONLY)
            os.dup2(devnull, sys.stdout.fileno())
            sys.exit(0)

    if sorted_results:
        wins = len([r for r in sorted_results if r["status"] == "FIRST"])
        losses = len(sorted_results) - wins
        avg_latency = sum(r["latency_s"] for r in sorted_results if r["status"] == "FIRST") * 1000 / (wins if wins > 0 else 1)
        
        print("-" * 155)
        print(f"Total Unique Signals in Logs: {len(unique_signals_in_log)}")
        print(f"Total Unique Matches Found:  {len(sorted_results)}")
        print(f"  - Detected FIRST (WIN):     {wins} ({wins/len(sorted_results)*100:.1f}%)")
        print(f"  - Detected LATE (LOSS):     {losses}")
        print(f"  - Skipped (No DB file):     {skips['no_db']}")
        print(f"  - Skipped (Ticker not found): {len(skips['no_ticker'])}")
        print(f"  - Skipped (Never cleared):  {len(skips['no_clear'])}")
        if skips["no_ticker"]:
            examples = sorted(list(set(k for s, k in skips["no_ticker"])))[:10]
            print(f"    Examples of keywords with no ticker: {', '.join(examples)}...")
        print("-" * 155)
        print(f"Average Win Latency: {avg_latency:.1f}ms")

if __name__ == "__main__":
    main()
