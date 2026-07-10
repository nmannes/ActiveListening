import asyncio
import json
import unittest
import sys
from unittest.mock import MagicMock, patch

# Mock nemo before importing pylib.speaker_recognition
mock_nemo = MagicMock()
sys.modules["nemo"] = mock_nemo
sys.modules["nemo.collections"] = mock_nemo
sys.modules["nemo.collections.asr"] = mock_nemo
sys.modules["nemo.collections.asr.models"] = mock_nemo
sys.modules["omegaconf"] = MagicMock()

from pylib.speaker_recognition import TranscriptSpeakerRecognizer, SpeakerRecognitionSession
from pylib.speaker_policy import InferencePolicy

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
            mock_trade_processor.add_trading_speaker.assert_called_once_with("0")
            mock_websocket.send.assert_called_once()
            self.assertGreaterEqual(mock_send_telegram.call_count, 1)

    async def test_audio_identification_reaches_stability(self):
        """Voice ID should become stable after 3 consistent rounds."""
        session = self._make_audio_session()

        with patch("pylib.speaker_recognition.send_telegram"), \
             patch("pylib.speaker_recognition.send_telegram_audio"):
            rec_session = SpeakerRecognitionSession(
                session, ["Wes Moore"],
                speaker_identifier=session.server.speaker_identifier,
            )
            self.assertEqual(rec_session.policy.word_step, 300)  # voice_mode

            # Round 1: identify speaker 0
            await rec_session.run_identity_inference()
            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")
            self.assertFalse(rec_session.policy.is_stable)
            self.assertEqual(len(rec_session.policy.history), 1)

            # Round 2: speaker 0 already labeled, skipped — same mapping returned
            await rec_session.run_identity_inference()
            self.assertFalse(rec_session.policy.is_stable)
            self.assertEqual(len(rec_session.policy.history), 2)

            # Round 3: same mapping → stability triggered
            await rec_session.run_identity_inference()
            self.assertTrue(rec_session.policy.is_stable)
            self.assertEqual(len(rec_session.policy.history), 3)

    async def test_audio_identification_gated_after_stability(self):
        """Once stable, run_identity_inference should return early without adding history."""
        session = self._make_audio_session()

        with patch("pylib.speaker_recognition.send_telegram"), \
             patch("pylib.speaker_recognition.send_telegram_audio"):
            rec_session = SpeakerRecognitionSession(
                session, ["Wes Moore"],
                speaker_identifier=session.server.speaker_identifier,
            )
            self.assertEqual(rec_session.policy.word_step, 300)  # voice_mode

            # Reach stability
            for _ in range(3):
                await rec_session.run_identity_inference()

            self.assertTrue(rec_session.policy.is_stable)
            history_len = len(rec_session.policy.history)

            # 4th call should be gated by is_stable
            await rec_session.run_identity_inference()
            self.assertEqual(len(rec_session.policy.history), history_len)

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
            self.assertEqual(rec_session.policy.word_step, 300)  # voice_mode
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

