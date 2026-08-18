"""
transcript_fetcher.py — Historical earnings call transcript dataset builder.

Fetches quarterly earnings call transcripts from stockanalysis.com (free,
no login, transcripts sourced from Quartr) and stores them as normalized
JSON in transcripts/{TICKER}/.

Resume state lives in Redis: a hash per ticker at transcripts:index:{TICKER}
mapping transcript URL → {url, call_date, quarter, year, file, status}.
Only entries with status "done" are skipped on re-runs, so a rate-limited
run can be interrupted and resumed without re-fetching. If Redis is down
the fetcher degrades to a no-resume run with a warning.
"""

import json
import logging
import os
import random
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import redis
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("transcript_fetcher")

BASE_URL = "https://stockanalysis.com"
USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

# Retry policy for rate limiting (429) and server errors (5xx).
RETRY_BACKOFF_SECS = [5, 10, 20, 40, 80]
RETRY_JITTER = 0.2  # ±20% random jitter on backoff
COOLDOWN_AFTER_RATE_LIMIT = 60  # pause after repeated 429s

TRANSCRIPTS_DIR = Path(__file__).parent.parent / "transcripts"
DEFAULT_DELAY_SECS = 1.5

# Kalshi company codes that don't match the stockanalysis.com slug (real
# US ticker). Transcripts are fetched via the slug and stored under it;
# load_transcripts() adds code → slug aliases so baseline lookups by Kalshi
# code keep working (e.g. market code "SYUM" resolves to transcripts/YUM/).
KALSHI_CODE_TO_SLUG = {
    "ADOBE": "ADBE",
    "COINBASE": "COIN",
    "DOCUSIGN": "DOCU",
    "DOLLARGENERAL": "DG",
    "LUCID": "LCID",
    "SYUM": "YUM",   # Yum! Brands re-listed under a new series
    "DEER": "DE",    # John Deere re-listed under a new series
    "VSCO": "VSXY",  # Victoria's Secret re-tickered
}

# Kalshi codes with no transcript coverage on stockanalysis.com
# (foreign-listed, no Quartr transcripts): AC, ALIBABA, ARITZIA, BB, NIO,
# RACE, RY, TSMC.

_r: Optional[redis.Redis] = None
_http = requests.Session()
_last_request_ts = 0.0


# ── Redis resume state ──────────────────────────────────────────────────

def get_redis() -> Optional[redis.Redis]:
    global _r
    if _r is None:
        _r = redis.Redis(
            host=os.environ.get("REDIS_HOST", "127.0.0.1"),
            port=int(os.environ.get("REDIS_PORT", "6379")),
            decode_responses=True,
        )
        try:
            _r.ping()
        except Exception as e:
            logger.warning(f"Redis not reachable — resume state disabled: {e}")
            _r = None
    return _r


def _registry_key(ticker: str) -> str:
    return f"transcripts:index:{ticker.upper()}"


def registry_get(ticker: str, url: str) -> Optional[dict]:
    r = get_redis()
    if r is None:
        return None
    raw = r.hget(_registry_key(ticker), url)
    return json.loads(raw) if raw else None


def registry_set(ticker: str, url: str, entry: dict):
    r = get_redis()
    if r is None:
        return
    r.hset(_registry_key(ticker), url, json.dumps(entry))


def registry_all(ticker: str) -> Dict[str, dict]:
    r = get_redis()
    if r is None:
        return {}
    return {k: json.loads(v) for k, v in r.hgetall(_registry_key(ticker)).items()}


# ── HTTP with rate-limit resilience ────────────────────────────────────

def _pace(delay: float):
    """Sleep so that consecutive requests are at least `delay` seconds apart."""
    global _last_request_ts
    now = time.time()
    wait = delay - (now - _last_request_ts)
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.time()


