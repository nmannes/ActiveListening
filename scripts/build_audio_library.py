#!/usr/bin/env python3
"""
build_audio_library.py — Compiles labeled speaker samples into the audio-library/

Reads speaker_labels.json, maps identities to their .wav files in speakers.wav/,
and copies them into audio-library/ with a standardized slugified filename
for easy loading by SpeakerIdentifier.
"""

import json
import logging
import os
import re
import shutil
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
)
logger = logging.getLogger(__name__)

def slugify(name: str) -> str:
    """Convert an identity name to a filename-safe slug. e.g. 'Steve Bannon' -> 'steve-bannon'"""
    slug = name.lower().strip()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    return slug.strip('-')

def main():
    root_dir = Path(__file__).parent.parent
    import argparse
    import sys
    sys.path.append(str(root_dir))
    from server import Config

    config = Config(argparse.Namespace())

    labels_file = root_dir / "speaker_labels.json"
    speakers_dir = root_dir / "speakers.wav"
    output_dir = config.audio_library_path
    if not labels_file.exists():
        logger.error(f"Labels file not found: {labels_file}")
        return
        
    if not speakers_dir.exists():
        logger.error(f"Speakers directory not found: {speakers_dir}")
        return
        
    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    with open(labels_file, "r") as f:
        labels_data = json.load(f)
        
    # Map identity -> list of source wav files
    identity_sources = {}
    
    for session_id, speaker_map in labels_data.items():
        for speaker_id, identity in speaker_map.items():
            if not identity:
                continue
                
            slug = slugify(identity)
            # Find the corresponding wav file
            # Format: <session_id>_speaker_<speaker_id>.wav
            wav_filename = f"{session_id}_speaker_{speaker_id}.wav"
            wav_path = speakers_dir / wav_filename
            
            if not wav_path.exists():
                logger.warning(f"Audio file not found for {identity}: {wav_path}")
                continue
                
            if slug not in identity_sources:
                identity_sources[slug] = []
                
            identity_sources[slug].append(wav_path)
            
    logger.info(f"Found {len(identity_sources)} unique identities.")
    
    # Copy the largest file for each identity to audio-library/
    for slug, sources in identity_sources.items():
        # For simplicity and quality, pick the longest (largest size) file as the reference
        # Alternatively, we could concatenate them, but usually one good quality clip is sufficient.
        best_source = max(sources, key=lambda p: p.stat().st_size)
        
        dest_path = output_dir / f"{slug}.wav"
        shutil.copy2(best_source, dest_path)
        logger.info(f"Copied {best_source.name} -> {dest_path.name} (size: {best_source.stat().st_size} bytes)")
        
    logger.info(f"Successfully populated {output_dir} with {len(identity_sources)} reference samples.")

    # Pre-compute embeddings locally so we don't have to sync the .wav files
    logger.info("Pre-computing TitaNet embeddings for the library...")
    import asyncio
    import sys
    import librosa
    import torch
    # Add root dir to path so we can import pylib
    sys.path.append(str(root_dir))
    from pylib.speaker_identifier import SpeakerIdentifier
    
    async def compute_embeddings():
        identifier = SpeakerIdentifier(audio_library_path=output_dir, device="cpu")
        await identifier.initialize()
        
        loop = asyncio.get_running_loop()
        for wav_path in sorted(output_dir.glob("*.wav")):
            name = wav_path.stem
            emb_path = wav_path.with_suffix(".embedding")
            if emb_path.exists():
                logger.info(f"Embedding already exists for {name}, skipping.")
                continue
                
            logger.info(f"Computing reference embedding from wav: {name}")
            try:
                audio = await loop.run_in_executor(
                    None, lambda p=wav_path: librosa.load(str(p), sr=16000)[0]
                )
                emb = await identifier._embed(audio)
                if emb is not None:
                    await loop.run_in_executor(
                        None, lambda p=emb_path, t=emb: torch.save(t, str(p))
                    )
                    logger.info(f"Saved pre-computed embedding to {emb_path}")
            except Exception as e:
                logger.error(f"Failed to compute/save embedding for {name}: {e}")

    asyncio.run(compute_embeddings())
    logger.info("Embeddings successfully pre-computed.")

    # Sync pre-computed embeddings to S3 speaker_embeddings folder
    logger.info("Syncing pre-computed embeddings to S3...")
    try:
        import boto3
        bucket = os.environ.get("S3_BUCKET", "recordings-846345203908-us-east-1-an")
        s3 = boto3.client("s3")
        
        local_files = sorted(output_dir.glob("*.embedding"))
        
        resp = s3.list_objects_v2(Bucket=bucket, Prefix="speaker_embeddings/")
        contents = resp.get("Contents", [])
        s3_keys = [obj.get("Key", "") for obj in contents if obj.get("Key", "").endswith(".embedding")]
        
        logger.info(f"Local embedding count: {len(local_files)} | S3 embedding count: {len(s3_keys)}")
        if len(local_files) == len(s3_keys):
            logger.info("Counts match up. Skipping S3 sync upload.")
        else:
            upload_count = 0
            for emb_path in local_files:
                filename = emb_path.name
                key = f"speaker_embeddings/{filename}"
                logger.info(f"Uploading {filename} to s3://{bucket}/{key}...")
                s3.upload_file(str(emb_path), bucket, key)
                upload_count += 1
            logger.info(f"Successfully synced {upload_count} embedding(s) to S3.")
    except Exception as e:
        logger.error(f"Failed to sync embeddings to S3: {e}")

if __name__ == "__main__":
    main()