class TestInferencePolicy(unittest.TestCase):
    def test_defaults(self):
        p = InferencePolicy()
        self.assertEqual(p.interval_secs, 10)
        self.assertEqual(p.word_step, 500)
        self.assertEqual(p.max_words, 10000)
        self.assertEqual(p.max_duration_secs, 600)
        self.assertEqual(p.stability_rounds, 3)
        self.assertFalse(p.is_stable)
        self.assertEqual(p.history, [])
        self.assertEqual(p._last_word_count, 0)

    def test_should_run_word_gating(self):
        p = InferencePolicy(word_step=500, max_words=2000)
        self.assertFalse(p.should_run(0))
        self.assertFalse(p.should_run(499))
        self.assertTrue(p.should_run(500))
        self.assertTrue(p.should_run(1000))
        p.mark_ran(1000)
        self.assertFalse(p.should_run(1001))
        self.assertTrue(p.should_run(1500))

    def test_should_run_respects_max_words(self):
        p = InferencePolicy(word_step=500, max_words=2000)
        self.assertFalse(p.should_run(2000))
        self.assertFalse(p.should_run(3000))

    def test_duration_gating(self):
        p = InferencePolicy(max_duration_secs=60)
        self.assertFalse(p.is_duration_exceeded(0))
        self.assertFalse(p.is_duration_exceeded(59))
        self.assertTrue(p.is_duration_exceeded(60))
        self.assertTrue(p.is_duration_exceeded(120))

    def test_word_limit(self):
        p = InferencePolicy(max_words=5000)
        self.assertFalse(p.is_word_limit_reached(4999))
        self.assertTrue(p.is_word_limit_reached(5000))

    def test_mark_ran_updates_word_count(self):
        p = InferencePolicy(word_step=500)
        self.assertEqual(p._last_word_count, 0)
        p.mark_ran(750)
        self.assertEqual(p._last_word_count, 750)

    def test_stability_not_reached_with_fewer_than_n_rounds(self):
        p = InferencePolicy(stability_rounds=3)
        mapping = {"0": "Alice", "1": "advertisement"}
        result = p.record_result(mapping, ["Alice"])
        self.assertFalse(result)
        self.assertFalse(p.is_stable)
        result = p.record_result(mapping, ["Alice"])
        self.assertFalse(result)
        self.assertFalse(p.is_stable)

    def test_stability_reached_on_third_consistent_round(self):
        p = InferencePolicy(stability_rounds=3)
        mapping = {"0": "Alice", "1": "advertisement"}
        p.record_result(mapping, ["Alice"])
        p.record_result(mapping, ["Alice"])
        result = p.record_result(mapping, ["Alice"])
        self.assertTrue(result)
        self.assertTrue(p.is_stable)

    def test_stability_resets_on_inconsistent_result(self):
        p = InferencePolicy(stability_rounds=3)
        p.record_result({"0": "Alice"}, ["Alice"])
        p.record_result({"0": "Alice"}, ["Alice"])
        p.record_result({"0": "Bob"}, ["Bob"])
        self.assertFalse(p.is_stable)

    def test_stability_requires_market_entity_match(self):
        p = InferencePolicy(stability_rounds=3)
        mapping = {"0": "advertisement", "1": "advertisement"}
        p.record_result(mapping, ["Alice"])
        p.record_result(mapping, ["Alice"])
        result = p.record_result(mapping, ["Alice"])
        self.assertFalse(result)
        self.assertFalse(p.is_stable)

    def test_stability_with_custom_rounds(self):
        p = InferencePolicy(stability_rounds=2)
        mapping = {"0": "Alice"}
        p.record_result(mapping, ["Alice"])
        result = p.record_result(mapping, ["Alice"])
        self.assertTrue(result)
        self.assertTrue(p.is_stable)

    def test_voice_mode_values(self):
        p = InferencePolicy.voice_mode()
        self.assertEqual(p.interval_secs, 10)
        self.assertEqual(p.word_step, 300)
        self.assertEqual(p.max_words, 3000)
        self.assertEqual(p.max_duration_secs, 600)
        self.assertEqual(p.stability_rounds, 3)

    def test_inference_mode_values(self):
        p = InferencePolicy.inference_mode()
        self.assertEqual(p.interval_secs, 10)
        self.assertEqual(p.word_step, 500)
        self.assertEqual(p.max_words, 10000)
        self.assertEqual(p.max_duration_secs, 600)
        self.assertEqual(p.stability_rounds, 3)

    def test_for_entities_returns_voice_mode_when_sample_exists(self):
        identifier = MagicMock()
        identifier.has_sample_for.return_value = True
        p = InferencePolicy.for_entities(["Donald Trump"], identifier)
        self.assertEqual(p.word_step, 300)  # voice mode hallmark
        self.assertEqual(p.max_duration_secs, 600)

    def test_for_entities_returns_inference_mode_when_no_sample(self):
        identifier = MagicMock()
        identifier.has_sample_for.return_value = False
        p = InferencePolicy.for_entities(["Donald Trump"], identifier)
        self.assertEqual(p.word_step, 500)  # inference mode hallmark

    def test_for_entities_returns_inference_mode_when_identifier_is_none(self):
        p = InferencePolicy.for_entities(["Donald Trump"], None)
        self.assertEqual(p.word_step, 500)  # inference mode hallmark

    def test_for_entities_empty_entities_falls_back_to_inference(self):
        identifier = MagicMock()
        p = InferencePolicy.for_entities([], identifier)
        self.assertEqual(p.word_step, 500)  # any([]) = False


if __name__ == "__main__":
    unittest.main()
