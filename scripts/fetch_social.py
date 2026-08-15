#!/usr/bin/env python
"""
fetch_social.py — Fetch full post history for a person from social platforms.

Currently X/Twitter (via twscrape, no API key — needs one logged-in X session
registered as cookies). Full history comes from `from:<handle>` search
pagination, which reaches back to 2006.

Subcommands:
    account --cookies-file <path> [--username <name>]
        Register an X session. The cookies file is a JSON export from a browser
        session logged into x.com (Application → Cookies → x.com), e.g.:
        {"auth_token": "...", "ct0": "...", "twid": "..."}
        auth_token + ct0 are required. Env fallback: TWS_COOKIES (JSON).

    fetch <handle> [--limit N] [--delay S]
        Fetch the handle's full history into social/x-<handle>.jsonl
        (resumable: existing ids are skipped).

    status <handle>
        Count + date range of posts already cached.

Usage:
    PYTHONPATH=. python scripts/fetch_social.py account --cookies-file cookies/x_twitter.json
    PYTHONPATH=. python scripts/fetch_social.py fetch marcoRubio
    PYTHONPATH=. python scripts/fetch_social.py status marcoRubio
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.social_fetcher import (  # noqa: E402
    PLATFORMS,
    fetch_x_history,
    post_path,
    register_x_account,
    x_accounts,
    x_status,
)


def cmd_account(args):
    cookies = None
    if args.cookies_file:
        path = Path(args.cookies_file)
        if not path.exists():
            print(f"cookies file not found: {path}")
            sys.exit(1)
        cookies = json.loads(path.read_text())
    elif os.environ.get("TWS_COOKIES"):
        cookies = json.loads(os.environ["TWS_COOKIES"])
    else:
        print("pass --cookies-file or set TWS_COOKIES (JSON)")
        sys.exit(1)
    username = args.username or "x-session"
    register_x_account(cookies, username)
    print(f"registered session {username!r}; accounts in pool:")
    for a in x_accounts():
        print(f"  {a['username']}  active={a['active']}"
              + (f"  error={a['error_msg']}" if a["error_msg"] else ""))


def cmd_fetch(args):
    if args.platform != "x":
        print(f"platform {args.platform!r} not implemented yet (only 'x')")
        sys.exit(1)
    summary = fetch_x_history(args.handle, limit=args.limit, delay=args.delay)
    print(f"{summary['handle']}: fetched {summary['fetched']} new "
          f"({summary['skipped_duplicates']} dup) → {summary['file']}")
    if summary["newest"]:
        print(f"range: {summary['oldest']} .. {summary['newest']}")
    if summary["fetched"] == 0 and summary["skipped_duplicates"] == 0:
        print("no posts returned — is the session valid? run `social account` "
              "first, or check for rate limiting")
        sys.exit(1)


def cmd_status(args):
    status = x_status(args.handle)
    if not status["exists"]:
        print(f"no cached posts for {args.handle} ({status['file']})")
        sys.exit(1)
    print(f"{status['handle']}: {status['count']} posts in {status['file']}")
    if status["count"]:
        print(f"range: {status['oldest']} .. {status['newest']}")


def main():
    ap = argparse.ArgumentParser(
        description="Fetch social media post history (X/Twitter)",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    sub = ap.add_subparsers(dest="action", metavar="action")

    sp_account = sub.add_parser("account", help="Register an X session from browser cookies")
    sp_account.add_argument("--cookies-file", type=Path, default=None,
                            help="JSON cookie export from a logged-in x.com session")
    sp_account.add_argument("--username", default=None,
                            help="Name for the session in twscrape's account pool")
    sp_account.set_defaults(func=cmd_account)

    sp_fetch = sub.add_parser("fetch", help="Fetch a handle's full history")
    sp_fetch.add_argument("handle", help="X handle, e.g. marcoRubio")
    sp_fetch.add_argument("--limit", type=int, default=100_000,
                          help="Max posts to fetch (safety cap)")
    sp_fetch.add_argument("--delay", type=float, default=0.0,
                          help="Extra seconds between posts (pacing)")
    sp_fetch.add_argument("--platform", default="x", choices=list(PLATFORMS),
                          help="Platform to fetch from")
    sp_fetch.set_defaults(func=cmd_fetch)

    sp_status = sub.add_parser("status", help="Show cached post counts for a handle")
    sp_status.add_argument("handle", help="X handle")
    sp_status.set_defaults(func=cmd_status)

    args = ap.parse_args()
    if not args.action:
        ap.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
