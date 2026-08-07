#!/usr/bin/env python
"""
generate_earnings_report.py — Build the human-readable earnings report
(earnings-report-report.md) for upcoming Kalshi word markets.

For each currently-listed earnings-mention word market (from the market
caches) the report shows:
  - how likely the word is based on prior earnings call transcripts
    (baseline P; "-" where no transcript history exists)
  - how likely the market thinks it is (last traded YES price)
  - the gap between the two, sorted as opportunities

Usage:
    PYTHONPATH=. python scripts/generate_earnings_report.py
"""

import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Dict, List, Optional, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.earnings_word_stats import (  # noqa: E402
    baseline_probability,
    normalize,
    word_in_calls,
    word_in_text,
    word_variants,
)
from pylib.transcript_fetcher import ticker_from_leg  # noqa: E402
from scripts.fetch_earnings_mentions import api_get  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPTS_DIR = ROOT / "transcripts"
OUT_FILE = ROOT / "earnings-report-report.md"

_MARKET_CACHE_FILES = [
    "cache/latest_markets.json",
    "cache/matched_markets.json",
    "cache/earnings_calls_with_source.json",
]

YES_AFTER_YES = 0.67
YES_AFTER_NO = 0.243

_MONTHS = {m: i + 1 for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}
_EVENT_DATE_RE = re.compile(r"KXEARNINGSMENTION[A-Z]+-(\d{2})([A-Z]{3})(\d{2})-")
_TITLE_COMPANY_RE = re.compile(r"^What will (.*?) say during their next earnings call\??$")


# ── Upcoming markets (targets) ─────────────────────────────────────────

def event_date_from_leg(leg: str) -> Optional[str]:
    """KXEARNINGSMENTIONNBIS-26AUG06-VERA → '2026-08-06' (YYMMMDD)."""
    m = _EVENT_DATE_RE.search(leg)
    if not m:
        return None
    try:
        return date(2000 + int(m.group(1)), _MONTHS[m.group(2)], int(m.group(3))).isoformat()
    except (KeyError, ValueError):
        return None


def upcoming_markets() -> Dict[str, dict]:
    """Earnings company → {words, title, event_date} from the market caches.

    Only earnings-mention markets count (non-earnings "what will X say"
    markets, e.g. news hosts, are filtered by the leg ticker prefix).
    """
    out: Dict[str, dict] = {}
    for rel in _MARKET_CACHE_FILES:
        path = ROOT / rel
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        for market in data:
            keywords = market.get("keywords") or {}
            if not keywords:
                continue
            legs = list(keywords.values())
            code = ticker_from_leg(legs[0])
            if not code:
                continue
            entry = out.setdefault(code, {
                "words": set(), "title": market.get("title"), "event_date": None})
            entry["words"].update(keywords)
            for leg in legs:
                d = event_date_from_leg(leg)
                if d and (not entry["event_date"] or d > entry["event_date"]):
                    entry["event_date"] = d
    for entry in out.values():
        entry["words"] = sorted(entry["words"])
    return out


# ── Transcripts ─────────────────────────────────────────────────────────

def load_transcripts() -> Dict[str, List[dict]]:
    """Ticker → transcripts sorted by call date (oldest first)."""
    out = {}
    if not TRANSCRIPTS_DIR.is_dir():
        return out
    for tdir in sorted(TRANSCRIPTS_DIR.iterdir()):
        if not tdir.is_dir():
            continue
        docs = []
        for f in tdir.glob("*.json"):
            try:
                d = json.loads(f.read_text())
            except (json.JSONDecodeError, OSError):
                continue
            if d.get("call_date"):
                docs.append(d)
        docs.sort(key=lambda d: d["call_date"])
        if docs:
            out[tdir.name.upper()] = docs
    return out


def transcript_text(d: dict) -> str:
    return " ".join(u.get("text", "") for u in d.get("utterances", []))


def aggregate_transitions(docs_by_ticker: Dict[str, List[dict]],
                          words_by_ticker: Dict[str, List[str]]) -> dict:
    """P(word in call N+1 | in call N) across all upcoming words and companies."""
    tot_yes = tot_no = yes_after_yes = yes_after_no = 0
    for code, docs in docs_by_ticker.items():
        texts = [transcript_text(d) for d in docs]
        for word in words_by_ticker.get(code, []):
            present = [word_in_text(word, t) for t in texts]
            for a, b in zip(present, present[1:]):
                if a:
                    tot_yes += 1
                    yes_after_yes += b
                else:
                    tot_no += 1
                    yes_after_no += b
    n = tot_yes + tot_no
    return {
        "tot_yes": tot_yes, "tot_no": tot_no,
        "yes_after_yes": yes_after_yes, "yes_after_no": yes_after_no,
        "p_yes_after_yes": yes_after_yes / tot_yes if tot_yes else None,
        "p_yes_after_no": yes_after_no / tot_no if tot_no else None,
        "base_rate": (yes_after_yes + yes_after_no) / n if n else None,
    }


