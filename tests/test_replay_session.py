"""
Tests for scripts/replay_session.py — verify the transcript → keyword match → order
pipeline without calling external services (no Telegram, Kalshi API, or Bedrock).
"""
import asyncio
import json
import sys
from contextlib import ExitStack
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.replay_session import ReplaySession
from pylib.trade_processor import TradeProcessor


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_dg_response(words, speaker=0, is_final=True):
    """Build a Deepgram Results dict from word strings."""
    return {
        "type": "Results",
        "is_final": is_final,
        "channel": {
            "alternatives": [{
                "transcript": " ".join(words),
                "words": [
                    {"word": w, "start": i * 0.5, "end": i * 0.5 + 0.3,
                     "speaker": speaker, "confidence": 0.99}
                    for i, w in enumerate(words)
                ],
            }]
        },
    }


def _enter_patches():
    """Patch network-touching functions. Returns (ExitStack, mock_telegram).
    Caller must call stack.close() (or use it in a `with` block)."""
    stack = ExitStack()
    mock_loop = MagicMock()
    mock_loop.run_in_executor.side_effect = lambda executor, func, *args: func(*args)
    stack.enter_context(patch("asyncio.get_running_loop", return_value=mock_loop))
    mock_tg = stack.enter_context(patch("pylib.signal_handler.send_telegram"))
    return stack, mock_tg


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def market():
    return {
        "title": "Cherry Blossom Watch 2026",
        "keywords": {"cherry blossom": "CHERRY-YES", "full bloom": "BLOOM-YES"},
        "keywordConfigs": {
            "cherry blossom": {"dollarAmount": 10},
            "full bloom": {"dollarAmount": 15},
        },
        "mediaSourceCommonName": "C-SPAN",
        "mediaStreamURL": "https://example.com/stream",
    }


@pytest.fixture
def session(market):
    s = ReplaySession(session_id="test", market=market)
    s.server.kalshi = MagicMock()
    s.trade_processor = TradeProcessor(s)
    return s


# ═══════════════════════════════════════════════════════════════════════════════
# Keyword match → order attempt
# ═══════════════════════════════════════════════════════════════════════════════

