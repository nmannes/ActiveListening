"""identity_photos.py — best-effort photo URL lookup for a person name.

Telegram fetches photo URLs itself (sendPhoto accepts a URL), so this module
only ever resolves a URL — no downloads, no cache directory.  Sources in
order: Wikipedia REST summary → Wikipedia search + pageimages → DuckDuckGo
image results.  Every failure mode degrades to None so the caller can send
the ask without a photo.
"""

import logging
import re
import time
from urllib.parse import quote

import requests

logger = logging.getLogger("remote_server")

_UA = {
    "User-Agent": "kalshi-speaker-ask/1.0 (operator tooling; contact: nathan)",
    "Referer": "https://duckduckgo.com/",
}
_TIMEOUT = 8
_CACHE_TTL_SECS = 6 * 3600
_CACHE_MAX = 256
# name (lowercased) -> (url | None, fetched_at)
_cache: dict = {}


def _get_json(url, params=None):
    try:
        resp = requests.get(url, params=params, headers=_UA, timeout=_TIMEOUT)
        if resp.status_code != 200:
            return None
        return resp.json()
    except Exception as e:
        logger.debug(f"[photos] request failed ({url}): {e}")
        return None


def _wikipedia_summary(name):
    """REST summary endpoint — the page's lead image, if any."""
    title = quote(name.strip().replace(" ", "_"))
    data = _get_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}")
    if not data:
        return None
    return (data.get("thumbnail") or {}).get("source") or (
        (data.get("originalimage") or {}).get("source")
    )


def _wikipedia_search(name):
    """Full-text search + pageimages — catches names without exact pages."""
    data = _get_json(
        "https://en.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": name,
            "gsrlimit": 1,
            "prop": "pageimages",
            "piprop": "thumbnail",
            "pithumbsize": 400,
        },
    )
    pages = ((data or {}).get("query") or {}).get("pages") or {}
    for page in pages.values():
        thumb = (page.get("thumbnail") or {}).get("source")
        if thumb:
            return thumb
    return None


def _ddg_image(name):
    """DuckDuckGo image results (needs a vqd token scraped from the HTML)."""
    try:
        html = requests.get(
            "https://duckduckgo.com/",
            params={"q": name, "iax": "images", "ia": "images"},
            headers=_UA,
            timeout=_TIMEOUT,
        ).text
        match = re.search(r'vqd=["\']?([\w-]+)', html)
        if not match:
            return None
        data = _get_json(
            "https://duckduckgo.com/i.js",
            params={
                "l": "us-en",
                "o": "json",
                "q": name,
                "vqd": match.group(1),
                "f": ",,,",
                "p": "1",
            },
        )
        results = (data or {}).get("results") or []
        if results:
            return results[0].get("image")
    except Exception as e:
        logger.debug(f"[photos] DDG lookup failed for {name!r}: {e}")
    return None


def get_photo_url(name):
    """Best-effort photo URL for *name*, or None.  Cached; never raises."""
    key = name.strip().lower()
    now = time.time()
    hit = _cache.get(key)
    if hit and now - hit[1] < _CACHE_TTL_SECS:
        return hit[0]

    url = None
    for finder in (_wikipedia_summary, _wikipedia_search, _ddg_image):
        try:
            url = finder(name)
        except Exception:
            logger.debug(f"[photos] {finder.__name__} raised for {name!r}", exc_info=True)
            url = None
        if url:
            break

    if len(_cache) >= _CACHE_MAX:
        oldest = min(_cache, key=lambda k: _cache[k][1])
        _cache.pop(oldest, None)
    _cache[key] = (url, now)

    if url:
        logger.info(f"[photos] {name!r} -> {url}")
    else:
        logger.info(f"[photos] no photo found for {name!r}")
    return url
