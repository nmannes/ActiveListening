#!/usr/bin/env python3
"""
queue_worker.py — Long-running worker that processes jobs from Redis queues.

Queues consumed:
    queue:sample-generation   — voice sample generation (yt-dlp + VAD + cluster)
    queue:save-samples        — save approved samples to audio-library

The worker sends voice messages for verification and stores state in Redis.
The Telegram bot handles inline keyboard callbacks and enqueues save jobs.

Usage:
    python3 scripts/queue_worker.py [--debug]
"""

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from pylib.redis_queue import (
    dequeue,
    update_job,
    get_job,
    set_verification_state,
    get_all_verification_states,
    clear_verification_state,
)
from pylib.telegram import send_telegram_voice, send_telegram, build_inline_keyboard

# Import pipeline components from generate_samples
from scripts.generate_samples import (
    SampleGenerator,
    slugify,
    load_trust,
    get_trust_for,
    VAD,
    TitaNetEmbedder,
    search_and_download,
    save_to_library,
    AUDIO_LIBRARY,
    CALLBACK_PREFIX,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("queue_worker")


# ---------------------------------------------------------------------------
# Sample generation job
# ---------------------------------------------------------------------------

def process_sample_generation(job: dict):
    """Run the full sample generation pipeline, then send for verification."""
    payload = job["payload"]
    target = payload["target"]
    chat_id = payload.get("chat_id")
    slug = slugify(target)
    job_id = job["id"]

    update_job(job_id, status="active", stage="downloading")

    work_dir = Path(tempfile.mkdtemp(prefix=f"samples_{slug}_"))
    logger.info(f"[{job_id}] Working directory: {work_dir}")

    try:
        # 1. Download
        wav_paths = search_and_download(target, num_videos=5, max_duration=120, work_dir=work_dir)
        if not wav_paths:
            update_job(job_id, status="failed", error="No audio downloaded")
            send_telegram(f"❌ Failed to download audio for *{target}*")
            return

        # 2. VAD
        update_job(job_id, stage="vad")
        import librosa
        vad = VAD()
        raw_segments = []
        for wav_path in wav_paths:
            try:
                audio, sr = librosa.load(str(wav_path), sr=16000)
                if sr != 16000:
                    audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
                timestamps = vad.get_speech_segments(audio)

                # Merge adjacent segments
                max_gap_s = 1.5
                merged = []
                for ts in timestamps:
                    start_s, end_s = ts[0] / 16000, ts[1] / 16000
                    if merged and (start_s - merged[-1][1]) <= max_gap_s:
                        merged[-1] = (merged[-1][0], end_s)
                    else:
                        merged.append((start_s, end_s))

                for start_s, end_s in merged:
                    duration = end_s - start_s
                    if 4.0 <= duration <= 25.0:
                        start_sample = int(start_s * 16000)
                        end_sample = int(end_s * 16000)
                        raw_segments.append({
                            "audio": audio[start_sample:end_sample],
                            "duration": round(duration, 2),
                            "source": wav_path.name,
                        })
            except Exception as e:
                logger.error(f"[{job_id}] VAD failed for {wav_path.name}: {e}")

        if not raw_segments:
            update_job(job_id, status="failed", error="No speech segments found")
            send_telegram(f"❌ No speech segments found for *{target}*")
            return

        # 3. Embed
        update_job(job_id, stage="embedding")
        embedder = TitaNetEmbedder()
        for seg in raw_segments:
            try:
                seg["embedding"] = embedder.embed(seg["audio"])
            except Exception as e:
                seg["embedding"] = None
        embedded = [s for s in raw_segments if s.get("embedding") is not None]

        if not embedded:
            update_job(job_id, status="failed", error="No embeddings computed")
            send_telegram(f"❌ Failed to compute embeddings for *{target}*")
            return

        # 4-5. Cluster + score
        update_job(job_id, stage="clustering")
        gen = SampleGenerator(target=target)
        gen.embedder = embedder
        segments = gen.cluster_and_score(embedded)

        if not segments:
            update_job(job_id, status="failed", error="No target segments found")
            send_telegram(f"❌ No target voice segments found for *{target}*")
            return

        # 6. Save WAVs + embeddings to disk, convert to OGG for Telegram
        update_job(job_id, stage="converting")
        segments_dir = work_dir / "segments"
        segments_dir.mkdir(exist_ok=True)
        ogg_dir = work_dir / "ogg"
        ogg_dir.mkdir(exist_ok=True)

        for i, seg in enumerate(segments):
            # Save WAV to disk so the save job can find it later
            wav_path = segments_dir / f"{slug}_{i}.wav"
            emb_path = segments_dir / f"{slug}_{i}.embedding"
            sf.write(str(wav_path), seg["audio"], 16000)
            torch.save(seg["embedding"], str(emb_path))
            seg["wav_path"] = str(wav_path)
            seg["emb_path"] = str(emb_path)

            # Convert to OGG for Telegram voice message
            ogg_path = ogg_dir / f"{slug}_{i}.ogg"
            subprocess.run([
                "ffmpeg", "-y", "-i", str(wav_path),
                "-c:a", "libopus", "-b:a", "32k",
                "-ar", "16000", "-ac", "1",
                str(ogg_path),
            ], check=True, capture_output=True)
            seg["ogg_path"] = str(ogg_path)

        # 7. Apply trust preferences and send for verification
        update_job(job_id, stage="verification", segment_count=len(segments))
        trust_data = load_trust()
        auto_approve, threshold = get_trust_for(slug, trust_data)

        approved_idxs = []
        pending_count = 0

        for i, seg in enumerate(segments):
            seg["approved"] = None  # pending
            score = seg["score"]

            if auto_approve or score >= threshold:
                seg["approved"] = True
                approved_idxs.append(i)
                logger.info(f"[{job_id}] Segment {i} auto-approved (score={score:.3f})")
                continue

            # Store verification state in Redis for the bot
            set_verification_state(slug, i, {
                "target": target,
                "score": score,
                "duration": seg["duration"],
                "job_id": job_id,
                "ogg_path": seg["ogg_path"],
                "wav_path": seg["wav_path"],
                "emb_path": seg["emb_path"],
                "work_dir": str(work_dir),
                "approved": None,
            })

            # Send voice message with inline keyboard
            caption = (
                f"🎙️ {target} — sample {i + 1}/{len(segments)}\n"
                f"Confidence: {score:.3f} | Duration: {seg['duration']:.1f}s"
            )
            cb_approve = f"{CALLBACK_PREFIX}:approve:{i}"
            cb_reject = f"{CALLBACK_PREFIX}:reject:{i}"
            cb_auto_all = f"{CALLBACK_PREFIX}:auto_all:{i}"
            keyboard = build_inline_keyboard([
                [("✅ Approve", cb_approve), ("❌ Reject", cb_reject)],
                [("🤖 Auto-approve all remaining", cb_auto_all)],
            ])

            result = send_telegram_voice(seg["ogg_path"], caption=caption, reply_markup=keyboard)
            if result.get("ok"):
                pending_count += 1
                logger.info(f"[{job_id}] Sent segment {i} for verification (score={score:.3f})")
            else:
                logger.error(f"[{job_id}] Failed to send segment {i}: {result}")

        # Update job status
        status = "awaiting_verification" if pending_count > 0 else "complete"
        update_job(
            job_id,
            status=status,
            stage="done",
            segment_count=len(segments),
            auto_approved=len(approved_idxs),
            pending_verification=pending_count,
            slug=slug,
        )

        if pending_count == 0:
            # All auto-approved — save directly
            logger.info(f"[{job_id}] All {len(approved_idxs)} segments auto-approved, no verification needed")
            save_to_library_from_segments(segments, approved_idxs, slug, target)
            update_job(job_id, status="complete", saved=len(approved_idxs))
        else:
            send_telegram(
                f"🔍 *{target}* — {pending_count} segment(s) need verification\n"
                f"{len(approved_idxs)} auto-approved\n"
                f"Job: `{job_id}`"
            )

    except Exception as e:
        logger.exception(f"[{job_id}] Sample generation failed: {e}")
        update_job(job_id, status="failed", error=str(e))
        send_telegram(f"❌ Sample generation failed for *{target}*: {e}")

    finally:
        # Keep OGG files around for verification; clean up rest
        # (OGG files are in work_dir/ogg/, we clean up only after verification completes)
        pass


def save_to_library_from_segments(segments: list, approved_idxs: list, slug: str, target: str):
    """Save approved segments directly to audio-library."""
    AUDIO_LIBRARY.mkdir(parents=True, exist_ok=True)

    existing = sorted(AUDIO_LIBRARY.glob(f"{slug}*.wav"))
    next_idx = 0
    if existing:
        for p in existing:
            stem = p.stem
            if stem == slug:
                next_idx = max(next_idx, 1)
            elif stem.startswith(slug + "-"):
                try:
                    n = int(stem[len(slug) + 1:])
                    next_idx = max(next_idx, n + 1)
                except ValueError:
                    pass

    saved = 0
    for i in approved_idxs:
        seg = segments[i]
        suffix = f"-{next_idx}" if next_idx > 0 else ""
        wav_path = AUDIO_LIBRARY / f"{slug}{suffix}.wav"
        emb_path = AUDIO_LIBRARY / f"{slug}{suffix}.embedding"

        sf.write(str(wav_path), seg["audio"], 16000)
        torch.save(seg["embedding"], str(emb_path))

        logger.info(f"Saved {wav_path.name} (score={seg['score']:.3f}, duration={seg['duration']:.1f}s)")
        next_idx += 1
        saved += 1

    logger.info(f"Saved {saved} sample(s) to {AUDIO_LIBRARY}")
    send_telegram(
        f"📦 Samples saved for *{target}*\n"
        f"Saved {saved} segment(s) to `{AUDIO_LIBRARY}`\n"
        f"Score range: {min(segments[i]['score'] for i in approved_idxs):.3f} – "
        f"{max(segments[i]['score'] for i in approved_idxs):.3f}"
    )
    return saved


# ---------------------------------------------------------------------------
# Save samples job (triggered by bot after verification complete)
# ---------------------------------------------------------------------------

def process_save_samples(job: dict):
    """Copy approved segment WAVs + embeddings from work dir to audio-library."""
    payload = job["payload"]
    slug = payload["slug"]
    target = payload.get("target", slug.replace("-", " ").title())
    approved_idxs = payload["approved_indices"]
    job_id = job["id"]

    states = get_all_verification_states(slug)
    if not states:
        update_job(job_id, status="failed", error="No verification state found")
        send_telegram(f"❌ Failed to save samples for *{target}*: verification state expired")
        return

    AUDIO_LIBRARY.mkdir(parents=True, exist_ok=True)

    # Find next available suffix
    existing = sorted(AUDIO_LIBRARY.glob(f"{slug}*.wav"))
    next_idx = 0
    if existing:
        for p in existing:
            stem = p.stem
            if stem == slug:
                next_idx = max(next_idx, 1)
            elif stem.startswith(slug + "-"):
                try:
                    n = int(stem[len(slug) + 1:])
                    next_idx = max(next_idx, n + 1)
                except ValueError:
                    pass

    saved = 0
    for idx in sorted(approved_idxs):
        state = states.get(idx)
        if not state:
            logger.warning(f"No state for segment {idx}, skipping")
            continue

        wav_src = state.get("wav_path")
        emb_src = state.get("emb_path")

        if not wav_src or not Path(wav_src).exists():
            logger.warning(f"WAV file for segment {idx} not found: {wav_src}")
            continue

        suffix = f"-{next_idx}" if next_idx > 0 else ""
        wav_dest = AUDIO_LIBRARY / f"{slug}{suffix}.wav"
        emb_dest = AUDIO_LIBRARY / f"{slug}{suffix}.embedding"

        shutil.copy2(wav_src, wav_dest)
        if emb_src and Path(emb_src).exists():
            shutil.copy2(emb_src, emb_dest)
        else:
            # Compute embedding from the WAV
            import librosa
            embedder = TitaNetEmbedder()
            audio, _ = librosa.load(wav_dest, sr=16000)
            emb = embedder.embed(audio)
            torch.save(emb, str(emb_dest))

        logger.info(f"Saved {wav_dest.name} (score={state.get('score', '?')})")
        next_idx += 1
        saved += 1

    # Cleanup work directory
    work_dir = states[approved_idxs[0]].get("work_dir") if approved_idxs else None
    if work_dir and Path(work_dir).exists():
        shutil.rmtree(work_dir, ignore_errors=True)
        logger.info(f"Cleaned up {work_dir}")

    clear_verification_state(slug)
    update_job(job_id, status="complete", saved_count=saved)

    send_telegram(
        f"📦 Samples saved for *{target}*\n"
        f"Saved {saved}/{len(approved_idxs)} segment(s) to `{AUDIO_LIBRARY}`"
    )


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Redis queue worker")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("Queue worker starting …")

    # Map queue names to handler functions
    handlers = {
        "sample-generation": process_sample_generation,
        "save-samples": process_save_samples,
    }

    while True:
        # Check all queues, blocking on each for a short time
        for queue_name, handler in handlers.items():
            job = dequeue(queue_name, timeout=1)
            if job:
                logger.info(f"Processing {queue_name} job {job['id']}: {job.get('payload', {}).get('type')}")
                try:
                    handler(job)
                except Exception as e:
                    logger.exception(f"Job {job['id']} failed: {e}")
                    update_job(job["id"], status="failed", error=str(e))

        time.sleep(0.5)


if __name__ == "__main__":
    main()