class TestKeywordTriggersOrder:
    @pytest.mark.asyncio
    async def test_order_placed_when_keyword_matched_and_whitelisted(self, session):
        """Whitelisted speaker says 'cherry blossom' → order is placed."""
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_called_once_with(
                ticker="CHERRY-YES", dollar_amount=10
            )
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_order_not_placed_when_trade_for_real_is_false(self, session):
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = False

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_not_called()
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_order_not_placed_when_speaker_not_whitelisted(self, session):
        stack, mock_tg = _enter_patches()
        try:
            session.server.config.trade_for_real = True
            # speaker "0" is NOT added to trading whitelist

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_not_called()
            mock_tg.assert_called()  # still notified
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_order_skipped_when_confidence_below_minimum(self, session):
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True
            session.server.config.min_confidence = 0.95

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.80},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.80}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_not_called()
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_confidence_at_80_passes_bar(self, session):
        """Default min_confidence is 0.8 — confidence 0.80 allows order through."""
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True
            # min_confidence defaults to 0.8

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.80},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.80}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_called_once_with(
                ticker="CHERRY-YES", dollar_amount=10
            )
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_confidence_below_80_blocked(self, session):
        """Default min_confidence is 0.8 — confidence 0.79 blocks order."""
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.79},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.79}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_not_called()
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_keyword_removed_from_index_after_successful_order(self, session):
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True

            await session.trade_processor.process_tokens(
                [{"text": "cherry", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "blossom", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )

            # "blossom" removed from index by remove_market_from_index
            assert "blossom" not in session.keyword_index
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_dollar_amount_from_keyword_config(self, session):
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True

            # "full bloom" has dollarAmount 15 in keywordConfigs
            await session.trade_processor.process_tokens(
                [{"text": "full", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "bloom", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_called_once_with(
                ticker="BLOOM-YES", dollar_amount=15
            )
        finally:
            stack.close()

    @pytest.mark.asyncio
    async def test_dollar_amount_falls_back_to_default(self, session):
        """No keywordConfig, no market dollarAmount → uses get_dollar_amount default ($1)."""
        stack, mock_tg = _enter_patches()
        try:
            session.trade_processor.add_trading_speaker("0")
            session.server.config.trade_for_real = True

            from pylib.keyword_matching import build_keyword_index
            session.market["keywords"] = {"test phrase": "TEST"}
            session.keyword_index = build_keyword_index(session.market["keywords"])

            await session.trade_processor.process_tokens(
                [{"text": "test", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "phrase", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )

            session.server.kalshi.place_market_order.assert_called_once_with(
                ticker="TEST", dollar_amount=1
            )
        finally:
            stack.close()


# ═══════════════════════════════════════════════════════════════════════════════
# ReplaySession construction
# ═══════════════════════════════════════════════════════════════════════════════

class TestReplaySession:
    def test_session_id(self):
        s = ReplaySession("my-id")
        assert s.session_id == "my-id"

    def test_market_defaults_to_empty_dict(self):
        s = ReplaySession("id")
        assert s.market == {}

    def test_keyword_index_built_from_market(self, market):
        s = ReplaySession("id", market=market)
        assert "blossom" in s.keyword_index
        assert "bloom" in s.keyword_index

    def test_keyword_index_empty_when_no_market(self):
        s = ReplaySession("id")
        assert s.keyword_index == {}

    def test_keyword_index_empty_when_market_has_no_keywords(self):
        s = ReplaySession("id", market={"title": "No Keywords"})
        assert s.keyword_index == {}

    def test_server_defaults(self):
        s = ReplaySession("id")
        assert s.server.config.trade_for_real is False
        assert s.server.config.buy_count == 1
        assert s.server.config.buy_max_cost == 5
        assert s.server.config.last_words_count == 7
        assert s.server.kalshi is None

    def test_websocket_mock_send_does_not_raise(self):
        s = ReplaySession("id")

        async def _run():
            await s.websocket.send(json.dumps({"type": "test"}))

        asyncio.run(_run())


# ═══════════════════════════════════════════════════════════════════════════════
# Transcript population
# ═══════════════════════════════════════════════════════════════════════════════

class TestTranscriptPopulation:
    @pytest.mark.asyncio
    async def test_tokens_added_to_transcript(self, session):
        stack, mock_tg = _enter_patches()
        try:
            await session.trade_processor.process_tokens(
                [{"text": "hello", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "world", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )
        finally:
            stack.close()

        assert len(session.transcript["0"]) == 2
        assert session.transcript["0"][0]["text"] == "hello"
        assert session.transcript["0"][1]["text"] == "world"

    @pytest.mark.asyncio
    async def test_speakers_tracked_separately(self, session):
        stack, mock_tg = _enter_patches()
        try:
            await session.trade_processor.process_tokens(
                [{"text": "speaker zero", "start": 0.0, "end": 0.5, "confidence": 0.99}],
                speaker_id="0",
            )
            await session.trade_processor.process_tokens(
                [{"text": "speaker one", "start": 1.0, "end": 1.5, "confidence": 0.99}],
                speaker_id="1",
            )
        finally:
            stack.close()

        assert len(session.transcript["0"]) == 1
        assert len(session.transcript["1"]) == 1
        assert session.transcript["0"][0]["text"] == "speaker zero"
        assert session.transcript["1"][0]["text"] == "speaker one"

    @pytest.mark.asyncio
    async def test_duplicate_adjacent_words_deduplicated(self, session):
        stack, mock_tg = _enter_patches()
        try:
            await session.trade_processor.process_tokens(
                [{"text": "yeah", "start": 0.0, "end": 0.5, "confidence": 0.99},
                 {"text": "yeah", "start": 0.6, "end": 1.0, "confidence": 0.99}],
                speaker_id="0",
            )
        finally:
            stack.close()

        assert len(session.transcript["0"]) == 1

    @pytest.mark.asyncio
    async def test_empty_tokens_does_nothing(self, session):
        await session.trade_processor.process_tokens([], speaker_id="0")
        assert "0" not in session.transcript


# ═══════════════════════════════════════════════════════════════════════════════
# Deepgram response → replay integration (tmp_path, no network)
# ═══════════════════════════════════════════════════════════════════════════════

class TestReplayDgProcessing:
    @pytest.mark.asyncio
    async def test_full_replay_loop_triggers_order(self, tmp_path, market):
        """End-to-end: write DG files, run replay loop, verify order placed."""
        dg_dir = tmp_path / "deepgram_responses"
        dg_dir.mkdir()

        (dg_dir / "dg_001.json").write_text(json.dumps(_make_dg_response(["cherry"], speaker=0)))
        (dg_dir / "dg_002.json").write_text(json.dumps(_make_dg_response(["blossom"], speaker=0)))

        s = ReplaySession(session_id="replay-test", market=market)
        s.server.kalshi = MagicMock()
        s.server.config.trade_for_real = True
        tp = TradeProcessor(s)
        s.trade_processor = tp
        tp.add_trading_speaker("0")

        response_files = sorted(dg_dir.glob("dg_*.json"))
        assert [f.name for f in response_files] == ["dg_001.json", "dg_002.json"]

        stack, mock_tg = _enter_patches()
        try:
            for file_path in response_files:
                data = json.loads(file_path.read_text())
                if data.get("type") != "Results":
                    continue
                if not data.get("is_final", False):
                    continue
                channel = data.get("channel", {})
                alternatives = channel.get("alternatives", [])
                if not alternatives:
                    continue
                words = alternatives[0].get("words", [])
                if not words:
                    continue

                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [
                    {"text": w["word"].lower(), "start": w["start"], "end": w["end"],
                     "confidence": round(w.get("confidence", 0), 3)}
                    for w in words
                ]
                await tp.process_tokens(formatted_tokens, speaker_id=speaker_id)
        finally:
            stack.close()

        s.server.kalshi.place_market_order.assert_called_once_with(
            ticker="CHERRY-YES", dollar_amount=10
        )
        assert [t["text"] for t in s.transcript["0"]] == ["cherry", "blossom"]

    @pytest.mark.asyncio
    async def test_replay_skips_non_final_and_metadata(self, tmp_path, market):
        dg_dir = tmp_path / "deepgram_responses"
        dg_dir.mkdir()

        (dg_dir / "dg_001.json").write_text(json.dumps({"type": "Metadata"}))
        (dg_dir / "dg_002.json").write_text(json.dumps(_make_dg_response(["cherry"], speaker=0, is_final=False)))
        (dg_dir / "dg_003.json").write_text(json.dumps(_make_dg_response(["hello"], speaker=0)))

        s = ReplaySession(session_id="filter-test", market=market)
        tp = TradeProcessor(s)
        s.trade_processor = tp

        stack, mock_tg = _enter_patches()
        try:
            processed = 0
            for file_path in sorted(dg_dir.glob("dg_*.json")):
                data = json.loads(file_path.read_text())
                if data.get("type") != "Results":
                    continue
                if not data.get("is_final", False):
                    continue
                channel = data.get("channel", {})
                alternatives = channel.get("alternatives", [])
                if not alternatives:
                    continue
                words = alternatives[0].get("words", [])
                if not words:
                    continue
                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [
                    {"text": w["word"].lower(), "start": w["start"], "end": w["end"],
                     "confidence": round(w.get("confidence", 0), 3)}
                    for w in words
                ]
                await tp.process_tokens(formatted_tokens, speaker_id=speaker_id)
                processed += 1
        finally:
            stack.close()

        assert processed == 1
        assert s.transcript["0"][0]["text"] == "hello"

    @pytest.mark.asyncio
    async def test_files_processed_in_lexicographic_order(self, tmp_path, market):
        dg_dir = tmp_path / "deepgram_responses"
        dg_dir.mkdir()

        (dg_dir / "dg_003.json").write_text(json.dumps(_make_dg_response(["third"], speaker=0)))
        (dg_dir / "dg_001.json").write_text(json.dumps(_make_dg_response(["first"], speaker=0)))
        (dg_dir / "dg_002.json").write_text(json.dumps(_make_dg_response(["second"], speaker=0)))

        s = ReplaySession(session_id="order-test", market=market)
        tp = TradeProcessor(s)
        s.trade_processor = tp

        stack, mock_tg = _enter_patches()
        try:
            for file_path in sorted(dg_dir.glob("dg_*.json")):
                data = json.loads(file_path.read_text())
                words = data["channel"]["alternatives"][0]["words"]
                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [
                    {"text": w["word"].lower(), "start": w["start"], "end": w["end"],
                     "confidence": round(w.get("confidence", 0), 3)}
                    for w in words
                ]
                await tp.process_tokens(formatted_tokens, speaker_id=speaker_id)
        finally:
            stack.close()

        texts = [t["text"] for t in s.transcript["0"]]
        assert texts == ["first", "second", "third"]

    @pytest.mark.asyncio
    async def test_multiple_speakers_from_dg_data(self, tmp_path, market):
        dg_dir = tmp_path / "deepgram_responses"
        dg_dir.mkdir()

        (dg_dir / "dg_001.json").write_text(json.dumps(_make_dg_response(["hello"], speaker=0)))
        (dg_dir / "dg_002.json").write_text(json.dumps(_make_dg_response(["world"], speaker=1)))

        s = ReplaySession(session_id="multi-speaker", market=market)
        tp = TradeProcessor(s)
        s.trade_processor = tp

        stack, mock_tg = _enter_patches()
        try:
            for file_path in sorted(dg_dir.glob("dg_*.json")):
                data = json.loads(file_path.read_text())
                words = data["channel"]["alternatives"][0]["words"]
                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [
                    {"text": w["word"].lower(), "start": w["start"], "end": w["end"],
                     "confidence": round(w.get("confidence", 0), 3)}
                    for w in words
                ]
                await tp.process_tokens(formatted_tokens, speaker_id=speaker_id)
        finally:
            stack.close()

        assert len(s.transcript["0"]) == 1
        assert len(s.transcript["1"]) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Smoke test with real s3 data
# ═══════════════════════════════════════════════════════════════════════════════

class TestWithFixtureData:
    """Process committed Deepgram responses from tests/fixtures/replay/."""

    @pytest.fixture
    def real_dg_dir(self):
        dg_dir = Path(__file__).parent / "fixtures" / "replay" / "deepgram_responses"
        if not dg_dir.exists():
            pytest.skip("test fixture directory not found")
        return dg_dir

    @pytest.mark.asyncio
    async def test_processes_real_data_without_errors(self, real_dg_dir, market):
        """Run the full pipeline on real DG files — must not raise."""
        s = ReplaySession(session_id="real-test", market=market)
        tp = TradeProcessor(s)
        s.trade_processor = tp

        response_files = sorted(real_dg_dir.glob("dg_*.json"))

        stack, mock_tg = _enter_patches()
        try:
            for file_path in response_files:
                data = json.loads(file_path.read_text())

                if data.get("type") != "Results":
                    continue
                if not data.get("is_final", False):
                    continue
                channel = data.get("channel", {})
                alternatives = channel.get("alternatives", [])
                if not alternatives:
                    continue
                alt = alternatives[0]
                words = alt.get("words", [])
                if not words:
                    continue

                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [
                    {"text": w["word"].lower(), "start": w["start"], "end": w["end"],
                     "confidence": round(w.get("confidence", 0), 3)}
                    for w in words
                ]
                await tp.process_tokens(formatted_tokens, speaker_id=speaker_id)
        finally:
            stack.close()

        total_words = sum(len(tokens) for tokens in s.transcript.values())
        assert total_words > 0, "Real data should produce transcript output"

    def test_all_dg_files_are_valid_json(self, real_dg_dir):
        for file_path in real_dg_dir.glob("dg_*.json"):
            with open(file_path) as f:
                data = json.load(f)
            assert isinstance(data, dict), f"{file_path.name} is not a JSON object"
            assert "type" in data, f"{file_path.name} missing 'type'"
            assert "channel" in data, f"{file_path.name} missing 'channel'"

    def test_dg_file_structure_is_valid(self, real_dg_dir):
        """Validate every dg file conforms to expected structure."""
        for file_path in real_dg_dir.glob("dg_*.json"):
            with open(file_path) as f:
                data = json.load(f)
            assert "type" in data
            assert "channel" in data
            assert "is_final" in data
