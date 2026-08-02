import asyncio
import json
import unittest
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Mock nemo and boto3 before importing pylib.speaker_recognition
mock_nemo = MagicMock()
sys.modules["nemo"] = mock_nemo
sys.modules["nemo.collections"] = mock_nemo
sys.modules["nemo.collections.asr"] = mock_nemo
sys.modules["nemo.collections.asr.models"] = mock_nemo
sys.modules["omegaconf"] = MagicMock()
mock_boto3 = MagicMock()
sys.modules["boto3"] = mock_boto3

from pylib.speaker_recognition import TranscriptSpeakerRecognizer, SpeakerRecognitionSession
from pylib.speaker_policy import InferencePolicy, SpeakerRecognitionLoop
from pylib.replay_runner import ReplayRunner, ReplaySession, TradeSignal

class MockIdentifier:
    def __init__(self):
        self.references = {}  # empty → no voice samples, falls through to Bedrock

class MockServer:
    def __init__(self):
        self.speaker_identifier = MockIdentifier()

class MockSession:
    def __init__(self):
        self.transcript = {
            "0": [{"text": "Hello, I am Wes Moore and today we are talking about Maryland."}],
            "1": [{"text": "Buy this amazing product for only $19.99!"}]
        }
        self.transcript_lock = asyncio.Lock()
        self.session_id = "test_session"
        self.server = MockServer()

