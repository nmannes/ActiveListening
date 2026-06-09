"""
verification_state.py — Redis-backed verification state for Telegram inline
keyboard callbacks. Shared between queue_worker (writes) and telegram_server
(reads/writes on user approval).

Each slug gets a Redis hash at verify:{slug} mapping segment index → JSON blob.
Hashes expire after 1 hour.
"""

import json
import os
import logging
from pathlib import Path
from typing import Optional

import redis
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env.prod")

logger = logging.getLogger("verification_state")

REDIS_HOST = os.environ.get("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))

_r = None


def get_redis() -> redis.Redis:
    global _r
    if _r is None:
        _r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        try:
            _r.ping()
        except Exception:
            logger.warning(f"Redis not reachable at {REDIS_HOST}:{REDIS_PORT}")
    return _r


def set_verification_state(slug: str, segment_idx: int, data: dict):
    r = get_redis()
    r.hset(f"verify:{slug}", str(segment_idx), json.dumps(data))
    r.expire(f"verify:{slug}", 3600)


def get_verification_state(slug: str, segment_idx: int) -> Optional[dict]:
    r = get_redis()
    raw = r.hget(f"verify:{slug}", str(segment_idx))
    return json.loads(raw) if raw else None


def get_all_verification_states(slug: str) -> dict:
    r = get_redis()
    raw = r.hgetall(f"verify:{slug}")
    return {int(k): json.loads(v) for k, v in raw.items()}


def update_verification_state(slug: str, segment_idx: int, **kwargs):
    data = get_verification_state(slug, segment_idx) or {}
    data.update(kwargs)
    set_verification_state(slug, segment_idx, data)


def clear_verification_state(slug: str):
    r = get_redis()
    r.delete(f"verify:{slug}")


def pending_verifications() -> list:
    r = get_redis()
    slugs = []
    for key in r.keys("verify:*"):
        slug = key.split(":", 1)[1] if ":" in key else key
        slugs.append(slug)
    return slugs