# ── Live prices ─────────────────────────────────────────────────────────

def fetch_live_prices(codes: List[str]) -> Dict[str, Dict[str, tuple]]:
    """Company → normalized word → (yes_last, no_last) for currently open markets.

    Kalshi returns one market object per word carrying the whole YES/NO
    pair; the NO side is the complement (the pair always sums to $1.00).
    Only active (unsettled) markets count — settled markets are the answer,
    not odds. Returns {} for a company with no open markets or on API errors.
    """
    out: Dict[str, Dict[str, tuple]] = {}
    for code in codes:
        try:
            data = api_get(f"markets?series_ticker=KXEARNINGSMENTION{code}&limit=200")
        except Exception:
            continue
        for m in data.get("markets") or []:
            if m.get("status") != "active":
                continue
            raw = m.get("last_price_dollars")
            if raw is None:
                continue
            try:
                yes = float(raw)
            except (TypeError, ValueError):
                continue
            word = (m.get("custom_strike") or {}).get("Word")
            if not word:
                continue
            for v in word_variants(word):
                out.setdefault(code, {})[normalize(v)] = (yes, round(1.0 - yes, 2))
    return out


# ── Rendering ───────────────────────────────────────────────────────────

def verdict(p: Optional[float]) -> str:
    if p is None:
        return "-"
    if p >= 0.6:
        return "Strong YES"
    if p >= 0.45:
        return "Likely YES"
    if p >= 0.3:
        return "Coin flip"
    return "Unlikely"


def fmt_price(dollars) -> str:
    return f"${dollars:.2f}" if dollars is not None else "-"


def word_prices(word: str, prices: Dict[str, tuple]):
    for v in word_variants(word):
        if normalize(v) in prices:
            return prices[normalize(v)]
    return None, None


def company_name(code: str, entry: dict, docs: List[dict]) -> str:
    if docs:
        return docs[-1].get("company") or code
    m = _TITLE_COMPANY_RE.match(entry.get("title") or "")
    return m.group(1) if m else code


def word_baseline(word: str, docs: List[dict]):
    """(present_in, n_prior, said_last, p) from transcript evidence, or Nones."""
    if not docs:
        return None, None, None, None
    n_prior = len(docs) - 1
    earlier_texts = [transcript_text(d) for d in docs[:-1]]
    present_in = word_in_calls(word, earlier_texts)
    said_last = word_in_text(word, transcript_text(docs[-1]))
    p = baseline_probability(present_in, n_prior, said_last, YES_AFTER_YES, YES_AFTER_NO)
    return present_in, n_prior, said_last, p


def render_opportunities(upcoming: Dict[str, dict], docs_by_ticker: Dict[str, List[dict]],
                         live: Dict[str, Dict[str, tuple]]) -> List[str]:
    rows = []
    for code in sorted(upcoming):
        for word in upcoming[code]["words"]:
            _, _, _, p = word_baseline(word, docs_by_ticker.get(code, []))
            yes_px, _ = word_prices(word, live.get(code, {}))
            if p is not None and yes_px is not None:
                rows.append((code, word, p, yes_px, p - yes_px))
    if not rows:
        return []
    rows.sort(key=lambda r: -abs(r[4]))
    lines = ["## Opportunities (prior data vs market)",
             "",
             "Sorted by |gap| — a positive gap means prior data says the word is "
             "more likely than the market prices it.",
             "",
             "| Company | Word | Baseline P | Market YES | Gap |",
             "|---|---|---|---|---|"]
    for code, word, p, yes_px, gap in rows:
        lines.append(f"| {code} | {word} | {100 * p:.0f}% | {fmt_price(yes_px)} | "
                     f"{100 * gap:+.0f} |")
    lines.append("")
    return lines