class TestBedrockInference(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self._tg_patch = patch("pylib.speaker_recognition.send_telegram")
        self._tga_patch = patch("pylib.speaker_recognition.send_telegram_audio")
        self._tg_patch.start()
        self._tga_patch.start()

    def tearDown(self):
        self._tg_patch.stop()
        self._tga_patch.stop()

    async def test_infer_identity_with_bedrock_mock(self):
        session = MockSession()
        recognizer = TranscriptSpeakerRecognizer(session)
        
        # Mock boto3 client and invoke_model
        mock_bedrock = MagicMock()
        
        # Mock response body
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps({
            "output": {
                "message": {
                    "content": [
                        {
                            "text": '{"0": "Wes Moore", "1": "advertisement"}'
                        }
                    ]
                }
            }
        }).encode('utf-8')
        
        mock_bedrock.invoke_model.return_value = {"body": mock_body}
        
        with patch("boto3.client", return_value=mock_bedrock):
            mapping = await recognizer.infer_identity_with_bedrock(
                [("0", "Hello, I am Wes Moore"), ("1", "Buy now!")], 
                "Wes Moore"
            )
            
            self.assertEqual(mapping["0"], "Wes Moore")
            self.assertEqual(mapping["1"], "advertisement")
            mock_bedrock.invoke_model.assert_called_once()

    async def test_run_identity_inference(self):
        session = MockSession()
        rec_session = SpeakerRecognitionSession(session, ["Wes Moore"])

        # Mock the internal call to bedrock
        mock_mapping = {"0": "Wes Moore", "1": "advertisement"}

        with patch.object(
            TranscriptSpeakerRecognizer,
            "infer_identity_with_bedrock",
            return_value=mock_mapping
        ) as mock_infer, \
             patch("pylib.speaker_recognition.send_telegram"), \
             patch("pylib.speaker_recognition.send_telegram_audio"):
            await rec_session.run_identity_inference()

            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")
            self.assertEqual(rec_session.profile_labels["1"], "advertisement")
            mock_infer.assert_called_once()

    async def test_run_audio_identification(self):
        from unittest.mock import AsyncMock
        session = MockSession()
        
        # Mock AudioProcessor and audio_dir
        mock_audio_processor = MagicMock()
        mock_audio_dir = MagicMock()
        mock_wav_path = MagicMock()
        mock_wav_path.name = "speaker_0.wav"
        mock_wav_path.stem = "speaker_0"
        mock_wav_path.absolute.return_value = mock_wav_path
        mock_wav_path.stat.return_value.st_size = 16000  # bytes

        mock_audio_dir.glob.return_value = [mock_wav_path]
        mock_audio_processor._audio_dir = mock_audio_dir
        session.audio_processor = mock_audio_processor

        # Mock SpeakerIdentifier
        mock_identifier = MagicMock()
        mock_identifier._ready = True
        mock_identifier.references = {"wes-moore": None}  # matches entity slug so audio path is taken
        mock_identifier.identify_file = AsyncMock(return_value=(["wes-moore"], {"wes-moore": 0.85}))
        session.server.speaker_identifier = mock_identifier

        # Mock websocket
        mock_websocket = AsyncMock()
        session.websocket = mock_websocket

        # Mock trade_processor
        mock_trade_processor = MagicMock()
        session.trade_processor = mock_trade_processor

        rec_session = SpeakerRecognitionSession(session, ["Wes Moore"])
        
        # We patch send_telegram in pylib.speaker_recognition so it doesn't try to call actual telegram API
        with patch("pylib.speaker_recognition.send_telegram") as mock_send_telegram, \
             patch("pylib.speaker_recognition.send_telegram_audio") as mock_send_telegram_audio:
            await rec_session.run_identity_inference()

            # Verify profile labels and whitelist addition
            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")
            mock_trade_processor.add_trading_speaker.assert_called_once_with("0", market_indices=None)
            mock_websocket.send.assert_called_once()
            self.assertGreaterEqual(mock_send_telegram.call_count, 1)

    async def test_audio_identification_no_wav_files_returns_empty_mapping(self):
        """When no WAV files exist, _run_audio_identification returns a dict (not bool)."""
        session = self._make_audio_session()
        mock_audio_dir = session.audio_processor._audio_dir
        mock_audio_dir.glob.return_value = []  # no WAV files yet

        with patch("pylib.speaker_recognition.send_telegram"), \
             patch("pylib.speaker_recognition.send_telegram_audio"):
            rec_session = SpeakerRecognitionSession(
                session, ["Wes Moore"],
                speaker_identifier=session.server.speaker_identifier,
            )
            mapping = await rec_session._run_audio_identification(
                {"wes-moore": "Wes Moore"}
            )
            self.assertIsInstance(mapping, dict)
            self.assertEqual(mapping, {})

    @staticmethod
    def _make_audio_session():
        """Build a MockSession wired for audio identification."""
        from unittest.mock import AsyncMock
        session = MockSession()

        mock_audio_processor = MagicMock()
        mock_audio_dir = MagicMock()
        mock_wav_path = MagicMock()
        mock_wav_path.name = "speaker_0.wav"
        mock_wav_path.stem = "speaker_0"
        mock_wav_path.absolute.return_value = mock_wav_path
        mock_wav_path.stat.return_value.st_size = 16000  # bytes

        mock_audio_dir.glob.return_value = [mock_wav_path]
        mock_audio_processor._audio_dir = mock_audio_dir
        session.audio_processor = mock_audio_processor

        mock_identifier = MagicMock()
        mock_identifier._ready = True
        mock_identifier.references = {"wes-moore": None}
        mock_identifier.has_sample_for = MagicMock(return_value=True)
        mock_identifier.identify_file = AsyncMock(
            return_value=(["wes-moore"], {"wes-moore": 0.85})
        )
        session.server.speaker_identifier = mock_identifier

        mock_websocket = AsyncMock()
        session.websocket = mock_websocket

        mock_trade_processor = MagicMock()
        session.trade_processor = mock_trade_processor

        return session

    # ── WAV growth re-identification ─────────────────────────────────

    async def test_reidentify_when_wav_grows_by_50_percent(self):
        """Speaker should be re-identified when their WAV grows >= 50%."""
        session = self._make_audio_session()

        with patch("pylib.speaker_recognition.send_telegram"), \
             patch("pylib.speaker_recognition.send_telegram_audio"):
            rec_session = SpeakerRecognitionSession(
                session, ["Wes Moore"],
                speaker_identifier=session.server.speaker_identifier,
            )

            # Round 1: identify speaker 0 (file size: 16000 bytes)
            await rec_session.run_identity_inference()
            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")

            # Simulate WAV growth: 16000 -> 32000 bytes (100% growth)
            session.audio_processor._audio_dir.glob.return_value[0].stat.return_value.st_size = 32000

            # Round 2: WAV grew by >= 50%, speaker should be re-identified
            # Change the match to verify re-identification actually ran
            session.server.speaker_identifier.identify_file.return_value = (
                ["wes-moore"], {"wes-moore": 0.92}
            )
            await rec_session.run_identity_inference()
            # Still labeled, and identify_file was called again (2nd call)
            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")
            self.assertEqual(
                session.server.speaker_identifier.identify_file.call_count, 2
            )

    async def test_skip_when_wav_has_not_grown_enough(self):
        """Speaker should NOT be re-identified when WAV growth < 50%."""
        session = self._make_audio_session()

        with patch("pylib.speaker_recognition.send_telegram"), \
             patch("pylib.speaker_recognition.send_telegram_audio"):
            rec_session = SpeakerRecognitionSession(
                session, ["Wes Moore"],
                speaker_identifier=session.server.speaker_identifier,
            )

            # Round 1: identify speaker 0 (file size: 16000 bytes)
            await rec_session.run_identity_inference()
            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")

            # Simulate small WAV growth: 16000 -> 20000 bytes (25% growth)
            session.audio_processor._audio_dir.glob.return_value[0].stat.return_value.st_size = 20000

            # Round 2: WAV grew by only 25%, speaker should be skipped
            await rec_session.run_identity_inference()
            # identify_file should still have been called only once
            self.assertEqual(
                session.server.speaker_identifier.identify_file.call_count, 1
            )


class TestInferencePolicy(unittest.TestCase):
    def test_defaults(self):
        p = InferencePolicy()
        self.assertEqual(p.interval_secs, 10)
        self.assertEqual(p.max_duration_secs, 1200)

    def test_duration_gating(self):
        p = InferencePolicy(max_duration_secs=60)
        self.assertFalse(p.is_duration_exceeded(0))
        self.assertFalse(p.is_duration_exceeded(59))
        self.assertFalse(p.is_duration_exceeded(60))  # boundary: still within duration
        self.assertTrue(p.is_duration_exceeded(61))
        self.assertTrue(p.is_duration_exceeded(120))

    def test_custom_values(self):
        p = InferencePolicy(interval_secs=5, max_duration_secs=3600)
        self.assertEqual(p.interval_secs, 5)
        self.assertEqual(p.max_duration_secs, 3600)


class TestSpeakerRecognitionLoop(unittest.IsolatedAsyncioTestCase):
    """Test loop timing behavior with injectable clock and no-op sleep."""

    @staticmethod
    def _fake_clock(start=0, step=10):
        """Return a clock that advances by *step* seconds each call."""
        t = [start]
        def tick():
            now = t[0]
            t[0] += step
            return now
        return tick

    async def test_fires_n_times_for_interval_and_duration(self):
        """With interval=10, duration=55: fires at 10,20,30,40,50 → 5 times."""
        policy = InferencePolicy(interval_secs=10, max_duration_secs=55)
        calls = []
        async def run_fn():
            calls.append(1)

        loop = SpeakerRecognitionLoop(
            policy, run_fn,
            clock=self._fake_clock(step=10),
            sleep=lambda _: asyncio.sleep(0),
        )
        await loop.run()
        self.assertEqual(len(calls), 5)

    async def test_fires_zero_times_when_duration_less_than_interval(self):
        """Duration 5 < interval 10 → loop exits before first fire."""
        policy = InferencePolicy(interval_secs=10, max_duration_secs=5)
        calls = []
        async def run_fn():
            calls.append(1)

        loop = SpeakerRecognitionLoop(
            policy, run_fn,
            clock=self._fake_clock(step=10),
            sleep=lambda _: asyncio.sleep(0),
        )
        await loop.run()
        self.assertEqual(len(calls), 0)

    async def test_fires_once_when_duration_equals_interval(self):
        """Duration 10 == interval 10 → fires exactly once."""
        policy = InferencePolicy(interval_secs=10, max_duration_secs=10)
        calls = []
        async def run_fn():
            calls.append(1)

        loop = SpeakerRecognitionLoop(
            policy, run_fn,
            clock=self._fake_clock(step=10),
            sleep=lambda _: asyncio.sleep(0),
        )
        await loop.run()
        self.assertEqual(len(calls), 1)

    async def test_fires_n_times_with_remainder(self):
        """Duration 65 with interval 10: fires at 10,20,30,40,50,60 → 6 times."""
        policy = InferencePolicy(interval_secs=10, max_duration_secs=65)
        calls = []
        async def run_fn():
            calls.append(1)

        loop = SpeakerRecognitionLoop(
            policy, run_fn,
            clock=self._fake_clock(step=10),
            sleep=lambda _: asyncio.sleep(0),
        )
        await loop.run()
        self.assertEqual(len(calls), 6)

    async def test_does_not_fire_at_time_zero(self):
        """run_fn should NOT be called at t=0 — first fire is after one interval.

        With interval=10 and duration=30 we get 3 firings (at 10, 20, 30).
        If run_fn fired at t=0 we'd see 4 firings.
        """
        policy = InferencePolicy(interval_secs=10, max_duration_secs=30)
        calls = []
        async def run_fn():
            calls.append(1)

        loop = SpeakerRecognitionLoop(
            policy, run_fn,
            clock=self._fake_clock(step=10),
            sleep=lambda _: asyncio.sleep(0),
        )
        await loop.run()
        self.assertEqual(len(calls), 3)


class TestReplayRunner(unittest.IsolatedAsyncioTestCase):
    """Test ReplayRunner with synthetic Deepgram responses."""

    def setUp(self):
        self._tg_patch = patch("pylib.speaker_recognition.send_telegram")
        self._tga_patch = patch("pylib.speaker_recognition.send_telegram_audio")
        self._tg_patch.start()
        self._tga_patch.start()

    def tearDown(self):
        self._tg_patch.stop()
        self._tga_patch.stop()

    @staticmethod
    def _make_dg_response(speaker_id, words_data, is_final=True):
        """Build a minimal Deepgram response dict."""
        words = []
        for word, start, end in words_data:
            words.append({
                "word": word, "start": start, "end": end,
                "confidence": 0.9, "speaker": speaker_id,
            })
        return {
            "type": "Results",
            "is_final": is_final,
            "channel": {
                "alternatives": [{
                    "transcript": " ".join(w["word"] for w in words),
                    "words": words,
                }]
            }
        }

    @staticmethod
    def _make_dg_dir(tmpdir, responses):
        """Create a deepgram_responses/ directory with numbered dg_*.json files."""
        dg_dir = tmpdir / "deepgram_responses"
        dg_dir.mkdir()
        for i, resp in enumerate(responses):
            (dg_dir / f"dg_{i:04d}.json").write_text(json.dumps(resp))
        return dg_dir

    async def test_replay_produces_firings_at_correct_times(self):
        """With interval=10, duration=60, tokens spanning 0-25s → 2 firings at t=10,20."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # Tokens from two speakers spanning 0-25 seconds
            responses = [
                self._make_dg_response(0, [("hello", 0.0, 0.5), ("world", 0.5, 1.0)]),
                self._make_dg_response(0, [("i", 5.0, 5.3), ("am", 5.3, 5.6), ("alice", 5.6, 6.0)]),
                self._make_dg_response(1, [("hi", 12.0, 12.3), ("im", 12.3, 12.6), ("bob", 12.6, 13.0)]),
                self._make_dg_response(0, [("welcome", 20.0, 20.5)]),
            ]
            self._make_dg_dir(tmp, responses)

            market = {"speakerEntities": ["Alice"], "title": "Test Event"}
            runner = ReplayRunner(tmp, market, interval_secs=10, max_duration_secs=60)
            result = await runner.run()

            # Firing schedule: t=10, 20, 30, 40, 50, 60
            # Tokens end at ~25s, so only t=10 and t=20 fire during token feeding
            # The remaining (30, 40, 50, 60) fire after
            self.assertEqual(len(result.firings), 6)
            self.assertAlmostEqual(result.firings[0].elapsed_secs, 10)
            self.assertAlmostEqual(result.firings[1].elapsed_secs, 20)
            self.assertGreater(result.firings[1].total_words,
                               result.firings[0].total_words)

    async def test_replay_zero_firings_when_duration_less_than_interval(self):
        """Duration 5 < interval 10 → no firings."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            responses = [
                self._make_dg_response(0, [("hello", 0.0, 0.5)]),
            ]
            self._make_dg_dir(tmp, responses)

            market = {"speakerEntities": ["Alice"]}
            runner = ReplayRunner(tmp, market, interval_secs=10, max_duration_secs=5)
            result = await runner.run()

            self.assertEqual(len(result.firings), 0)

    async def test_replay_accumulates_transcript_over_time(self):
        """Each firing should see more words as tokens accumulate."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # Tokens spread across time, each batch adds more words
            responses = [
                self._make_dg_response(0, [("alpha", 0.0, 0.5)]),
                self._make_dg_response(0, [("bravo", 8.0, 8.5)]),
                self._make_dg_response(0, [("charlie", 18.0, 18.5)]),
                self._make_dg_response(0, [("delta", 28.0, 28.5)]),
                self._make_dg_response(0, [("echo", 38.0, 38.5)]),
            ]
            self._make_dg_dir(tmp, responses)

            market = {"speakerEntities": ["Alice"]}
            runner = ReplayRunner(tmp, market, interval_secs=10, max_duration_secs=40)
            result = await runner.run()

            # Firings at 10, 20, 30, 40
            self.assertEqual(len(result.firings), 4)
            # Word count should be non-decreasing
            for i in range(1, len(result.firings)):
                self.assertGreaterEqual(
                    result.firings[i].total_words,
                    result.firings[i - 1].total_words,
                )

    async def test_replay_captures_signals_on_keyword_match(self):
        """Tokens matching market keywords produce TradeSignal entries."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # "blossom" is the last word of the keyword phrase
            responses = [
                self._make_dg_response(0, [("cherry", 5.0, 5.3), ("blossom", 5.3, 5.6)]),
            ]
            self._make_dg_dir(tmp, responses)

            market = {
                "speakerEntities": ["Alice"],
                "keywords": {"cherry blossom": "CHERRY-YES"},
            }
            runner = ReplayRunner(tmp, market, interval_secs=10, max_duration_secs=30)
            result = await runner.run()

            self.assertEqual(len(result.signals), 1)
            s = result.signals[0]
            self.assertEqual(s.keyword, "cherry blossom")
            self.assertEqual(s.ticker, "CHERRY-YES")
            self.assertEqual(s.speaker_id, "0")
            self.assertFalse(s.speaker_whitelisted)
            self.assertFalse(s.would_trade)
            self.assertEqual(s.blocked_by, "speaker_not_whitelisted")

    async def test_replay_signal_blocked_by_whitelist_then_passes(self):
        """Signal blocked before speaker identified, passes after."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            # Keyword spoken at t=5s and t=25s
            responses = [
                self._make_dg_response(0, [("cherry", 5.0, 5.3), ("blossom", 5.3, 5.6)]),
                self._make_dg_response(0, [("cherry", 25.0, 25.3), ("blossom", 25.3, 25.6)]),
            ]
            self._make_dg_dir(tmp, responses)

            market = {
                "speakerEntities": ["Alice"],
                "keywords": {"cherry blossom": "CHERRY-YES"},
            }
            runner = ReplayRunner(tmp, market, interval_secs=10, max_duration_secs=30)
            result = await runner.run()

            # Two signals: first at ~5s (blocked), second at ~25s (after firings)
            self.assertGreaterEqual(len(result.signals), 1)
            # First signal: speaker not whitelisted yet
            self.assertFalse(result.signals[0].speaker_whitelisted)
            self.assertEqual(result.signals[0].blocked_by, "speaker_not_whitelisted")

    async def test_e2e_identification_unblocks_signals(self):
        """Full pipeline: speaker identified mid-broadcast, later signals unblocked.

        Timeline (interval=10, duration=40):
          t=0-5s    speaker 0 says keyword → BLOCKED (not yet identified)
          t=10s     firing #1: Bedrock returns "0"→"Alice" → speaker whitelisted
          t=15s     speaker 0 says keyword → WOULD TRADE
          t=20,30,40s  firings #2-4
        """
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            responses = [
                # Before any firing: should be blocked
                self._make_dg_response(0, [("cherry", 3.0, 3.3), ("blossom", 3.3, 3.6)]),
                # After t=10 firing: should pass
                self._make_dg_response(0, [("cherry", 15.0, 15.3), ("blossom", 15.3, 15.6)]),
                # More words so the speaker is identifiable
                self._make_dg_response(0, [
                    ("hello", 7.0, 7.2), ("i", 7.2, 7.3), ("am", 7.3, 7.4),
                    ("alice", 7.4, 7.6), ("and", 7.6, 7.7), ("i", 7.7, 7.8),
                    ("approve", 7.8, 8.0), ("this", 8.0, 8.1), ("message", 8.1, 8.3),
                ]),
            ]
            self._make_dg_dir(tmp, responses)

            market = {
                "speakerEntities": ["Alice"],
                "keywords": {"cherry blossom": "CHERRY-YES"},
            }

            # Mock Bedrock to identify speaker 0 as Alice
            mock_mapping = {"0": "Alice"}
            with patch.object(
                TranscriptSpeakerRecognizer,
                "infer_identity_with_bedrock",
                return_value=mock_mapping,
            ):
                runner = ReplayRunner(tmp, market, interval_secs=10, max_duration_secs=40)
                result = await runner.run()

            # 4 firings at t=10, 20, 30, 40
            self.assertEqual(len(result.firings), 4)
            # Speaker identified as Alice by the end
            self.assertIn("0", result.profile_labels)
            self.assertEqual(result.profile_labels["0"], "Alice")
            self.assertIn("0", result.trading_speakers)

            # Two signals
            self.assertEqual(len(result.signals), 2)
            # First signal at ~3s: speaker 0 not yet whitelisted
            self.assertFalse(result.signals[0].speaker_whitelisted)
            self.assertEqual(result.signals[0].blocked_by, "speaker_not_whitelisted")
            # Second signal at ~15s: speaker 0 whitelisted at t=10 firing
            self.assertTrue(result.signals[1].speaker_whitelisted)
            self.assertTrue(result.signals[1].would_trade)
            self.assertEqual(result.signals[1].blocked_by, "trade_for_real_disabled")


    async def test_multi_market_keyword_routed_to_correct_speaker(self):
        """Two markets on one stream: each keyword only trades for its market's speaker.

        Market A: Bernie Sanders → "cherry blossom" = BERNIE-CHERRY
        Market B: Wes Moore    → "apple pie"      = MOORE-APPLE

        Timeline (interval=10, duration=30):
          t=3s    speaker 0 says "cherry blossom" → Bernie keyword, blocked (not whitelisted yet)
          t=10s   firing: Bedrock identifies speaker 0 as "Bernie Sanders"
          t=15s   speaker 0 says "cherry blossom" → Bernie keyword, Bernie speaking → would_trade
          t=17s   speaker 0 says "apple pie"      → Moore keyword, Bernie speaking → wrong_speaker_for_market
          t=20s   firing
        """
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            responses = [
                # t=3s: Bernie says his keyword (before identification)
                self._make_dg_response(0, [("cherry", 3.0, 3.3), ("blossom", 3.3, 3.6)]),
                # Extra words so Bedrock has context to identify speaker 0
                self._make_dg_response(0, [
                    ("hello", 6.0, 6.1), ("i", 6.1, 6.2), ("am", 6.2, 6.3),
                    ("bernie", 6.3, 6.5), ("sanders", 6.5, 6.8),
                    ("and", 6.8, 6.9), ("i", 6.9, 7.0),
                    ("approve", 7.0, 7.2), ("this", 7.2, 7.3), ("message", 7.3, 7.5),
                ]),
                # t=15s: Bernie says his keyword again (now that he's identified)
                self._make_dg_response(0, [("cherry", 15.0, 15.3), ("blossom", 15.3, 15.6)]),
                # t=17s: Bernie says Wes Moore's keyword → should be blocked!
                self._make_dg_response(0, [("apple", 17.0, 17.3), ("pie", 17.3, 17.6)]),
            ]
            self._make_dg_dir(tmp, responses)

            market_bernie = {
                "speakerEntities": ["Bernie Sanders"],
                "keywords": {"cherry blossom": "BERNIE-CHERRY"},
                "title": "What will Bernie say during Meet the Press?",
            }
            market_moore = {
                "speakerEntities": ["Wes Moore"],
                "keywords": {"apple pie": "MOORE-APPLE"},
                "title": "What will Wes Moore say during Meet the Press?",
            }
            markets = [market_bernie, market_moore]

            # Mock Bedrock to identify speaker 0 as Bernie Sanders
            mock_mapping = {"0": "Bernie Sanders"}
            with patch.object(
                TranscriptSpeakerRecognizer,
                "infer_identity_with_bedrock",
                return_value=mock_mapping,
            ):
                runner = ReplayRunner(
                    tmp, market_bernie, markets=markets,
                    interval_secs=10, max_duration_secs=30,
                )
                result = await runner.run()

            # Firings at t=10, 20, 30
            self.assertEqual(len(result.firings), 3)
            # Speaker identified as Bernie Sanders
            self.assertEqual(result.profile_labels.get("0"), "Bernie Sanders")
            self.assertIn("0", result.trading_speakers)

            # 3 signals: cherry@3s, cherry@15s, apple@17s
            self.assertEqual(len(result.signals), 3)

            # Signal 1: t=3s, Bernie keyword → blocked (not yet whitelisted)
            s0 = result.signals[0]
            self.assertEqual(s0.keyword, "cherry blossom")
            self.assertEqual(s0.ticker, "BERNIE-CHERRY")
            self.assertFalse(s0.speaker_whitelisted)
            self.assertEqual(s0.blocked_by, "speaker_not_whitelisted")

            # Signal 2: t=15s, Bernie keyword → Bernie IS whitelisted → would_trade
            s1 = result.signals[1]
            self.assertEqual(s1.keyword, "cherry blossom")
            self.assertEqual(s1.ticker, "BERNIE-CHERRY")
            self.assertTrue(s1.speaker_whitelisted)
            self.assertTrue(s1.would_trade)
            self.assertEqual(s1.blocked_by, "trade_for_real_disabled")

            # Signal 3: t=17s, Moore keyword → Bernie is whitelisted but for the
            # WRONG market → blocked by wrong_speaker_for_market
            s2 = result.signals[2]
            self.assertEqual(s2.keyword, "apple pie")
            self.assertEqual(s2.ticker, "MOORE-APPLE")
            self.assertTrue(s2.speaker_whitelisted)  # Bernie IS a trading speaker
            self.assertFalse(s2.would_trade)
            self.assertEqual(s2.blocked_by, "wrong_speaker_for_market")

    async def test_multi_market_shared_keyword_routes_to_speakers_market(self):
        """Shared keyword routes to the market whose speaker matches.

        Both markets have "shared word" as a keyword.
        Market A: Bernie Sanders → "shared word" = BERNIE-SHARED
        Market B: Wes Moore    → "shared word" = MOORE-SHARED

        When speaker 0 (identified as Bernie) says "shared word", only
        Bernie's market should trade.
        """
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            responses = [
                # t=3s: speaker 0 says shared word (before identification → blocked)
                self._make_dg_response(0, [("shared", 3.0, 3.3), ("word", 3.3, 3.6)]),
                # Words for identification
                self._make_dg_response(0, [
                    ("hello", 6.0, 6.1), ("i", 6.1, 6.2), ("am", 6.2, 6.3),
                    ("bernie", 6.3, 6.5), ("sanders", 6.5, 6.8),
                    ("and", 6.8, 6.9), ("i", 6.9, 7.0),
                    ("approve", 7.0, 7.2), ("this", 7.2, 7.3), ("message", 7.3, 7.5),
                ]),
                # t=15s: speaker 0 says shared word again (Bernie identified → would_trade)
                self._make_dg_response(0, [("shared", 15.0, 15.3), ("word", 15.3, 15.6)]),
            ]
            self._make_dg_dir(tmp, responses)

            market_bernie = {
                "speakerEntities": ["Bernie Sanders"],
                "keywords": {"shared word": "BERNIE-SHARED"},
                "title": "Bernie Market",
            }
            market_moore = {
                "speakerEntities": ["Wes Moore"],
                "keywords": {"shared word": "MOORE-SHARED"},
                "title": "Moore Market",
            }
            markets = [market_bernie, market_moore]

            mock_mapping = {"0": "Bernie Sanders"}
            with patch.object(
                TranscriptSpeakerRecognizer,
                "infer_identity_with_bedrock",
                return_value=mock_mapping,
            ):
                runner = ReplayRunner(
                    tmp, market_bernie, markets=markets,
                    interval_secs=10, max_duration_secs=30,
                )
                result = await runner.run()

            self.assertIn("0", result.trading_speakers)

            # 2 signals: shared@3s (blocked), shared@15s (would_trade)
            self.assertEqual(len(result.signals), 2)

            # First signal: speaker not yet identified → blocked
            self.assertFalse(result.signals[0].speaker_whitelisted)
            self.assertEqual(result.signals[0].blocked_by, "speaker_not_whitelisted")
            self.assertEqual(result.signals[0].ticker, "BERNIE-SHARED")

            self.assertTrue(result.signals[1].speaker_whitelisted)
            self.assertTrue(result.signals[1].would_trade)
            self.assertEqual(result.signals[1].ticker, "BERNIE-SHARED")

    async def test_multi_market_unique_keywords_each_speakers_own(self):
        """Each speaker's unique keyword only trades on their own market.

        Market A: Bernie Sanders -> "cherry blossom" = BERNIE-CHERRY
        Market B: Wes Moore    -> "apple pie"      = MOORE-APPLE

        Both speakers talk across all 4 combinations:
          Bernie says "cherry blossom" -> Bernie market
          Bernie says "apple pie"      -> Moore market, wrong speaker
          Moore says "apple pie"       -> Moore market, would_trade
          Moore says "cherry blossom"  -> Bernie market, wrong speaker
        """
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)

            responses = [
                # Speaker 0 (Bernie) says his keyword at t=2s
                self._make_dg_response(0, [("cherry", 2.0, 2.3), ("blossom", 2.3, 2.6)]),
                # Speaker 0 says Moore's keyword at t=4s -> wrong speaker
                self._make_dg_response(0, [("apple", 4.0, 4.3), ("pie", 4.3, 4.6)]),
                # Identity words for both speakers
                self._make_dg_response(0, [
                    ("hello", 6.0, 6.1), ("i", 6.1, 6.2), ("am", 6.2, 6.3),
                    ("bernie", 6.3, 6.5), ("sanders", 6.5, 6.8),
                ]),
                self._make_dg_response(1, [
                    ("hi", 7.0, 7.1), ("i", 7.1, 7.2), ("am", 7.2, 7.3),
                    ("wes", 7.3, 7.5), ("moore", 7.5, 7.8),
                ]),
                # Speaker 1 (Moore) says his keyword at t=16s
                self._make_dg_response(1, [("apple", 16.0, 16.3), ("pie", 16.3, 16.6)]),
                # Speaker 1 says Bernie's keyword at t=18s -> wrong speaker
                self._make_dg_response(1, [("cherry", 18.0, 18.3), ("blossom", 18.3, 18.6)]),
            ]
            self._make_dg_dir(tmp, responses)

            market_bernie = {
                "speakerEntities": ["Bernie Sanders"],
                "keywords": {"cherry blossom": "BERNIE-CHERRY"},
                "title": "Bernie Market",
            }
            market_moore = {
                "speakerEntities": ["Wes Moore"],
                "keywords": {"apple pie": "MOORE-APPLE"},
                "title": "Moore Market",
            }
            markets = [market_bernie, market_moore]

            mock_mapping = {"0": "Bernie Sanders", "1": "Wes Moore"}
            with patch.object(
                TranscriptSpeakerRecognizer,
                "infer_identity_with_bedrock",
                return_value=mock_mapping,
            ):
                runner = ReplayRunner(
                    tmp, market_bernie, markets=markets,
                    interval_secs=10, max_duration_secs=30,
                )
                result = await runner.run()

            # 4 signals covering all 4 speaker×keyword combinations
            self.assertEqual(len(result.signals), 4)

            # Signal 1: Bernie says "cherry blossom" (t=2s) -> blocked (not whitelisted yet)
            s0 = result.signals[0]
            self.assertEqual(s0.ticker, "BERNIE-CHERRY")
            self.assertFalse(s0.speaker_whitelisted)

            # Signal 2: Bernie says "apple pie" (t=4s) -> blocked (not whitelisted)
            s1 = result.signals[1]
            self.assertEqual(s1.ticker, "MOORE-APPLE")
            self.assertFalse(s1.speaker_whitelisted)

            # Signal 3: Moore says "apple pie" (t=16s, after identification)
            # -> would_trade (Moore is whitelisted and it's his keyword)
            s2 = result.signals[2]
            self.assertEqual(s2.ticker, "MOORE-APPLE")
            self.assertTrue(s2.speaker_whitelisted)
            self.assertTrue(s2.would_trade)
            self.assertEqual(s2.blocked_by, "trade_for_real_disabled")

            # Signal 4: Moore says "cherry blossom" (t=18s)
            # -> blocked: Moore is whitelisted but for the WRONG market
            s3 = result.signals[3]
            self.assertEqual(s3.ticker, "BERNIE-CHERRY")
            self.assertTrue(s3.speaker_whitelisted)
            self.assertFalse(s3.would_trade)
            self.assertEqual(s3.blocked_by, "wrong_speaker_for_market")


if __name__ == "__main__":
    unittest.main()
