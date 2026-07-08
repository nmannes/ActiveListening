#!/usr/bin/env python
"""
For each Kalshi order, find the exact Deepgram response file that contains
the keyword that triggered the bet, then compare confidence between wins/losses.
"""

import os
import sys
import json
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(".env.prod")

from pylib.kalshi_client import KalshiClient

S3_DIR = Path(__file__).resolve().parent.parent / "s3"
SCHEDULED_DIR = Path(__file__).resolve().parent.parent / "scheduled"


# ── Kalshi API ────────────────────────────────────────────────────

class KalshiAnalyzer(KalshiClient):
    def _get(self, path: str, params: dict = None) -> dict:
        url = self.base_url + path
        headers = self._get_auth_headers("GET", url)
        resp = self.session.get(url, headers=headers, params=params or {})
        resp.raise_for_status()
        return resp.json()

    def _paginate(self, path: str, params: dict = None, key: str = None) -> list:
        params = dict(params or {})
        params.setdefault("limit", 200)
        all_items = []
        cursor = None
        while True:
            if cursor:
                params["cursor"] = cursor
            data = self._get(path, params)
            items = data.get(key or self._infer_key(path), [])
            all_items.extend(items)
            cursor = data.get("cursor")
            if not cursor:
                break
            time.sleep(0.05)
        return all_items

    @staticmethod
    def _infer_key(path: str) -> str:
        return {
            "/portfolio/orders": "orders",
            "/portfolio/fills": "fills",
            "/portfolio/positions": "market_positions",
            "/portfolio/settlements": "settlements",
        }.get(path, "data")

    def get_orders(self, **filters) -> list:
        return self._paginate("/portfolio/orders", filters)

    def get_fills(self, **filters) -> list:
        return self._paginate("/portfolio/fills", filters)

    def get_settlements(self, **filters) -> list:
        return self._paginate("/portfolio/settlements", filters)

    def get_positions(self, **filters) -> list:
        return self._paginate("/portfolio/positions", filters)

    def get_market(self, ticker: str) -> dict:
        data = self._get(f"/markets/{ticker}")
        return data.get("market", data)


def parse_float(s) -> float:
    if isinstance(s, (int, float)):
        return float(s)
    if isinstance(s, str):
        return float(s) if s else 0.0
    return 0.0


# ── Keyword / Ticker mapping ──────────────────────────────────────

def get_keywords_for_ticker(ticker: str, s3_folders: list[Path],
                             kalshi_client=None, kalshi_cache: dict = None) -> list[str]:
    """Get the actual keywords for this ticker.

    Checks in order:
    1. Kalshi API custom_strike.Word (definitive)
    2. {slug}.json in the S3 folder
    3. scheduled/*.json files
    4. Fallback to 4-char ticker suffix
    """
    ticker_upper = ticker.upper()

    # 1. Kalshi API (cached, with retry)
    if kalshi_client and kalshi_cache is not None:
        if ticker_upper not in kalshi_cache:
            word = None
            for attempt in range(3):
                try:
                    market = kalshi_client.get_market(ticker)
                    word = market.get("custom_strike", {}).get("Word", "")
                    break
                except Exception:
                    time.sleep(0.5 * (attempt + 1))
            if word:
                words = [w.strip().lower() for w in word.split("/")]
                kalshi_cache[ticker_upper] = words
            else:
                kalshi_cache[ticker_upper] = []
            time.sleep(0.1)  # rate limit
        if kalshi_cache.get(ticker_upper):
            return kalshi_cache[ticker_upper]

    # 2. Check S3 folder's slug.json
    for folder in s3_folders:
        slug = folder.name.split("_")[0]
        config_path = folder / f"{slug}.json"
        if config_path.exists():
            try:
                with open(config_path) as f:
                    data = json.load(f)
                for word, tkr in data.get("keywords", {}).items():
                    if tkr.upper() == ticker_upper:
                        return [word.lower()]
            except Exception:
                continue

    # 3. Check scheduled/*.json
    if SCHEDULED_DIR.is_dir():
        for fpath in SCHEDULED_DIR.glob("*.json"):
            try:
                with open(fpath) as f:
                    data = json.load(f)
            except Exception:
                continue
            for word, tkr in data.get("keywords", {}).items():
                if tkr.upper() == ticker_upper:
                    return [word.lower()]

    # 4. Fallback: derive from 4-char ticker suffix
    suffix = ticker.rsplit("-", 1)[-1].lower() if "-" in ticker else ""
    if len(suffix) == 4:
        return [suffix]
    return [suffix] if suffix else []


