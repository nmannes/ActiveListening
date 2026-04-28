import logging
import sys
import os


def setup_logging():
    os.makedirs("debug", exist_ok=True)

    # Root logging configuration
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s.%(msecs)03d %(levelname)s [%(threadName)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
    )

    # Dedicated transcript logger
    transcript_logger = logging.getLogger("transcript")
    transcript_logger.setLevel(logging.INFO)
    # Avoid duplicate handlers if setup_logging is called multiple times
    if not transcript_logger.handlers:
        transcript_logger.addHandler(logging.StreamHandler(sys.stdout))

    return logging.getLogger("remote_server"), transcript_logger
