#!/usr/bin/env python
"""
analyze_earnings_predictability.py — Predict candidate words for upcoming
earnings-mention markets using Kalshi's own resolved history.

Ground truth: data/earnings_mentions.jsonl (from fetch_earnings_mentions.py)
— every finalized yes/no market for settled earnings calls. Candidate words:
cache/latest_markets.json keyword legs.

Reports three things:
  1. Transition stats across ALL settled calls: P(word resolves YES on a
     call | the same word resolved YES on the company's previous call).
  2. Per-candidate-word history for each current market, using only
     resolutions from EARLIER calls (call_date < the market's event date).
     Markets whose own event is already settled are flagged as such — their
     resolutions are the answers, not history.
  3. Transcript cross-validation: for settled events with a transcript in
     transcripts/{TICKER}/, check each resolved word against the transcript
     text (word-boundary matching) and report Kalshi↔transcript agreement.

Usage:
    PYTHONPATH=. python scripts/analyze_earnings_predictability.py
"""

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).parent.parent
MENTIONS = ROOT / "data" / "earnings_mentions.jsonl"
MARKETS = ROOT / "cache" / "latest_markets.json"

_WORD_SPLIT_RE = re.compile(r"\s*/\s*")


def word_variants(word: str) -> list:
    return [v.strip() for v in _WORD_SPLIT_RE.split(word) if v.strip()]


def normalize(w: str) -> str:
    return w.lower().replace("’", "'")


def load_rows():
    rows = [json.loads(l) for l in MENTIONS.open()]
    rows.sort(key=lambda r: r["call_date"] or "")
    return rows


def build_history(rows) -> dict:
    """(company_code, synonym) -> list of (call_date, result), chronological."""
    hist = defaultdict(list)
    for r in rows:
        code = r["series_ticker"].replace("KXEARNINGSMENTION", "")
        for m in r["markets"]:
            if m.get("result") and m.get("word"):
                for v in word_variants(m["word"]):
                    hist[(code, normalize(v))].append((r["call_date"], m["result"]))
    return hist


def lookup_history(hist, code, word) -> list:
    out = []
    for v in word_variants(word):
        out.extend(hist.get((code, normalize(v)), []))
    out.sort(key=lambda x: x[0])
    return out


# ── 1. Transition stats over all settled calls ─────────────────────────

def transition_stats(rows):
    by_word = defaultdict(list)
    for r in rows:
        code = r["series_ticker"].replace("KXEARNINGSMENTION", "")
        for m in r["markets"]:
            if m.get("result") and m.get("word"):
                by_word[(code, normalize(m["word"]))].append(m["result"])

    yes_after_yes = yes_after_no = tot_yes = tot_no = 0
    n_series = 0
    for (code, word), res in by_word.items():
        if len(res) >= 2:
            n_series += 1
        for prev, nxt in zip(res, res[1:]):
            if prev == "yes":
                tot_yes += 1
                if nxt == "yes":
                    yes_after_yes += 1
            else:
                tot_no += 1
                if nxt == "yes":
                    yes_after_no += 1
    return {
        "series": n_series,
        "tot_yes": tot_yes, "tot_no": tot_no,
        "yes_after_yes": yes_after_yes, "yes_after_no": yes_after_no,
        "p_yes_after_yes": yes_after_yes / tot_yes if tot_yes else None,
        "p_yes_after_no": yes_after_no / tot_no if tot_no else None,
    }


# ── 2. Current-market candidate word lookup ────────────────────────────

def market_company(slug: str):
    head = slug.split("-")[0]
    if not head.startswith("kxearningsmention"):
        return None
    return head[len("kxearningsmention"):].upper()


