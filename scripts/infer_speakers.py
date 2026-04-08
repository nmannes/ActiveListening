#!/usr/bin/env python3
import asyncio
import json
import argparse
import logging
from pathlib import Path
from pylib.speaker_recognition import SpeakerRecognitionSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("infer_speakers")

class MockSession:
    def __init__(self, transcript_data):
        self.transcript = {sid: [{"text": seg["text"]} for seg in segments] 
                          for sid, segments in transcript_data.items()}
        self.transcript_lock = asyncio.Lock()
        self.session_id = "test_session"

async def main():
    parser = argparse.ArgumentParser(description="Infer speaker identities from transcript using Bedrock")
    parser.add_argument("transcript_path", type=str, help="Path to transcript.json")
    parser.add_argument("--target", type=str, default="Wes Moore", help="Target speaker name")
    parser.add_argument("--region", type=str, default="us-east-1", help="AWS region")
    
    args = parser.parse_args()
    
    transcript_path = Path(args.transcript_path)
    if not transcript_path.exists():
        logger.error(f"Transcript file not found: {transcript_path}")
        return
        
    with open(transcript_path, "r") as f:
        transcript_data = json.load(f)
        
    session_mock = MockSession(transcript_data)
    rec_session = SpeakerRecognitionSession(session_mock, [args.target])
    rec_session.transcript_recognizer.region_name = args.region
    
    logger.info(f"Inferring identities for transcript: {transcript_path}")
    await rec_session.run_identity_inference()
    
    print("\nFinal Identity Mapping:")
    print(json.dumps(rec_session.profile_labels, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
