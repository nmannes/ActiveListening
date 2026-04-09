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

async def run_inference(folder_path, target, log_file):
    msg = f"\n--- RUNNING INFERENCE: {folder_path} (target: {target}) ---\n"
    logger.info(msg.strip())
    log_file.write(msg)
    log_file.flush()
    
    recording_dir = Path(folder_path)
    dg_dir = recording_dir / "deepgram_responses"
    if not dg_dir.exists():
        msg = f"⏩ SKIP: {folder_path} (No deepgram_responses directory found)\n"
        logger.error(msg.strip())
        log_file.write(msg)
        return None
        
    # Create session and trade processor
    session = ReplaySession(session_id=recording_dir.name)
    trade_processor = DiarizedTradeProcessor(session)
    session.trade_processor = trade_processor
    
    # Process each Deepgram response
    response_files = sorted(dg_dir.glob("dg_*.json"))
    
    check_interval = 200
    matched = False
    final_mapping = None
    
    consecutive_stable_matches = 0
    REQUIRED_STABLE_CHECKS = 3

    for i, file_path in enumerate(response_files):
        try:
            with open(file_path, "r") as f:
                content = f.read().strip()
                if "\n{" in content:
                   content = content.split("\n{")[0] 
                data = json.loads(content)
        except Exception as e:
            logger.warning(f"⏩ SKIP corrupt JSON {file_path.name}: {e}")
            continue

        if data.get("type") == "Results" and data.get("is_final", False):
            alt = data.get("channel", {}).get("alternatives", [{}])[0]
            words = alt.get("words", [])
            if words:
                speaker_id = str(words[0].get("speaker", "0"))
                formatted_tokens = [{"text": w["word"].lower(), "start": w["start"], "end": w["end"]} for w in words]
                await trade_processor.process_tokens(formatted_tokens, speaker_id=speaker_id)
        
        # Periodic check
        if (i + 1) % check_interval == 0 or i == len(response_files) - 1:
            speaker_texts = {}
            for sid, tokens in session.transcript.items():
                speaker_texts[sid] = " ".join([t["text"] for t in tokens])
                
            if not speaker_texts:
                continue

            rec_session = SpeakerRecognitionSession(session, [target])
            logger.info(f"Chunk {i+1}/{len(response_files)}: Inferring identity for {len(speaker_texts)} speakers...")
            
            # Log the inputs passed to Bedrock
            log_file.write(f"--- BEDROCK INPUT (Chunk {i+1}) ---\n")
            log_file.write(f"Target: {target}\n")
            log_file.write("Speaker Texts:\n")
            for sid, text in speaker_texts.items():
                log_file.write(f"  [Speaker {sid}]: {text}\n")
            log_file.write("----------------------------------\n")
            log_file.flush()
            
            mapping = await rec_session.transcript_recognizer.infer_identity_with_bedrock(
                speaker_texts, target
            )
            
            # Log the Bedrock mapping output
            log_file.write(f"--- BEDROCK OUTPUT (Chunk {i+1}) ---\n")
            log_file.write(f"Mapping: {json.dumps(mapping, indent=2)}\n")
            log_file.write("-----------------------------------\n")
            log_file.flush()
            
            found_matches = [sid for sid, label in mapping.items() if label == target]
            if found_matches:
                # Check for single match expectations
                is_group = any(w in target.lower() for w in ["announcer", "contestants", "employee", "team"])
                
                if not is_group and len(found_matches) > 1:
                    msg = f"⚠️ WARNING: Expected a single match for named target '{target}', but Bedrock mapped multiple IDs: {found_matches}\n"
                    logger.warning(msg.strip())
                    log_file.write(msg)
                
                consecutive_stable_matches += 1
                msg = f"✅ FOUND at chunk {i+1} (Stable count: {consecutive_stable_matches}/{REQUIRED_STABLE_CHECKS}): Bedrock mapped {target} to speaker(s): {found_matches}\n"
                logger.info(msg.strip())
                log_file.write(msg)
                log_file.flush()
                
                final_mapping = mapping
                
                if consecutive_stable_matches >= REQUIRED_STABLE_CHECKS:
                    msg = f"🎉 Identity [{target}] is STABLE for {REQUIRED_STABLE_CHECKS} consecutive checks. Stopping further tracing for this session.\n"
                    logger.info(msg.strip())
                    log_file.write(msg)
                    log_file.flush()
                    matched = True
                    break
            else:
                consecutive_stable_matches = 0
                msg = f"⚠️ NO MATCH at chunk {i+1}: Bedrock could not find {target} yet.\n"
                logger.info(msg.strip())
                log_file.write(msg)
                log_file.flush()
                
    if not matched:
        msg = f"❌ END OF SESSION: Could not stably establish {target} after processing all {len(response_files)} files.\n"
        logger.info(msg.strip())
        log_file.write(msg)
        log_file.flush()
        
    return final_mapping

async def main():
    logger.info("Starting Identity Inference Over All S3 Sessions...")
    
    # Build a slug -> target speaker mapping from scheduled JSON files
    slug_to_speaker = {}
    scheduled_dir = Path("scheduled")
    if scheduled_dir.exists():
        for json_file in scheduled_dir.glob("*.json"):
            try:
                with open(json_file, "r") as f:
                    data = json.load(f)
                if data.get("speakerEntities"):
                    # Use the first speaker entity as the target target
                    slug_to_speaker[data.get("slug")] = data.get("speakerEntities")[0]
            except Exception as e:
                logger.error(f"Failed to read {json_file}: {e}")

    s3_dir = Path("s3")
    if not s3_dir.exists():
        logger.error("No 's3' directory found.")
        sys.exit(1)

    # Process all directories in s3/
    folders = [d for d in s3_dir.iterdir() if d.is_dir()]
    
    with open("identity_verification_results.log", "w") as log_file:
        for folder in sorted(folders):
            session_id = folder.name
            
            # Determine the matching slug
            slug = session_id.split("_")[0]
            
            target = slug_to_speaker.get(slug)
            if not target:
                target = slug_to_speaker.get(session_id)
                
            if not target:
                logger.warning(f"⏩ SKIP: {folder.name} (Could not determine target speaker from scheduled/*.json)")
                continue
                
            await run_inference(folder, target, log_file)
            await asyncio.sleep(1) # Rate limit protection for Bedrock

if __name__ == "__main__":
    asyncio.run(main())