def current_market_report(hist, rows):
    markets = json.loads(MARKETS.read_text())
    by_ticker = {}
    for r in rows:
        by_ticker.setdefault(r["event_ticker"], r)

    print("\n== Current market candidate words vs Kalshi history ==")
    print(f"{'company':7s} {'candidate word':26s} {'hist':>4s} {'P(yes)':>7s} {'last':>6s}  note")
    print("-" * 96)
    n_words = n_with_hist = n_settled = 0
    for m in markets:
        code = market_company(m["slug"])
        if code is None:
            continue
        ev = by_ticker.get(m["slug"].upper())
        ev_date = ev["call_date"] if ev else m["slug"].split("-")[-1]
        settled_own = ev and any(x.get("result") for x in ev["markets"])
        for word in (m.get("keywords") or {}).keys():
            n_words += 1
            # history = resolutions from EARLIER calls only
            h = [x for x in lookup_history(hist, code, word) if x[0] < ev_date]
            if settled_own:
                n_settled += 1
                note = "ALREADY SETTLED (answer, not history)"
            else:
                note = ""
            if h or settled_own:
                pct = f"{100*sum(1 for _, r in h if r=='yes')/len(h):.0f}%" if h else "-"
                last = h[-1][1] if h else "-"
                print(f"{code:7s} {word[:26]:26s} {len(h):>4d} {pct:>7s} {last:>6s}  {note}")
            if h:
                n_with_hist += 1
    print("-" * 96)
    print(f"{n_words} candidate words; {n_with_hist} with prior-call Kalshi history; "
          f"{n_settled} in already-settled current events")


# ── 3. Transcript cross-validation ─────────────────────────────────────

def word_in_text(word: str, text: str) -> bool:
    """Match any synonym variant, including plural/possessive forms.

    Mirrors Kalshi's resolution rule: resolves YES for the exact word or
    its plural/possessive form (e.g. "Message" matches "Messages").
    """
    t = text.lower().replace("’", "'")
    for v in word_variants(word):
        base = normalize(v)
        for form in (base, base + "s", base + "es", base + "'s", base + "s'", base + "es'"):
            esc = re.escape(form)
            if re.search(rf"(?<![a-z0-9]){esc}(?![a-z0-9])", t):
                return True
    return False


def transcript_validation(rows):
    print("\n== Transcript cross-validation (Kalshi resolutions vs our transcripts) ==")
    per_ticker = defaultdict(list)
    for r in rows:
        per_ticker[r["series_ticker"].replace("KXEARNINGSMENTION", "")].append(r)

    total = correct = 0
    for ticker, evs in sorted(per_ticker.items()):
        tdir = ROOT / "transcripts" / ticker
        if not tdir.is_dir():
            continue
        for ev in evs:
            nres = sum(1 for m in ev["markets"] if m.get("result"))
            if not nres:
                continue
            # find CLOSEST transcript within ±45 days (Kalshi event dates are
            # listing dates and can lag the actual call by weeks)
            ev_date = __import__("datetime").date.fromisoformat(ev["call_date"])
            best = None
            for f in tdir.glob("*.json"):
                d = json.loads(f.read_text())
                cd = d.get("call_date")
                if not cd:
                    continue
                gap = abs(__import__("datetime").date.fromisoformat(cd) - ev_date).days
                if gap <= 45 and (best is None or gap < best[0]):
                    best = (gap, d)
            trans = best[1] if best else None
            if trans is None:
                print(f"{ticker:5s} {ev['call_date']}: {nres} resolutions, no matching transcript")
                continue
            text = " ".join(u["text"] for u in trans["utterances"])
            ok = 0
            for m in ev["markets"]:
                if not m.get("result"):
                    continue
                total += 1
                present = word_in_text(m["word"], text)
                if (m["result"] == "yes") == present:
                    ok += 1
                else:
                    print(f"  MISMATCH {ticker} {m['word']!r}: Kalshi={m['result']} transcript={'found' if present else 'absent'}")
            correct += ok
            print(f"{ticker:5s} {ev['call_date']}: {ok}/{nres} resolutions match transcript")
    if total:
        print(f"overall agreement: {correct}/{total} ({100*correct/total:.0f}%)")


# ── 4. Transcript-based transition stats (repeat-call predictability) ──