# ── S3 / Deepgram ─────────────────────────────────────────────────

def find_s3_folders_for_slug(slug: str) -> list[Path]:
    folders = []
    for entry in S3_DIR.iterdir():
        if entry.is_dir() and entry.name.startswith(slug + "_"):
            folders.append(entry)
    return folders


def ticker_to_slug(ticker: str, settlement: dict = None) -> str | None:
    if settlement:
        et = settlement.get("event_ticker", "")
        if et:
            return et.lower()
    parts = ticker.rsplit("-", 1)
    base = parts[0] if len(parts) > 1 else ticker
    return base.lower()


def load_dg_files_sorted(dg_dir: Path) -> list[tuple[int, Path]]:
    """Return sorted list of (timestamp_ns, path) for all DG files in a directory."""
    files = []
    if not dg_dir.exists():
        return files
    for f in dg_dir.iterdir():
        if not f.name.startswith("dg_") or not f.name.endswith(".json"):
            continue
        try:
            ts_ns = int(f.name.removeprefix("dg_").removesuffix(".json"))
            files.append((ts_ns, f))
        except ValueError:
            continue
    files.sort(key=lambda x: x[0])
    return files


def dg_contains_keyword(dg_path: Path, keywords: list[str]) -> dict | None:
    """Check if a DG file's transcript contains any of the keywords.
    Returns word confidence info if found, None otherwise.

    keywords can be either single words or phrases like 'penalty kick'.
    We search for any of them as substring matches in the transcript.
    """
    try:
        with open(dg_path) as f:
            data = json.load(f)
    except Exception:
        return None

    if data.get("type") != "Results":
        return None

    alt = data.get("channel", {}).get("alternatives", [{}])[0]
    transcript = alt.get("transcript", "").lower()
    words = alt.get("words", [])

    # Find which keyword matches in the transcript (space-insensitive for compounds)
    matched_kw = None
    transcript_nospace = transcript.replace(" ", "")
    for kw in keywords:
        # Direct substring match
        if kw in transcript:
            matched_kw = kw
            break
        # For phrases: check if all parts appear in transcript
        if " " in kw:
            parts = kw.split()
            if all(p in transcript for p in parts):
                matched_kw = kw
                break
        # For compounds: check space-insensitive ("comeback" matching "come back")
        if " " not in kw and kw in transcript_nospace:
            matched_kw = kw
            break

    if not matched_kw:
        return None

    # Found it — extract detailed confidence info
    all_confs = []
    kw_word_confs = []
    speakers = set()

    kw_parts = matched_kw.split()

    for w in words:
        wc = w.get("confidence", 0)
        word_text = w.get("word", "").lower().strip()
        spk = w.get("speaker")
        if spk is not None:
            speakers.add(spk)
        all_confs.append({"word": word_text, "confidence": wc, "start": w.get("start"), "speaker": spk})

        # Check if this specific word is part of the matched keyword
        if word_text in kw_parts or any(kp in word_text for kp in kw_parts):
            kw_word_confs.append({"word": word_text, "confidence": wc, "start": w.get("start")})

    n = len(all_confs)
    confs = [w["confidence"] for w in all_confs]
    avg_conf = sum(confs) / n if n else 0
    min_conf = min(confs) if confs else 0
    kw_avg = sum(w["confidence"] for w in kw_word_confs) / len(kw_word_confs) if kw_word_confs else 0

    is_final = data.get("is_final", False) or data.get("speech_final", False)

    return {
        "matched_keyword": matched_kw,
        "is_final": bool(is_final),
        "transcript": transcript,
        "transcript_confidence": alt.get("confidence", 0),
        "word_count": n,
        "avg_confidence": round(avg_conf, 4),
        "min_confidence": round(min_conf, 4),
        "kw_word_confs": kw_word_confs,
        "kw_avg_confidence": round(kw_avg, 4),
        "speakers": list(speakers),
        "all_word_confs": all_confs,
    }


# ── Main ──────────────────────────────────────────────────────────

def fmt_d(dollars) -> str:
    return f"${dollars:,.2f}"


