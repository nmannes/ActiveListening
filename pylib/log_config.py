import contextvars
import json
import logging
import subprocess
import sys
import threading
from datetime import datetime, timezone

run_uuid_var = contextvars.ContextVar("run_uuid", default="-")
_run_uuid_lock = threading.Lock()
_run_uuid_global = "-"
_commit_id = "-"


def set_run_uuid(value):
    """Set run_uuid for async context (via ContextVar) and global fallback for threads."""
    run_uuid_var.set(value)
    global _run_uuid_global
    with _run_uuid_lock:
        _run_uuid_global = value


def _get_run_uuid():
    ru = run_uuid_var.get()
    if ru != "-":
        return ru
    with _run_uuid_lock:
        return _run_uuid_global


class RunUUIDFilter(logging.Filter):
    def filter(self, record):
        record.run_uuid = _get_run_uuid()
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record):
        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        ts = dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(record.msecs):03d}Z"

        log_entry = {
            "time": ts,
            "level": record.levelname,
            "logger": record.name,
            "run_uuid": getattr(record, "run_uuid", "-"),
            "commit": _commit_id,
            "thread": record.threadName,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def _get_commit_id():
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=2,
        ).stdout.strip()
    except Exception:
        return "unknown"


def _configure_transcript_logger(formatter, filter_):
    logger = logging.getLogger("transcript")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(formatter)
        handler.addFilter(filter_)
        logger.addHandler(handler)
    logger.propagate = False
    return logger


def setup_logging():
    global _commit_id
    _commit_id = _get_commit_id()

    json_formatter = JsonFormatter()
    run_uuid_filter = RunUUIDFilter()

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(json_formatter)
    stream_handler.addFilter(run_uuid_filter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers.clear()
    root_logger.addHandler(stream_handler)

    transcript_logger = _configure_transcript_logger(json_formatter, run_uuid_filter)

    logger = logging.getLogger("remote_server")
    return logger, transcript_logger
