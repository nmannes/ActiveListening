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

class MockServer:
    def __init__(self):
        self.speaker_identifier = None

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
        ) as mock_infer:
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
        with patch("pylib.speaker_recognition.send_telegram") as mock_send_telegram:
            await rec_session.run_identity_inference()
            
            # Verify profile labels and whitelist addition
            self.assertEqual(rec_session.profile_labels["0"], "Wes Moore")
            mock_trade_processor.add_trading_speaker.assert_called_once_with("0")
            mock_websocket.send.assert_called_once()
            mock_send_telegram.assert_called_once()

if __name__ == "__main__":
    unittest.main()
