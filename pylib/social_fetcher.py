"""
social_fetcher.py — Full post history for a person from social platforms.

Currently X/Twitter via twscrape (drives X's internal GraphQL search with a
normal account session — no API key). Paginating search (`from:<handle>`)
covers an account's FULL history back to 2006; profile timelines cap at
~3,200 posts, the search index doesn't.

Posts cache as JSONL at social/<handle>.jsonl, one post per line:
{"id", "created_at", "text", "is_retweet", "is_quote", "quoted_tweet_id",
 "reply_to_id", "lang", "like_count", "reply_count", "retweet_count", "url"}

Resumable: existing ids are skipped on re-runs, and a resuming search is
restricted (until:) to posts older than what's already on disk so it doesn't
re-walk the full known history. Optional caps: max_seconds (time budget per
run), min_date (stop once the walk passes older posts), max_posts (stop once
that many of the most recent posts are on disk). Once a handle's window is
fully on disk (a ".complete" sidecar marks it), later runs REFRESH instead:
a since: search fetches only posts newer than the newest on disk, merged to
the top of the file, so frequently-scheduled jobs keep the cache fresh.

Platform backends register in PLATFORMS and share the JSONL layout, so Threads
and Instagram can slot in behind the same interface later.
"""

import asyncio
import json
import sys
import time
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


async def _search_generator(handle: str, limit: int, delay: float,
                            until: Optional[str] = None,
                            since: Optional[str] = None):
    from twscrape import API

    api = API()
    query = f"from:{handle}"
    if since:
        query += f" since:{since}"
    if until:
        query += f" until:{until}"
    n = 0
    async for tweet in api.search(query, limit=limit):
        yield tweet
        n += 1
        if delay:
            await asyncio.sleep(delay)


def _newest_fetched_date(path: Path) -> Optional[str]:
    """UTC date (YYYY-MM-DD) of the newest post on disk, if any."""
    if not path.exists() or path.stat().st_size == 0:
        return None
    with path.open("rb") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                return json.loads(line)["created_at"][:10]
            except (KeyError, TypeError, json.JSONDecodeError):
                continue
    return None


def _backfill_complete(path: Path) -> bool:
    """Sidecar marker: the wanted window is fully on disk, so future runs
    should only refresh (fetch newer posts), not walk older ones."""
    return Path(str(path) + ".complete").exists()


def _oldest_fetched_date(path: Path) -> Optional[str]:
    """UTC date (YYYY-MM-DD) of the oldest post on disk, if any."""
    if not path.exists() or path.stat().st_size == 0:
        return None
    with path.open("rb") as f:
        f.seek(0, 2)
        size = f.tell()
        f.seek(max(0, size - 4096))
        tail = f.read().decode("utf-8", "replace")
    for line in reversed(tail.splitlines()):
        line = line.strip()
        if not line:
            continue
        try:
            return json.loads(line)["created_at"][:10]
        except (KeyError, TypeError, json.JSONDecodeError):
            continue
    return None


def fetch_x_history(handle: str, limit: int = 100_000, delay: float = 0.0,
                    max_seconds: Optional[float] = None,
                    min_date: Optional[str] = None,
                    max_posts: Optional[int] = None) -> Dict:
    """Fetch a handle's X post history via from: search pagination.

    Returns a summary dict; rows are appended to social/x-<handle>.jsonl.
    max_seconds is a hard wall-clock deadline for the run (it also bounds
    rate-limit waits inside the search); min_date (YYYY-MM-DD) stops the walk
    once the search passes older posts; max_posts stops once that many of the
    most recent posts are on disk. Partial histories resume on later runs:
    the search is restricted to posts older than what's already on disk, so a
    capped re-run doesn't burn its budget re-walking known posts.

    Once a handle's window is fully on disk (count/date cap reached, or the
    search exhausted and a ".complete" sidecar written), runs REFRESH instead
    of walking older: a since: search fetches only posts newer than the
    newest on disk, merged to the top of the file.
    """
    path = post_path(handle, X_PLATFORM)
    path.parent.mkdir(exist_ok=True)
    existing = load_post_ids(path)
    until = _oldest_fetched_date(path)
    refresh = (max_posts is not None and len(existing) >= max_posts) \
        or (min_date is not None and until is not None and until <= min_date) \
        or _backfill_complete(path)
    if refresh:
        since = _newest_fetched_date(path)
        if since is None:
            # Covered but nothing on disk (search returned no posts); there
            # is nothing to refresh either.
            return {"handle": handle, "platform": X_PLATFORM, "file": str(path),
                    "fetched": 0, "skipped_duplicates": 0,
                    "newest": None, "oldest": None,
                    "time_capped": False, "elapsed_seconds": 0.0,
                    "already_covered": True}
        until = None
    else:
        since = None

    async def run():
        fetched = skipped = 0
        newest = oldest = None
        capped = False
        complete = False
        start = time.monotonic()
        # Hard deadline: the cap bounds wall time including rate-limit waits
        # inside the search, not just time spent between yielded posts.
        deadline = start + max_seconds if max_seconds is not None else None
        new_rows = [] if refresh else None
        gen = _search_generator(handle, limit, delay, until=until, since=since)
        while True:
            if deadline is not None and time.monotonic() >= deadline:
                capped = True
                break
            remaining = None
            if deadline is not None:
                remaining = max(0.0, deadline - time.monotonic())
            try:
                tweet = await asyncio.wait_for(gen.__anext__(), remaining) \
                    if remaining is not None else await gen.__anext__()
            except StopAsyncIteration:
                complete = True
                break
            except asyncio.TimeoutError:
                capped = True
                break
            row = _tweet_row(tweet)
            created = row["created_at"]
            if min_date is not None and created < min_date:
                complete = True
                break
            pid = str(tweet.id)
            if pid in existing:
                skipped += 1
                continue
            if refresh:
                new_rows.append(row)
            else:
                append_post(path, row)
                existing.add(pid)
                fetched += 1
                if max_posts is not None and len(existing) >= max_posts:
                    break
                if newest is None or created > newest:
                    newest = created
                if oldest is None or created < oldest:
                    oldest = created
        if refresh:
            if new_rows:
                # Newer posts go to the top, keeping the file newest-first.
                old_lines = path.read_text().splitlines(keepends=True)
                with path.open("w") as f:
                    for r in new_rows:
                        f.write(json.dumps(r) + "\n")
                        existing.add(r["id"])
                    f.writelines(old_lines)
                fetched = len(new_rows)
                newest = new_rows[0]["created_at"]
                oldest = new_rows[-1]["created_at"]
        elif complete:
            # Only mark complete if posts are actually on disk; a rate-limited
            # search returning nothing would otherwise poison the handle into
            # permanent refresh mode with nothing to refresh.
            if path.exists() and path.stat().st_size > 0:
                Path(str(path) + ".complete").touch()
        return fetched, skipped, newest, oldest, capped, time.monotonic() - start

    fetched, skipped, newest, oldest, capped, elapsed = asyncio.run(run())
    return {
        "handle": handle, "platform": X_PLATFORM, "file": str(path),
        "fetched": fetched, "skipped_duplicates": skipped,
        "newest": newest, "oldest": oldest,
        "time_capped": capped,
        "elapsed_seconds": round(elapsed, 1),
        "already_covered": False,
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
