#!/usr/bin/env python
"""
notify_telegram.py — Send a completion notice to the info Telegram channel.

Exists so long-running background jobs can report when they finish while
nobody is watching the terminal (overnight backfills, report regenerations).
Thin wrapper over pylib.telegram.send_telegram so the token/chat plumbing and
.env.prod loading stay in one place.

Message comes from the arguments, or from stdin when no arguments are given
(handy for `some_job && ... | notify_telegram.py`).

Exits non-zero if the send failed, so a caller chaining with `&&` notices.

Usage:
    PYTHONPATH=. python scripts/notify_telegram.py "backfill finished"
    echo "report regenerated" | PYTHONPATH=. python scripts/notify_telegram.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pylib.telegram import send_telegram  # noqa: E402


def main() -> int:
    msg = " ".join(sys.argv[1:]).strip() or sys.stdin.read().strip()
    if not msg:
        print("usage: notify_telegram.py <message>", file=sys.stderr)
        return 2
    result = send_telegram(msg, channel="info")
    if result.get("ok"):
        print("sent")
        return 0
    print(f"FAILED: {result}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
