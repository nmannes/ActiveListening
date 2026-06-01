import contextvars
import json
import logging
import sys
import os
from datetime import datetime, timezone

run_uuid_var = contextvars.ContextVar("run_uuid", default="-")


class RunUUIDFilter(logging.Filter):
    def filter(self, record):
        record.run_uuid = run_uuid_var.get()
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
            "thread": record.threadName,
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging():
    os.makedirs("debug", exist_ok=True)

    json_formatter = JsonFormatter()
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(json_formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.handlers.clear()
    root_logger.addHandler(stream_handler)
    root_logger.addFilter(RunUUIDFilter())

    # Dedicated transcript logger
    transcript_logger = logging.getLogger("transcript")
    transcript_logger.setLevel(logging.INFO)
    if not transcript_logger.handlers:
        transcript_handler = logging.StreamHandler(sys.stdout)
        transcript_handler.setFormatter(json_formatter)
        transcript_logger.addHandler(transcript_handler)

    logger = logging.getLogger("remote_server")

    return logger, transcript_logger
