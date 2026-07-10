import json
import logging
import subprocess
import sys
from unittest import mock

import pytest

from pylib.log_config import (
    JsonFormatter,
    RunUUIDFilter,
    run_uuid_var,
    set_run_uuid,
    setup_logging,
)


# ── JsonFormatter ────────────────────────────────────────────────────────────

class TestJsonFormatter:
    def test_formats_record_to_json(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="test.logger", level=logging.INFO,
            pathname=__file__, lineno=42, msg="hello %s", args=("world",),
            exc_info=None,
        )
        record.created = 1700000000.123  # deterministic timestamp
        record.msecs = 123.0  # must match the fractional part of created

        output = formatter.format(record)
        parsed = json.loads(output)

        assert parsed["level"] == "INFO"
        assert parsed["logger"] == "test.logger"
        assert parsed["message"] == "hello world"
        assert parsed["time"] == "2023-11-14T22:13:20.123Z"
        assert "run_uuid" in parsed
        assert "commit" in parsed
        assert "thread" in parsed

    def test_includes_exception_when_present(self):
        formatter = JsonFormatter()
        try:
            raise ValueError("boom")
        except ValueError:
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="x", level=logging.ERROR, pathname="", lineno=0,
            msg="fail", args=(), exc_info=exc_info,
        )

        output = formatter.format(record)
        parsed = json.loads(output)

        assert "exception" in parsed
        assert "ValueError: boom" in parsed["exception"]

    def test_omits_exception_when_none(self):
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="x", level=logging.INFO, pathname="", lineno=0,
            msg="ok", args=(), exc_info=None,
        )

        output = formatter.format(record)
        parsed = json.loads(output)

        assert "exception" not in parsed

    def test_omits_exception_when_exc_info_tuple_has_none_value(self):
        """exc_info can be (type, None, tb) — log entry should NOT have exception."""
        formatter = JsonFormatter()
        record = logging.LogRecord(
            name="x", level=logging.INFO, pathname="", lineno=0,
            msg="ok", args=(), exc_info=(ValueError, None, None),
        )

        output = formatter.format(record)
        parsed = json.loads(output)

        assert "exception" not in parsed


# ── RunUUIDFilter ────────────────────────────────────────────────────────────

class TestRunUUIDFilter:
    def test_sets_run_uuid_from_context_var(self, monkeypatch):
        token = run_uuid_var.set("ctx-uuid-123")
        try:
            filt = RunUUIDFilter()
            record = logging.LogRecord(
                name="x", level=logging.INFO, pathname="", lineno=0,
                msg="hi", args=(), exc_info=None,
            )
            assert filt.filter(record) is True
            assert record.run_uuid == "ctx-uuid-123"
        finally:
            run_uuid_var.reset(token)

    def test_falls_back_to_global_when_context_var_is_default(self):
        set_run_uuid("global-uuid-456")
        try:
            # Ensure the current context holds the default "-"
            token = run_uuid_var.set("-")
            try:
                filt = RunUUIDFilter()
                record = logging.LogRecord(
                    name="x", level=logging.INFO, pathname="", lineno=0,
                    msg="hi", args=(), exc_info=None,
                )
                filt.filter(record)
                assert record.run_uuid == "global-uuid-456"
            finally:
                run_uuid_var.reset(token)
        finally:
            set_run_uuid("-")

    def test_returns_true(self):
        filt = RunUUIDFilter()
        record = logging.LogRecord(
            name="x", level=logging.INFO, pathname="", lineno=0,
            msg="hi", args=(), exc_info=None,
        )
        assert filt.filter(record) is True


# ── set_run_uuid ─────────────────────────────────────────────────────────────

class TestSetRunUuid:
    def test_sets_context_var(self):
        set_run_uuid("my-uuid")
        assert run_uuid_var.get() == "my-uuid"
        set_run_uuid("-")  # restore

    def test_sets_global_fallback(self):
        import pylib.log_config as mod

        set_run_uuid("global-only")
        assert mod._run_uuid_global == "global-only"
        set_run_uuid("-")  # restore


# ── setup_logging ────────────────────────────────────────────────────────────

class TestSetupLogging:
    def test_returns_root_and_transcript_loggers(self):
        logger, transcript = setup_logging()
        assert isinstance(logger, logging.Logger)
        assert isinstance(transcript, logging.Logger)
        assert transcript.name == "transcript"

    def test_root_logger_has_json_handler_with_filter(self):
        setup_logging()
        root = logging.getLogger()
        handlers = [h for h in root.handlers if isinstance(h, logging.StreamHandler)]
        assert len(handlers) >= 1
        handler = handlers[0]
        assert isinstance(handler.formatter, JsonFormatter)
        assert any(isinstance(f, RunUUIDFilter) for f in handler.filters)

    def test_root_logger_level_is_info(self):
        setup_logging()
        root = logging.getLogger()
        assert root.level == logging.INFO

    def test_transcript_logger_has_handler_and_filter(self):
        _, transcript = setup_logging()
        assert len(transcript.handlers) >= 1
        handler = transcript.handlers[0]
        assert isinstance(handler.formatter, JsonFormatter)
        assert any(isinstance(f, RunUUIDFilter) for f in handler.filters)

    def test_transcript_logger_does_not_propagate(self):
        _, transcript = setup_logging()
        assert transcript.propagate is False

    def test_transcript_handler_not_duplicated_on_second_call(self):
        _, t1 = setup_logging()
        _, t2 = setup_logging()
        assert len(t2.handlers) == len(t1.handlers)

    def test_log_output_is_valid_json(self):
        logger, _ = setup_logging()
        with mock.patch.object(logging, "root", logger):
            # Capture stdout
            buf = mock.MagicMock()
            handler = logging.StreamHandler(buf)
            handler.setFormatter(JsonFormatter())
            handler.addFilter(RunUUIDFilter())
            logger.addHandler(handler)
            logger.info("test message %d", 42)
            try:
                handler.flush()
                call = buf.write.call_args_list[0][0][0]
                parsed = json.loads(call.strip())
                assert parsed["message"] == "test message 42"
                assert parsed["level"] == "INFO"
            finally:
                logger.removeHandler(handler)

    def test_git_commit_is_resolved(self, monkeypatch):
        monkeypatch.setattr(subprocess, "run", lambda *a, **kw: mock.MagicMock(
            stdout="abc123def\n", stderr="",
        ))
        monkeypatch.setattr("pylib.log_config._commit_id", "-")
        setup_logging()
        from pylib.log_config import _commit_id
        assert _commit_id == "abc123def"

    def test_git_commit_fallback_on_error(self, monkeypatch):
        monkeypatch.setattr(subprocess, "run", mock.MagicMock(
            side_effect=FileNotFoundError("no git"),
        ))
        monkeypatch.setattr("pylib.log_config._commit_id", "-")
        logger, transcript = setup_logging()
        from pylib.log_config import _commit_id
        assert _commit_id == "unknown"
