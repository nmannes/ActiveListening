import os
import asyncio
import logging
import json
import sys
from pathlib import Path

# Ensure we can import from the current directory
sys.path.insert(0, os.getcwd())

from pylib.speaker_recognition import SpeakerRecognitionSession
from scripts.replay_session import ReplaySession, DiarizedTradeProcessor

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Test cases: (folder, target_speaker, expected_id_list)
TEST_CASES = [
    ("s3/maddow", "Rachel Maddow", ["2"]),
    ("s3/chris", "Chris Van Hollen", ["2"]),
    ("s3/mlb", "announcer", ["0", "1", "9"]), # MLB has multiple announcers
    ("s3/nba", "announcer", ["0", "1"]),
]

async def run_test(folder_path, target, expected_ids):
    logger.info(f"--- RUNNING TEST: {folder_path} (target: {target}) ---")
    
    recording_dir = Path(folder_path)
    dg_dir = recording_dir / "deepgram_responses"
    if not dg_dir.exists():
        logger.error(f"⏩ SKIP: {folder_path} directory not found")
        return True # Skip non-existent folders
        
    # Create session and trade processor (using real classes via ReplaySession)
    session = ReplaySession(session_id=recording_dir.name)
    trade_processor = DiarizedTradeProcessor(session)
    session.trade_processor = trade_processor
    
    # Process each Deepgram response
    response_files = sorted(dg_dir.glob("dg_*.json"))
    for file_path in response_files:
        with open(file_path, "r") as f:
            data = json.load(f)
        if data.get("type") != "Results" or not data.get("is_final", False):
            continue
            
        alt = data.get("channel", {}).get("alternatives", [{}])[0]
        words = alt.get("words", [])
        if not words:
            continue
            
        speaker_id = str(words[0].get("speaker", "0"))
        formatted_tokens = [{"text": w["word"].lower(), "start": w["start"], "end": w["end"]} for w in words]
        await trade_processor.process_tokens(formatted_tokens, speaker_id=speaker_id)
        
    # Aggregate transcripts
    speaker_texts = {}
    for sid, tokens in session.transcript.items():
        speaker_texts[sid] = " ".join([t["text"] for t in tokens])
        
    if not speaker_texts:
        logger.error(f"❌ FAIL: No transcripts collected for {folder_path}")
        return False
        
    # Run inference
    rec_session = SpeakerRecognitionSession(session, [target])
    mapping = await rec_session.transcript_recognizer.infer_identity_with_bedrock(
        speaker_texts, target
    )
    
    # Check results
    found_matches = [sid for sid, label in mapping.items() if label == target]
    
    passed = any(sid in expected_ids for sid in found_matches)
    
    if passed:
        logger.info(f"✅ PASS: Found {target} in speaker(s) {found_matches}")
        return True
    else:
        logger.error(f"❌ FAIL: Expected {expected_ids} to match {target}, but got {found_matches}")
        return False

async def main():
    logger.info("Starting Identity Inference Test Suite...")
    
    results = []
    for folder, target, expected in TEST_CASES:
        if not Path(folder).exists():
            logger.warning(f"⏩ SKIP: {folder} does not exist")
            continue
            
        success = await run_test(folder, target, expected)
        results.append(success)
        await asyncio.sleep(1) # Rate limit protection
        
    passed_count = sum(results)
    total_count = len(results)
    
    logger.info("======================================================================")
    logger.info(f"TEST SUMMARY: {passed_count}/{total_count} PASSED")
    logger.info("======================================================================")
    
    if passed_count < total_count:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