def transcript_transitions():
    """P(current candidate word in call N+1 | in call N) across our dataset.

    Kalshi has only one settled call per company so far, so the repeat-call
    signal must come from transcripts: for each candidate word of each
    current market, check presence in every past transcript of that company
    and count consecutive-call transitions.
    """
    markets = json.loads(MARKETS.read_text())
    print("\n== Transcript transition stats (current candidate words over past calls) ==")
    n_words = n_series = tot_yes = tot_no = yes_after_yes = yes_after_no = 0
    per_word = []
    for m in markets:
        code = market_company(m["slug"])
        if code is None:
            continue
        tdir = ROOT / "transcripts" / code
        if not tdir.is_dir():
            continue
        docs = []
        for f in tdir.glob("*.json"):
            d = json.loads(f.read_text())
            if d.get("call_date"):
                docs.append(d)
        docs.sort(key=lambda d: d["call_date"])
        if len(docs) < 2:
            continue
        text_by_date = [
            (d["call_date"], " ".join(u["text"] for u in d["utterances"]))
            for d in docs
        ]
        for word in (m.get("keywords") or {}).keys():
            n_words += 1
            present = [word_in_text(word, text) for _, text in text_by_date]
            n_series += sum(1 for a, b in zip(present, present[1:]) if a and b)
            for a, b in zip(present, present[1:]):
                if a:
                    tot_yes += 1
                    yes_after_yes += b
                else:
                    tot_no += 1
                    yes_after_no += b
            if sum(present) > 0:
                per_word.append((code, word, sum(present), len(present),
                                 sum(present) / len(present), present[-1]))

    print(f"candidate words checked: {n_words}  (companies with >=2 transcripts)")
    print(f"transitions: {tot_yes + tot_no}")
    if tot_yes:
        print(f"P(word said this call | said last call) = {yes_after_yes}/{tot_yes} "
              f"= {100*yes_after_yes/tot_yes:.1f}%")
        print(f"P(word said this call | not said last call) = {yes_after_no}/{tot_no} "
              f"= {100*yes_after_no/tot_no:.1f}%")
        base = (yes_after_yes + yes_after_no) / (tot_yes + tot_no)
        lift = (yes_after_yes / tot_yes) / (yes_after_no / tot_no) if yes_after_no else float("inf")
        print(f"base rate = {100*base:.1f}%   relative lift = {lift:.2f}x")

    print("\nper-company candidates with any past-call presence "
          "(count / calls, last-call status):")
    by_co = defaultdict(list)
    for code, word, cnt, n, rate, last in per_word:
        by_co[code].append((word, cnt, n, last))
    for code in sorted(by_co):
        parts = []
        for word, cnt, n, last in sorted(by_co[code], key=lambda x: -x[1]):
            mark = " (LAST CALL)" if last else ""
            parts.append(f"{word} {cnt}/{n}{mark}")
        print(f"  {code}: " + ", ".join(parts))


def main():
    rows = load_rows()
    hist = build_history(rows)

    ts = transition_stats(rows)
    print("== Transition stats (Kalshi resolutions, all settled calls) ==")
    print(f"word series with >=2 calls: {ts['series']}")
    if ts["p_yes_after_yes"] is not None:
        print(f"P(YES this call | YES prev call) = {ts['yes_after_yes']}/{ts['tot_yes']} "
              f"= {100*ts['p_yes_after_yes']:.1f}%")
        print(f"P(YES this call | NO  prev call) = {ts['yes_after_no']}/{ts['tot_no']} "
              f"= {100*ts['p_yes_after_no']:.1f}%")
        base = (ts["yes_after_yes"] + ts["yes_after_no"]) / (ts["tot_yes"] + ts["tot_no"])
        print(f"base rate = {100*base:.1f}%")
        print(f"lift = {ts['p_yes_after_yes'] / base:.2f}x")
    else:
        print("no word repeats across settled calls yet (product launched ~2026-04, "
              "one settled call per company so far)")

    current_market_report(hist, rows)
    transcript_validation(rows)
    transcript_transitions()


if __name__ == "__main__":
    main()
