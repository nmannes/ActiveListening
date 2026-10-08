"""speaker_confirmations.py — Redis list bridge for live speaker asks.

telegram_server (Python, local) pushes the operator's answer onto
`speaker_confirm:<slug>`; client.js (local, same box as Redis) BRPOPs it and
forwards the answer to the EC2 server over the WebSocket
(see lib/speaker_confirmations.js).

The list is bounded and self-expiring: one session can queue at most
MAX_QUEUE_LEN answers, and the key disappears an hour after the last one.
"""

import json
import logging
import time

from pylib.verification_state import get_redis

logger = logging.getLogger("verification_state")

CONFIRM_TTL_SECS = 3600
MAX_QUEUE_LEN = 100


def push_confirmation(slug: str, payload: dict):
    """Queue one operator answer for the session's client to forward."""
    payload = dict(payload)
    payload.setdefault("ts", int(time.time() * 1000))
    key = f"speaker_confirm:{slug}"
    r = get_redis()
    r.lpush(key, json.dumps(payload))
    r.ltrim(key, 0, MAX_QUEUE_LEN - 1)
    r.expire(key, CONFIRM_TTL_SECS)
    logger.info(
        f"speaker_confirm: queued {payload.get('action')} for speaker "
        f"{payload.get('spk')} ({slug})"
    )
