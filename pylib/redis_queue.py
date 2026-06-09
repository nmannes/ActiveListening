"""
redis_queue.py — Lightweight Redis-backed job queues shared between the
Telegram bot and Python workers. Each queue is a Redis list key.

Queues:
    queue:sample-generation   — voice sample generation jobs
    queue:save-samples        — save approved samples to audio-library

Job lifecycle:
    pending  → LPUSH to queue
    active   → BRPOP from queue, set job:{id} status=active
    awaiting_verification → worker sets job status, bot waits for callbacks
    complete → job:{id} status=complete with result
    failed   → job:{id} status=failed with error
"""

import json
import os
import sys
import time
import uuid
import logging
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Auto-load .env.prod so REDIS_HOST/TELEGRAM_KEY etc. are available
_env = "prod"
for i, arg in enumerate(sys.argv):
    if arg == "--env" and i + 1 < len(sys.argv):
        _env = sys.argv[i + 1]
    elif arg.startswith("--env="):
        _env = arg.split("=", 1)[1]
load_dotenv(dotenv_path=Path(__file__).parent.parent / f".env.{_env}")

import redis

logger = logging.getLogger("redis_queue")

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


# ---------------------------------------------------------------------------
# Enqueue
# ---------------------------------------------------------------------------

def enqueue(queue_name: str, payload: dict) -> str:
    """Push a job onto a queue. Returns job_id."""
    r = get_redis()
    job_id = uuid.uuid4().hex[:12]
    job = {
        "id": job_id,
        "status": "pending",
        "created_at": time.time(),
        "payload": payload,
    }
    r.set(f"job:{job_id}", json.dumps(job))
    r.lpush(f"queue:{queue_name}", job_id)
    logger.info(f"Enqueued {job_id} → queue:{queue_name} ({payload.get('type', '?')})")
    return job_id


# ---------------------------------------------------------------------------
# Dequeue (blocking)
# ---------------------------------------------------------------------------

def dequeue(queue_name: str, timeout: int = 5) -> Optional[dict]:
    """Blocking pop from a queue. Returns full job dict or None on timeout."""
    r = get_redis()
    result = r.brpop(f"queue:{queue_name}", timeout=timeout)
    if result is None:
        return None
    _, job_id = result
    raw = r.get(f"job:{job_id}")
    if raw is None:
        logger.warning(f"Job {job_id} not found in Redis")
        return None
    job = json.loads(raw)
    job["status"] = "active"
    job["started_at"] = time.time()
    r.set(f"job:{job_id}", json.dumps(job))
    return job


# ---------------------------------------------------------------------------
# Job state
# ---------------------------------------------------------------------------

def update_job(job_id: str, **kwargs):
    """Update fields on a job."""
    r = get_redis()
    raw = r.get(f"job:{job_id}")
    if raw is None:
        return
    job = json.loads(raw)
    job.update(kwargs)
    job["updated_at"] = time.time()
    r.set(f"job:{job_id}", json.dumps(job))


def get_job(job_id: str) -> Optional[dict]:
    r = get_redis()
    raw = r.get(f"job:{job_id}")
    return json.loads(raw) if raw else None


def queue_length(queue_name: str) -> int:
    r = get_redis()
    return r.llen(f"queue:{queue_name}")


def all_queue_lengths() -> dict:
    r = get_redis()
    lengths = {}
    for key in r.keys("queue:*"):
        name = key.split(":", 1)[1] if ":" in key else key
        lengths[name] = r.llen(key)
    return lengths


# ---------------------------------------------------------------------------
# Verification state (for inline keyboard callbacks)
# ---------------------------------------------------------------------------

def set_verification_state(slug: str, segment_idx: int, data: dict):
    """Store segment metadata so the bot can resolve callback queries."""
    r = get_redis()
    r.hset(f"verify:{slug}", str(segment_idx), json.dumps(data))
    # Expire after 1 hour
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
    """List all slugs with pending verifications."""
    r = get_redis()
    slugs = []
    for key in r.keys("verify:*"):
        slug = key.split(":", 1)[1] if ":" in key else key
        slugs.append(slug)
    return slugs