def http_get(url: str, referer: Optional[str] = None, delay: float = DEFAULT_DELAY_SECS) -> requests.Response:
    """GET with exponential backoff + jitter on 429/5xx.

    Returns the last response after retries are exhausted; callers check
    resp.status_code. Raises on network errors that survive all retries.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if referer:
        headers["Referer"] = referer

    last_resp: Optional[requests.Response] = None
    rate_limited_streak = 0

    for attempt in range(len(RETRY_BACKOFF_SECS) + 1):
        _pace(delay)
        try:
            resp = _http.get(url, headers=headers, timeout=30)
        except requests.RequestException as e:
            logger.warning(f"Request error for {url} (attempt {attempt + 1}): {e}")
            if attempt == len(RETRY_BACKOFF_SECS):
                raise
            time.sleep(RETRY_BACKOFF_SECS[attempt] * (1 + random.uniform(-RETRY_JITTER, RETRY_JITTER)))
            continue

        if resp.status_code == 429 or resp.status_code >= 500:
            last_resp = resp
            rate_limited_streak += 1
            if rate_limited_streak >= 3:
                logger.warning(f"Repeated HTTP {resp.status_code} — cooling down {COOLDOWN_AFTER_RATE_LIMIT}s")
                time.sleep(COOLDOWN_AFTER_RATE_LIMIT)
                rate_limited_streak = 0
            if attempt == len(RETRY_BACKOFF_SECS):
                break
            retry_after = resp.headers.get("Retry-After")
            wait = float(retry_after) if retry_after and retry_after.isdigit() else RETRY_BACKOFF_SECS[attempt]
            time.sleep(wait * (1 + random.uniform(-RETRY_JITTER, RETRY_JITTER)))
            continue

        return resp

    return last_resp  # type: ignore[return-value]


# ── Parsing ─────────────────────────────────────────────────────────────

_INDEX_HREF_RE = re.compile(r"/stocks/([^/]+)/transcripts/(\d+)-q(\d+)-(\d{4})/")
_TITLE_QUARTER_RE = re.compile(r"Earnings Call:\s*Q(\d+)\s+(\d{4})", re.IGNORECASE)
_ROLE_RE = re.compile(r"\b([A-Z][A-Za-z.'-]+(?: [A-Z][A-Za-z.'-]+)*) \(([^()]{2,60})\)")
_COMPANY_RE = re.compile(r"^\s*(.*?)\s+\([A-Z.\-]{1,6}\)")
_QUARTER_URL_RE = re.compile(r"q(\d+)-(\d{4})")


def parse_index_html(html: str, ticker: str) -> List[dict]:
    """Extract quarterly earnings call links from a ticker's transcript index.

    Filters out AGMs, conference presentations, investor days, etc.
    """
    soup = BeautifulSoup(html, "html.parser")
    entries: Dict[str, dict] = {}
    for a in soup.find_all("a", href=True):
        title = a.get_text(strip=True)
        if not title.startswith("Earnings Call:"):
            continue
        m = _INDEX_HREF_RE.search(a["href"])
        if not m or m.group(1).lower() != ticker.lower():
            continue
        qm = _TITLE_QUARTER_RE.match(title)
        quarter = int(qm.group(1)) if qm else int(m.group(3))
        year = int(qm.group(2)) if qm else int(m.group(4))
        href = a["href"]
        url = href if href.startswith("http") else BASE_URL + href
        entries.setdefault(url, {"url": url, "quarter": quarter, "year": year})
    return list(entries.values())


def _parse_call_date(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    for fmt in ("%B %d, %Y", "%b %d, %Y", "%d %B %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _to_float(val) -> Optional[float]:
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def parse_transcript_html(html: str, url: str, ticker: str) -> dict:
    """Parse a stockanalysis.com transcript page into the normalized format."""
    soup = BeautifulSoup(html, "html.parser")

    # Call date: the <p> next to the <h1>
    call_date = None
    h1 = soup.find("h1")
    if h1:
        date_p = h1.find_parent().find(
            "p", class_=lambda c: c and "faded" in c
        ) if h1.find_parent() else None
        if date_p:
            call_date = _parse_call_date(date_p.get_text(strip=True))

    # Speaker roles from meta description: "Aman Narang (CEO), Elena Gomez (President and CFO)"
    roles: Dict[str, str] = {}
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        for name, role in _ROLE_RE.findall(meta["content"]):
            # skip "Toast (TOST)" style ticker annotations
            if role.strip().upper() == ticker.upper():
                continue
            roles[name.strip()] = role.strip()

    # Company name from <title> "Toast (TOST) Q1 2026 Earnings Call Transcript & Audio"
    company = None
    title_tag = soup.find("title")
    if title_tag:
        cm = _COMPANY_RE.match(title_tag.get_text() or "")
        if cm:
            company = cm.group(1).strip()

    # Utterances: speaker blocks inside the full-transcript container
    container = soup.find("div", attrs={"role": "article", "aria-label": "Full transcript"})
    if container is None:
        container = soup.find("div", attrs={"role": "region", "aria-label": "Full transcript"})

    utterances = []
    if container is not None:
        for block in container.find_all("div", recursive=False):
            classes = block.get("class") or []
            if not any("border-t" in c for c in classes):
                continue
            speaker_div = block.find("div", class_=lambda c: c and "font-bold" in c)
            speaker = speaker_div.get_text(strip=True) if speaker_div else ""
            sentences = block.find_all("span", class_="transcript-sentence")
            if sentences:
                text = " ".join(s.get_text(" ", strip=True) for s in sentences)
            else:
                p = block.find("p")
                text = p.get_text(" ", strip=True) if p else ""
            text = re.sub(r"\s+", " ", text).strip()
            if not text:
                continue
            utterances.append({
                "speaker": speaker,
                "text": text,
                "start_sec": _to_float(sentences[0].get("data-start-sec")) if sentences else None,
                "end_sec": _to_float(sentences[-1].get("data-end-sec")) if sentences else None,
            })

    qm = _QUARTER_URL_RE.search(url)
    return {
        "ticker": ticker.upper(),
        "company": company,
        "call_date": call_date,
        "fiscal_quarter": int(qm.group(1)) if qm else None,
        "fiscal_year": int(qm.group(2)) if qm else None,
        "url": url,
        "source": "stockanalysis.com",
        "roles": roles,
        "utterances": utterances,
    }


# ── Dataset ─────────────────────────────────────────────────────────────

def save_transcript(parsed: dict, ticker: str) -> str:
    d = TRANSCRIPTS_DIR / ticker.upper()
    d.mkdir(parents=True, exist_ok=True)
    call_date = parsed.get("call_date") or "unknown"
    q = parsed.get("fiscal_quarter") or 0
    y = parsed.get("fiscal_year") or 0
    fname = f"{ticker.upper()}-{call_date}-q{q}-{y}.json"
    path = d / fname
    path.write_text(json.dumps(parsed, indent=2) + "\n")
    return path.name


def fetch_ticker(
    ticker: str,
    quarters: int = 8,
    force: bool = False,
    delay: float = DEFAULT_DELAY_SECS,
    slug: Optional[str] = None,
) -> dict:
    """Fetch the most recent N quarterly transcripts for a ticker.

    `slug` overrides the stockanalysis.com path component when the Kalshi
    code differs from the real ticker (see KALSHI_CODE_TO_SLUG). Registry
    state and saved files are keyed by the slug so both the code and the
    underlying ticker share one copy.

    Returns a summary dict with status:
      "done" | "no_coverage" | "error"
    """
    ticker = ticker.upper()
    slug = (slug or ticker).lower()
    index_url = f"{BASE_URL}/stocks/{slug}/transcripts/"
    summary = {
        "ticker": ticker,
        "status": "done",
        "index_url": index_url,
        "available": 0,
        "fetched": 0,
        "skipped": 0,
        "failed": 0,
        "errors": [],
        "files": [],
    }

    resp = http_get(index_url, delay=delay)
    if resp.status_code == 404:
        summary["status"] = "no_coverage"
        summary["errors"].append(f"no transcript index page (HTTP 404)")
        return summary
    if resp.status_code != 200:
        summary["status"] = "error"
        summary["errors"].append(f"index fetch failed (HTTP {resp.status_code})")
        return summary

    entries = parse_index_html(resp.text, slug)
    summary["available"] = len(entries)
    if not entries:
        summary["status"] = "no_coverage"
        summary["errors"].append("index page has no quarterly earnings call transcripts")
        return summary

    entries.sort(key=lambda e: (e["year"], e["quarter"]), reverse=True)
    entries = entries[:quarters]

    for entry in entries:
        url = entry["url"]
        if not force:
            prev = registry_get(slug, url)
            if prev and prev.get("status") == "done":
                summary["skipped"] += 1
                continue

        parsed, err = None, None
        resp = http_get(url, referer=index_url, delay=delay)
        if resp.status_code == 429:
            err = "rate_limited"
        elif resp.status_code != 200:
            err = f"http_{resp.status_code}"
        else:
            parsed = parse_transcript_html(resp.text, url, slug)

        if err is not None:
            summary["failed"] += 1
            summary["errors"].append(f"{url}: {err}")
            registry_set(slug, url, {
                "url": url,
                "quarter": entry["quarter"],
                "year": entry["year"],
                "file": None,
                "status": "error",
                "error": err,
            })
            continue

        fname = save_transcript(parsed, slug)
        summary["fetched"] += 1
        summary["files"].append(fname)
        registry_set(slug, url, {
            "url": url,
            "quarter": entry["quarter"],
            "year": entry["year"],
            "call_date": parsed.get("call_date"),
            "file": fname,
            "status": "done",
        })

    return summary


# ── Ticker derivation from Kalshi market data ──────────────────────────

_LEG_PREFIX = "KXEARNINGSMENTION"


def ticker_from_leg(leg: str) -> Optional[str]:
    """Extract the company code from a Kalshi keyword leg ticker.

    e.g. "KXEARNINGSMENTIONSPOT-26AUG04-RETA" → "SPOT"
    """
    head = leg.split("-", 1)[0]
    if head.startswith(_LEG_PREFIX):
        code = head[len(_LEG_PREFIX):]
        return code if code else None
    return None


_MARKET_CACHE_FILES = [
    "cache/matched_markets.json",
    "cache/earnings_calls_with_source.json",
    "cache/latest_markets.json",
]


def tickers_from_markets() -> List[str]:
    """Collect company codes from cached Kalshi earnings markets."""
    tickers: List[str] = []
    for rel in _MARKET_CACHE_FILES:
        path = Path(__file__).parent.parent / rel
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        for market in data:
            for leg in (market.get("keywords") or {}).values():
                t = ticker_from_leg(leg)
                if t and t not in tickers:
                    tickers.append(t)
    return tickers


# ── Watchlist universe ───────────────────────────────────────────────────

SP500_URL = BASE_URL + "/list/sp-500-stocks/"


def sp500_tickers(delay: float = DEFAULT_DELAY_SECS) -> List[str]:
    """S&P 500 constituent tickers from stockanalysis.com (broad universe to
    scrape ahead of Kalshi listings)."""
    resp = http_get(SP500_URL, delay=delay)
    if resp.status_code != 200:
        raise RuntimeError(f"S&P 500 list fetch failed (HTTP {resp.status_code})")
    soup = BeautifulSoup(resp.text, "html.parser")
    tickers = []
    for a in soup.find_all("a", href=True):
        m = re.match(r"/stocks/([a-z.\-]+)/$", a["href"])
        if m:
            tickers.append(m.group(1).upper())
    return sorted(set(tickers))