def main():
    print("=" * 90)
    print("  FINDING THE EXACT DEEPGRAM FILE FOR EACH ORDER")
    print("=" * 90)

    # 1. Fetch from Kalshi
    client = KalshiAnalyzer(
        key_id=os.environ["KALSHI_KEY_ID"],
        private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
        environment=os.environ.get("KALSHI_ENV", "prod"),
    )
    print(f"\nAPI: {client.base_url}")

    print("Fetching data from Kalshi...")
    settlements = client.get_settlements()
    fills = client.get_fills()
    orders = client.get_orders(status="executed")
    print(f"  {len(settlements)} settlements, {len(fills)} fills, {len(orders)} orders")

    # Build lookups
    settlement_by_ticker = {}
    for s in settlements:
        t = s.get("ticker", "")
        if t:
            settlement_by_ticker[t] = s

    # 2. Compute P&L per ticker
    ticker_data = defaultdict(lambda: {
        "orders": [], "yes_count": 0.0, "no_count": 0.0,
        "yes_cost": 0.0, "no_cost": 0.0,
    })

    for o in orders:
        t = o.get("ticker", "")
        if t:
            ticker_data[t]["orders"].append(o)

    for f in fills:
        t = f.get("ticker", "")
        if not t:
            continue
        td = ticker_data[t]
        side = f.get("side", "").lower()
        count = parse_float(f.get("count_fp", 0))
        price = parse_float(f.get("yes_price_dollars", 0)) if side == "yes" else parse_float(f.get("no_price_dollars", 0))
        cost = count * price
        if side == "yes":
            td["yes_count"] += count
            td["yes_cost"] += cost
        else:
            td["no_count"] += count
            td["no_cost"] += cost

    # Classify
    wins = {}
    losses = {}
    unresolved = {}

    for ticker, td in ticker_data.items():
        total_cost = td["yes_cost"] + td["no_cost"]
        if total_cost == 0:
            continue
        settlement = settlement_by_ticker.get(ticker, {})
        result = settlement.get("market_result")
        if not result:
            unresolved[ticker] = (td, total_cost)
            continue

        if result.lower() == "yes":
            payout = td["yes_count"] * 1.0
        else:
            payout = td["no_count"] * 1.0

        pl = payout - total_cost
        if pl > 0:
            wins[ticker] = (pl, td, result)
        else:
            losses[ticker] = (pl, td, result)

    print(f"  {len(wins)} wins, {len(losses)} losses, {len(unresolved)} unresolved")

    # 3. For each order, find the DG file containing the keyword
    print(f"\n{'=' * 90}")
    print("  SEARCHING DEEPGRAM FILES FOR KEYWORDS")
    print(f"{'=' * 90}")

    results = []  # (ticker, pl, outcome, conf_data)
    uncorrelated_results = []  # tickers with no DG match — included in baseline
    kalshi_keyword_cache = {}  # ticker → [keywords]

    stats = {"found": 0, "no_slug": 0, "no_s3": 0, "no_keyword": 0, "keyword_not_found": 0, "empty_dg": 0}

    for ticker, td in ticker_data.items():
        if not td["orders"]:
            continue

        # Only analyze mention-based markets
        if "mention" not in ticker.lower():
            continue

        outcome = "WIN" if ticker in wins else ("LOSS" if ticker in losses else "UNRESOLVED")
        pl = wins.get(ticker, (0,))[0] if ticker in wins else losses.get(ticker, (0,))[0]

        settlement = settlement_by_ticker.get(ticker, {})
        slug = ticker_to_slug(ticker, settlement)
        if not slug:
            stats["no_slug"] += 1
            continue

        s3_folders = find_s3_folders_for_slug(slug)
        if not s3_folders:
            stats["no_s3"] += 1
            continue

        # Get keywords for this ticker (Kalshi API first, then S3/scheduled/suffix)
        keywords = get_keywords_for_ticker(ticker, s3_folders, client, kalshi_keyword_cache)
        if not keywords:
            stats["no_keyword"] += 1
            continue

        # For each order on this ticker, find the DG file containing the keyword
        for order in td["orders"]:
            created_str = order.get("created_time", "")
            if not created_str:
                continue
            try:
                dt = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                order_ns = int(dt.timestamp() * 1e9)
            except Exception:
                continue

            found_conf = None
            best_folder = None
            best_diff = float("inf")

            for folder in s3_folders:
                dg_dir = folder / "deepgram_responses"
                dg_files = load_dg_files_sorted(dg_dir)
                if not dg_files:
                    continue

                # Search BACKWARD from order time
                # Find the closest DG file BEFORE the order
                for ts_ns, dg_path in reversed(dg_files):
                    if ts_ns > order_ns:
                        continue  # Skip files after the order
                    diff = (order_ns - ts_ns) / 1e9
                    if diff > 120:  # Don't search more than 2 min back
                        break

                    conf = dg_contains_keyword(dg_path, keywords)
                    if conf:
                        if diff < best_diff:
                            best_diff = diff
                            conf["dg_file"] = dg_path.name
                            conf["dg_ts_ns"] = ts_ns
                            conf["dg_diff_secs"] = round(diff, 3)
                            conf["s3_folder"] = folder.name
                            conf["keywords_searched"] = keywords
                            found_conf = conf
                            best_folder = folder
                        break  # Found the closest one before this order

            if found_conf:
                results.append((ticker, pl, outcome, found_conf))
                stats["found"] += 1
            else:
                # Track uncorrelated orders — no confidence data but included in baseline
                uncorrelated_results.append((ticker, pl, outcome, {
                    "matched_keyword": "[not in DG]",
                    "is_final": False,
                    "transcript": "",
                    "transcript_confidence": 0,
                    "word_count": 0,
                    "avg_confidence": 0,
                    "min_confidence": 0,
                    "kw_word_confs": [],
                    "kw_avg_confidence": -1,  # sentinel: no confidence data
                    "speakers": [],
                    "all_word_confs": [],
                    "dg_file": "",
                    "dg_diff_secs": 0,
                    "s3_folder": "",
                }))
                stats["keyword_not_found"] += 1
            break  # Found (or not), move to next ticker

    print(f"\n  Found keyword in DG: {stats['found']}")
    print(f"  Keyword not in any DG: {stats['keyword_not_found']}")
    print(f"  No slug: {stats['no_slug']}")
    print(f"  No S3 folder: {stats['no_s3']}")
    print(f"  No keyword mapping: {stats['no_keyword']}")

    # Combine correlated and uncorrelated for full picture
    all_results = results + uncorrelated_results

    if not all_results:
        print("\nNo results to analyze!")
        return

    # 4. Analyze results
    win_results = [(t, pl, c) for t, pl, o, c in results if o == "WIN"]
    lose_results = [(t, pl, c) for t, pl, o, c in results if o == "LOSS"]
    unres_results = [(t, pl, c) for t, pl, o, c in results if o == "UNRESOLVED"]

    all_win_results = [(t, pl, c) for t, pl, o, c in all_results if o == "WIN"]
    all_lose_results = [(t, pl, c) for t, pl, o, c in all_results if o == "LOSS"]

    print(f"\n{'=' * 90}")
    print("  WINNERS vs LOSERS — KEYWORD CONFIDENCE")
    print(f"{'=' * 90}")

    def summarize(label, items):
        if not items:
            print(f"\n  {label}: 0 markets")
            return
        kw_avgs = [c["kw_avg_confidence"] for _, _, c in items]
        word_avgs = [c["avg_confidence"] for _, _, c in items]
        min_confs = [c["min_confidence"] for _, _, c in items]
        trans_confs = [c["transcript_confidence"] for _, _, c in items]
        interim_count = sum(1 for _, _, c in items if not c.get("is_final"))
        final_count = sum(1 for _, _, c in items if c.get("is_final"))

        print(f"\n  {label} ({len(items)} markets):")
        print(f"    Interim files: {interim_count} ({interim_count/len(items)*100:.0f}%)")
        print(f"    Final files:   {final_count} ({final_count/len(items)*100:.0f}%)")
        print(f"    Keyword-word avg confidence:  mean={sum(kw_avgs)/len(kw_avgs):.4f}  min={min(kw_avgs):.4f}  max={max(kw_avgs):.4f}")
        print(f"    All-word avg confidence:      mean={sum(word_avgs)/len(word_avgs):.4f}  min={min(word_avgs):.4f}")
        print(f"    Min word in window:           mean={sum(min_confs)/len(min_confs):.4f}  worst={min(min_confs):.4f}")
        print(f"    Transcript confidence:        mean={sum(trans_confs)/len(trans_confs):.4f}")

        # Distribution
        buckets = {"<0.5": 0, "0.5-0.7": 0, "0.7-0.8": 0, "0.8-0.9": 0, "0.9+": 0}
        for avg in kw_avgs:
            if avg < 0.5: buckets["<0.5"] += 1
            elif avg < 0.7: buckets["0.5-0.7"] += 1
            elif avg < 0.8: buckets["0.7-0.8"] += 1
            elif avg < 0.9: buckets["0.8-0.9"] += 1
            else: buckets["0.9+"] += 1
        print(f"    Keyword confidence distribution:")
        for b, cnt in buckets.items():
            pct = cnt / len(items) * 100 if items else 0
            bar = "█" * int(pct / 2)
            print(f"      {b:8s}: {cnt:3d} ({pct:5.1f}%) {bar}")

    summarize("WINNERS (correlated)", win_results)
    summarize("LOSERS (correlated)", lose_results)

    # Combined baseline including uncorrelated
    uncor_wins = len([u for u in uncorrelated_results if u[2] == "WIN"])
    uncor_losses = len([u for u in uncorrelated_results if u[2] == "LOSS"])
    uncor_pl = sum(u[1] for u in uncorrelated_results)

    print(f"\n  COMBINED BASELINE (correlated + uncorrelated):")
    print(f"    Correlated:   {len(results)} orders ({len(win_results)}W/{len(lose_results)}L)  P&L {sum(r[1] for r in results):+.2f}")
    print(f"    Uncorrelated: {len(uncorrelated_results)} orders ({uncor_wins}W/{uncor_losses}L)  P&L {uncor_pl:+.2f}")
    print(f"    Total:        {len(all_results)} orders ({len(all_win_results)}W/{len(all_lose_results)}L)  P&L {sum(r[1] for r in all_results):+.2f}")

    # 5. Detailed per-ticker
    print(f"\n{'=' * 90}")
    print("  ALL RESULTS (sorted by keyword-word confidence)")
    print(f"{'=' * 90}")

    all_sorted = sorted(results, key=lambda x: x[3]["kw_avg_confidence"])

    print(f"\n  {'Ticker':42s} {'Outcome':8s} {'P&L':>9s} {'Final?':6s} {'KW_Conf':>8s} {'WordAvg':>8s} {'MinWord':>8s} {'Trans':>8s} {'Diff_s':>7s} {'MatchedKW':15s} {'Transcript'}")
    print(f"  {'-'*42} {'-'*8} {'-'*9} {'-'*6} {'-'*8} {'-'*8} {'-'*8} {'-'*8} {'-'*7} {'-'*15} {'-'*30}")

    for ticker, pl, outcome, c in all_sorted:
        transcript = c["transcript"][:50]
        final_str = "Y" if c.get("is_final") else "N"
        print(f"  {ticker:42s} {outcome:8s} {fmt_d(pl):>9s} {final_str:>6s} {c['kw_avg_confidence']:>8.4f} {c['avg_confidence']:>8.4f} {c['min_confidence']:>8.4f} {c['transcript_confidence']:>8.4f} {c.get('dg_diff_secs',0):>7.3f} {c['matched_keyword']:15s} \"{transcript}\"")

    # 6. Update all_*_results with uncorrelated counted as no-confidence
    all_win_results = [(t, pl, c) for t, pl, o, c in all_results if o == "WIN"]
    all_lose_results = [(t, pl, c) for t, pl, o, c in all_results if o == "LOSS"]

    # 6b. Filter evaluation on FULL dataset (uncorrelated always pass)
    print(f"\n{'=' * 90}")
    print("  FILTER EVALUATION — FULL DATASET (uncorrelated always pass)")
    print(f"{'=' * 90}")

    def has_conf(c):
        return c.get("kw_avg_confidence", -1) >= 0

    total_full_pl = sum(r[1] for r in all_results)
    cor_pl = sum(r[1] for r in results)
    uncor_pl = sum(r[1] for r in uncorrelated_results)
    print(f"\n  Full baseline: {len(all_results)} orders ({len(all_win_results)}W/{len(all_lose_results)}L)  P&L {total_full_pl:+.2f}")
    print(f"    Correlated:   {len(results)} orders  P&L {cor_pl:+.2f}")
    print(f"    Uncorrelated: {len(uncorrelated_results)} orders  P&L {uncor_pl:+.2f}  (no confidence data)")
    print()

    for thresh in [0.6, 0.7, 0.8]:
        kept = [r for r in all_results
                if (has_conf(r[3]) and r[3]["kw_avg_confidence"] >= thresh) or not has_conf(r[3])]
        kept_pl = sum(r[1] for r in kept)
        filtered = [r for r in all_results if r not in kept]
        f_wins = len([f for f in filtered if f[2] == "WIN"])
        f_losses = len([f for f in filtered if f[2] == "LOSS"])
        f_pl = sum(f[1] for f in filtered)
        print(f"  conf >= {thresh}: {len(kept)} kept  P&L {kept_pl:+.2f}  ({len(filtered)} filtered: {f_wins}W/{f_losses}L, {f_pl:+.2f})")

    # 7. Interim vs Final breakdown (correlated only)
    print(f"\n{'=' * 90}")
    print("  INTERIM vs FINAL — WIN/LOSS ANALYSIS")
    print(f"{'=' * 90}")

    for label, items in [("WINNERS", win_results), ("LOSERS", lose_results)]:
        if not items:
            continue
        interim_items = [(t, pl, c) for t, pl, c in items if not c.get("is_final")]
        final_items = [(t, pl, c) for t, pl, c in items if c.get("is_final")]

        print(f"\n  {label}:")
        if interim_items:
            kw_avgs = [c["kw_avg_confidence"] for _, _, c in interim_items]
            print(f"    Interim ({len(interim_items)}): kw_conf mean={sum(kw_avgs)/len(kw_avgs):.4f}  min={min(kw_avgs):.4f}")
            worst = sorted(interim_items, key=lambda x: x[2]["kw_avg_confidence"])[:3]
            for t, pl, c in worst:
                print(f"      {t} {fmt_d(pl)} kw='{c['matched_keyword']}' conf={c['kw_avg_confidence']:.4f} \"{c['transcript'][:60]}\"")
        if final_items:
            kw_avgs = [c["kw_avg_confidence"] for _, _, c in final_items]
            print(f"    Final ({len(final_items)}):   kw_conf mean={sum(kw_avgs)/len(kw_avgs):.4f}  min={min(kw_avgs):.4f}")

    # 7. Winners with low keyword confidence (lucky wins?)
    low_conf_wins = [(t, pl, c) for t, pl, c in win_results if c["kw_avg_confidence"] < 0.8]
    if low_conf_wins:
        print(f"\n{'=' * 90}")
        print(f"  LOW-CONFIDENCE WINS (kw conf < 0.8, {len(low_conf_wins)} markets) — lucky?")
        print(f"{'=' * 90}")
        for ticker, pl, c in sorted(low_conf_wins, key=lambda x: x[2]["kw_avg_confidence"]):
            print(f"\n  Ticker: {ticker}  P&L: {fmt_d(pl)}")
            print(f"  Matched keyword: '{c['matched_keyword']}'  kw_conf={c['kw_avg_confidence']}")
            print(f"  DG: {c.get('dg_file','?')}  diff={c.get('dg_diff_secs','?')}s")
            print(f"  Transcript: \"{c['transcript']}\"")
            for w in c.get("kw_word_confs", []):
                print(f"    Word '{w['word']}' confidence={w['confidence']:.4f} @ {w['start']}s")

    # 8. Losers with detail
    if lose_results:
        print(f"\n{'=' * 90}")
        print(f"  ALL LOSERS ({len(lose_results)} markets)")
        print(f"{'=' * 90}")
        for ticker, pl, c in sorted(lose_results, key=lambda x: x[2]["kw_avg_confidence"]):
            print(f"\n  Ticker: {ticker}  Loss: {fmt_d(pl)}")
            print(f"  Matched keyword: '{c['matched_keyword']}'  kw_conf={c['kw_avg_confidence']}")
            print(f"  DG: {c.get('dg_file','?')}  diff={c.get('dg_diff_secs','?')}s")
            print(f"  Transcript: \"{c['transcript']}\"")
            print(f"  All words: {c['word_count']}  avg_conf={c['avg_confidence']}  min_conf={c['min_confidence']}")
            for w in c.get("kw_word_confs", []):
                print(f"    Key word '{w['word']}' confidence={w['confidence']:.4f}")
            # Show low-confidence words in this window
            low_words = [w for w in c.get("all_word_confs", []) if w["confidence"] < 0.5]
            if low_words:
                print(f"    Low-confidence words in window (<0.5):")
                for w in low_words[:5]:
                    print(f"      '{w['word']}' conf={w['confidence']:.4f}")

    print(f"\nDone.")


if __name__ == "__main__":
    main()
