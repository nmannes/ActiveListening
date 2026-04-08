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

class MockSession:
    def __init__(self):
        self.transcript = {
            "0": [{"text": "Hello, I am Wes Moore and today we are talking about Maryland."}],
            "1": [{"text": "Buy this amazing product for only $19.99!"}]
        }
        self.transcript_lock = asyncio.Lock()
        self.session_id = "test_session"

class TestBedrockInference(unittest.IsolatedAsyncioTestCase):
    async def test_infer_identity_with_bedrock_mock(self):
        session = MockSession()
        recognizer = TranscriptSpeakerRecognizer(session)
        
        # Mock boto3 client and invoke_model
        mock_bedrock = MagicMock()
        
        # Mock response body
        mock_body = MagicMock()
        mock_body.read.return_value = json.dumps({
            "content": [
                {
                    "text": '{"0": "Wes Moore", "1": "advertisement"}'
                }
            ]
        }).encode('utf-8')
        
        mock_bedrock.invoke_model.return_value = {"body": mock_body}
        
        with patch("boto3.client", return_value=mock_bedrock):
            mapping = await recognizer.infer_identity_with_bedrock(
                {"0": "Hello, I am Wes Moore", "1": "Buy now!"}, 
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

if __name__ == "__main__":
    unittest.main()
