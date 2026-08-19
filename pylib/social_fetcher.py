"""
social_fetcher.py — Full post history for a person from social platforms.

Currently X/Twitter via twscrape (drives X's internal GraphQL search with a
normal account session — no API key). Paginating search (`from:<handle>`)
covers an account's FULL history back to 2006; profile timelines cap at
~3,200 posts, the search index doesn't.

Posts cache as JSONL at social/<handle>.jsonl, one post per line:
{"id", "created_at", "text", "is_retweet", "is_quote", "quoted_tweet_id",
 "reply_to_id", "lang", "like_count", "reply_count", "retweet_count", "url"}

Resumable: existing ids are skipped on re-runs (a re-run re-paginates from the
top but never writes duplicate rows).

Platform backends register in PLATFORMS and share the JSONL layout, so Threads
and Instagram can slot in behind the same interface later.
"""

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Set

ROOT = Path(__file__).resolve().parent.parent
SOCIAL_DIR = ROOT / "social"

X_PLATFORM = "x"


def post_path(handle: str, platform: str = X_PLATFORM) -> Path:
    return SOCIAL_DIR / f"{platform}-{handle.lower()}.jsonl"


def load_post_ids(path: Path) -> Set[str]:
    """Ids already on disk — used to skip duplicates on re-runs."""
    if not path.exists():
        return set()
    ids = set()
    with path.open() as f:
        for line in f:
            if line.strip():
                try:
                    ids.add(json.loads(line)["id"])
                except (json.JSONDecodeError, KeyError):
                    continue
    return ids


def append_post(path: Path, post: Dict) -> None:
    with path.open("a") as f:
        f.write(json.dumps(post) + "\n")
        f.flush()


def _tweet_row(t) -> Dict:
    """twscrape Tweet → shared JSONL row layout."""
    reply_to = getattr(t, "replyTo", None) or []
    return {
        "id": str(t.id),
        "created_at": t.date.astimezone(timezone.utc).isoformat(),
        "text": getattr(t, "rawContent", "") or "",
        "is_retweet": bool(getattr(t, "isRetweet", False)),
        "is_quote": bool(getattr(t, "isQuote", False)),
        "quoted_tweet_id": getattr(t, "quotedTweetId", None),
        "reply_to_id": str(reply_to[0]) if reply_to else None,
        "lang": getattr(t, "lang", None),
        "like_count": getattr(t, "likeCount", None),
        "reply_count": getattr(t, "replyCount", None),
        "retweet_count": getattr(t, "retweetCount", None),
        "url": getattr(t, "url", None),
    }


async def _search_generator(handle: str, limit: int, delay: float):
    from twscrape import API

    api = API()
    n = 0
    async for tweet in api.search(f"from:{handle}", limit=limit):
        yield tweet
        n += 1
        if delay:
            await asyncio.sleep(delay)


def fetch_x_history(handle: str, limit: int = 100_000, delay: float = 0.0) -> Dict:
    """Fetch a handle's full X history via from: search pagination.

    Returns a summary dict; rows are appended to social/x-<handle>.jsonl.
    """
    path = post_path(handle, X_PLATFORM)
    path.parent.mkdir(exist_ok=True)
    existing = load_post_ids(path)

    async def run():
        fetched = skipped = 0
        newest = oldest = None
        async for tweet in _search_generator(handle, limit, delay):
            pid = str(tweet.id)
            if pid in existing:
                skipped += 1
                continue
            row = _tweet_row(tweet)
            append_post(path, row)
            existing.add(pid)
            fetched += 1
            created = row["created_at"]
            if newest is None or created > newest:
                newest = created
            if oldest is None or created < oldest:
                oldest = created
        return fetched, skipped, newest, oldest

    fetched, skipped, newest, oldest = asyncio.run(run())
    return {
        "handle": handle, "platform": X_PLATFORM, "file": str(path),
        "fetched": fetched, "skipped_duplicates": skipped,
        "newest": newest, "oldest": oldest,
    }


def register_x_account(cookies, username: str) -> None:
    """Register an X session in twscrape's account pool from cookies.

    cookies: dict of cookie name → value (must include auth_token + ct0), or a
    "; k=v"-style string, or a JSON string, or a browser-export list.
    """
    from twscrape import API

    api = API()
    if isinstance(cookies, (dict, list)):
        cookies = json.dumps(cookies)

    async def run():
        await api.pool.add_account_cookies(username, cookies)

    asyncio.run(run())


def x_accounts() -> List[Dict]:
    from twscrape import API

    api = API()

    async def run():
        return [{"username": a.username, "active": a.active,
                 "error_msg": a.error_msg} for a in await api.pool.get_all()]

    return asyncio.run(run())


def x_status(handle: str) -> Dict:
    path = post_path(handle, X_PLATFORM)
    if not path.exists():
        return {"handle": handle, "file": str(path), "count": 0,
                "newest": None, "oldest": None, "exists": False}
    newest = oldest = None
    n = 0
    with path.open() as f:
        for line in f:
            if not line.strip():
                continue
            n += 1
            try:
                created = json.loads(line)["created_at"]
            except (json.JSONDecodeError, KeyError):
                continue
            if newest is None or created > newest:
                newest = created
            if oldest is None or created < oldest:
                oldest = created
    return {"handle": handle, "file": str(path), "count": n,
            "newest": newest, "oldest": oldest, "exists": True}


PLATFORMS = {"x": fetch_x_history}


if __name__ == "__main__":
    # quick smoke test: python pylib/social_fetcher.py status <handle>
    status = x_status(sys.argv[1])
    print(json.dumps(status, indent=2))