def render_company(code: str, entry: dict, docs: List[dict],
                   prices: Dict[str, tuple]) -> List[str]:
    lines = [f"## {company_name(code, entry, docs)} ({code})"]
    if entry.get("event_date"):
        lines.append(f"**Upcoming event:** {entry['event_date']}")
    if not docs:
        lines.append("*No transcript history — baseline unavailable. "
                     "Run `./bin/kalshi transcripts --from-markets` to fill it in.*")

    lines += ["",
              "| Word | Prior calls | Baseline P | Last YES | Verdict |",
              "|---|---|---|---|---|"]
    for word in entry["words"]:
        present_in, n_prior, _, p = word_baseline(word, docs)
        prior_calls = f"{present_in}/{n_prior}" if n_prior else "-"
        yes_px, _ = word_prices(word, prices)
        pct = f"{100 * p:.0f}%" if p is not None else "-"
        lines.append(f"| {word} | {prior_calls} | {pct} | {fmt_price(yes_px)} | "
                     f"**{verdict(p)}** |")
    lines += ["", "---", ""]
    return lines


def build_report() -> Tuple[str, Dict[str, dict], Dict[str, List[dict]], Dict[str, dict]]:
    upcoming = upcoming_markets()
    docs_by_ticker = load_transcripts()
    live = fetch_live_prices(sorted(upcoming))
    words_by_ticker = {code: e["words"] for code, e in upcoming.items()}
    trans = aggregate_transitions(docs_by_ticker, words_by_ticker)

    n_transcripts = sum(len(v) for v in docs_by_ticker.values())
    n_with_history = sum(1 for c in upcoming if c in docs_by_ticker)
    n_words = sum(len(e["words"]) for e in upcoming.values())

    lines = ["# Earnings Report",
             "",
             f"Generated {date.today().isoformat()} · {len(upcoming)} companies with "
             f"upcoming word markets · {n_words} words",
             "",
             "## Method",
             "",
             "Targets are the words in currently open Kalshi earnings-mention "
             "markets (from the market caches). Word matching follows Kalshi's "
             "resolution rules (word boundaries, plural/possessive forms).",
             ""]
    if trans["tot_yes"]:
        lines += [
            f"- Aggregate transitions over all upcoming words: "
            f"P(word said | said last call) = {trans['yes_after_yes']}/{trans['tot_yes']} "
            f"= {100 * trans['p_yes_after_yes']:.1f}% vs P(said | not said last call) = "
            f"{trans['yes_after_no']}/{trans['tot_no']} = {100 * trans['p_yes_after_no']:.1f}% "
            f"(base rate {100 * trans['base_rate']:.1f}%)",
            "- Baseline P blends the aggregate transition rate with the word's "
            "own presence rate (Laplace-smoothed); per-word evidence dominates "
            "as call history grows",
        ]
    lines += [
        "- Baseline P: from prior earnings call transcripts "
        "(`transcripts/{TICKER}/`); '-' = no transcript history for the company",
        "- Last YES: last traded price for the word's currently open market "
        "(Kalshi API, active markets only; the NO side is the pair complement "
        "and always sums to $1.00). '-' = no open market or fetch failed",
        "- Verdict tiers: Strong YES (P ≥ 60%), Likely YES (45–60%), "
        "Coin flip (30–45%), Unlikely (<30%)",
        "",
    ]
    if n_with_history < len(upcoming):
        lines += [
            f"**{len(upcoming) - n_with_history} of {len(upcoming)} companies lack "
            "transcript history** — run `./bin/kalshi transcripts --from-markets` "
            "to fill baselines.",
            "",
        ]

    lines += render_opportunities(upcoming, docs_by_ticker, live)

    for code in sorted(upcoming):
        lines += render_company(code, upcoming[code], docs_by_ticker.get(code, []),
                                live.get(code, {}))

    return "\n".join(lines).rstrip() + "\n", upcoming, docs_by_ticker, live


def main():
    text, upcoming, docs_by_ticker, live = build_report()
    OUT_FILE.write_text(text)
    n_with_history = sum(1 for c in upcoming if c in docs_by_ticker)
    missing = sorted(c for c in upcoming if c not in docs_by_ticker)
    n_live = sum(1 for v in live.values() if v)
    print(f"Wrote {OUT_FILE}")
    print(f"{len(upcoming)} companies with upcoming markets, "
          f"{sum(len(e['words']) for e in upcoming.values())} words, "
          f"{n_live} companies with live prices, "
          f"{n_with_history} with transcript history")
    if missing:
        print(f"No transcript history for: {', '.join(missing)} — "
              f"run `./bin/kalshi transcripts --from-markets`")


if __name__ == "__main__":
    main()
