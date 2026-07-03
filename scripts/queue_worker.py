#!/usr/bin/env python
"""
queue_worker.py — BullMQ Worker for sample-generation and save-samples queues.

Usage:
    python scripts/queue_worker.py [--debug]
"""

import argparse
import asyncio
import functools
import json
import logging
import os
import shutil
import signal
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

from bullmq import Worker

from pylib.verification_state import (
    set_verification_state,
    get_all_verification_states,
    clear_verification_state,
    update_verification_state,
)
from pylib.telegram import send_telegram_voice, send_telegram, build_inline_keyboard

from scripts.generate_samples import (
    SampleGenerator,
    slugify,
    load_trust,
    get_trust_for,
    VAD,
    TitaNetEmbedder,
    search_and_download,
    download_from_urls,
    AUDIO_LIBRARY,
    CALLBACK_PREFIX,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).resolve().parent.parent / "logs" / "generate-samples.log"),
    ],
)
logger = logging.getLogger("queue_worker")


# ---------------------------------------------------------------------------
# S3 upload
# ---------------------------------------------------------------------------

S3_BUCKET = os.environ.get("S3_BUCKET", "recordings-846345203908-us-east-1-an")

try:
    import boto3
    _s3 = boto3.client("s3")
except Exception:
    _s3 = None


def upload_to_s3(local_path: str, s3_key: str):
    if _s3 is None:
        logger.warning(f"S3 not available, skipping upload of {local_path}")
        return False
    try:
        _s3.upload_file(local_path, S3_BUCKET, s3_key)
        logger.info(f"Uploaded s3://{S3_BUCKET}/{s3_key}")
        return True
    except Exception as e:
        logger.error(f"S3 upload failed for {local_path}: {e}")
        return False


# ---------------------------------------------------------------------------
# Async wrappers for blocking calls
# ---------------------------------------------------------------------------

async def run_blocking(func, *args, **kwargs):
    """Run a sync function in the default thread pool executor."""
    loop = asyncio.get_running_loop()
    fn = functools.partial(func, *args, **kwargs)
    return await loop.run_in_executor(None, fn)


# ---------------------------------------------------------------------------
# Sample generation processor
# ---------------------------------------------------------------------------

LOCKS_DIR = Path(os.environ.get("KALSHI_DATA_DIR", ROOT)) / "locks"


def _has_active_client_sessions() -> bool:
    """Check for active client.js listening sessions via lockfiles.

    Each client session writes a <sessionId>.lock file containing its PID.
    A session is active if the lockfile exists and the PID is still alive.
    """
    if not LOCKS_DIR.exists():
        return False
    for lockfile in LOCKS_DIR.glob("*.lock"):
        try:
            pid = int(lockfile.read_text().strip())
            os.kill(pid, 0)  # signal 0 just checks if process exists
            return True
        except (ValueError, OSError):
            # Stale lockfile — PID doesn't exist or file is invalid
            continue
    return False


async def _reschedule_job(job, job_token, delay_minutes: int = 5):
    """Move the current job to the delayed queue, rescheduling it for later."""
    delay_ms = delay_minutes * 60 * 1000
    timestamp = int(time.time() * 1000) + delay_ms
    logger.info(f"[{job.id}] Rescheduling job for {delay_minutes} min from now")
    await job.scripts.moveToDelayed(job.id, timestamp, delay=delay_ms, token=job_token)

async def _process_sample_generation(job, job_token, progress=None):
    if progress is None:
        progress = {}
    target = job.data["target"]
    chat_id = job.data.get("chat_id")
    slug = slugify(target)
    job_id = job.id or "?"

    # Don't run sample generation while client listening sessions are active —
    # yt-dlp + ffmpeg compete for memory and bandwidth with live audio streaming.
    if _has_active_client_sessions():
        logger.info(f"[{job_id}] Active client sessions detected, deferring '{target}'")
        await _reschedule_job(job, job_token)
        return

    # Check if we already have enough samples for this person
    existing_samples = sorted(AUDIO_LIBRARY.glob(f"{slug}*.wav"))
    if len(existing_samples) > 10:
        logger.info(f"[{job_id}] '{target}' already has {len(existing_samples)} samples (>10). Skipping generation.")
        await run_blocking(
            send_telegram,
            f"📦 *{target}* already has {len(existing_samples)} samples in library. Skipping generation.",
            "voice",
        )
        return

    progress.update({"stage": "downloading"})

    work_dir = Path(tempfile.mkdtemp(prefix=f"samples_{slug}_"))
    logger.info(f"[{job_id}] Working directory: {work_dir}")

    try:
        # 1. Download
        urls = job.data.get("urls")
        if urls:
            logger.info(f"[{job_id}] Using {len(urls)} provided URL(s) (search disabled)")
            wav_paths = await download_from_urls(urls, work_dir)
        else:
            wav_paths = await search_and_download(target, 7, work_dir)
        if not wav_paths:
            progress.update({"stage": "failed", "error": "No audio downloaded"})
            await run_blocking(
                send_telegram, f"❌ Failed to download audio for *{target}*", "voice"
            )
            return

        # 2. VAD
        progress.update({"stage": "vad"})
        import librosa

        vad = VAD()
        raw_segments = []

        def run_vad():
            nonlocal raw_segments
            for wav_path in wav_paths:
                try:
                    audio, sr = librosa.load(str(wav_path), sr=16000)
                    if sr != 16000:
                        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
                    timestamps = vad.get_speech_segments(audio)
                    max_gap_s = 0.5
                    merged = []
                    for ts in timestamps:
                        start_s, end_s = ts[0] / 16000, ts[1] / 16000
                        if merged and (start_s - merged[-1][1]) <= max_gap_s:
                            merged[-1] = (merged[-1][0], end_s)
                        else:
                            merged.append((start_s, end_s))
                    for start_s, end_s in merged:
                        duration = end_s - start_s
                        if 2.0 <= duration <= 60.0:
                            start_sample = int(start_s * 16000)
                            end_sample = int(end_s * 16000)
                            raw_segments.append({
                                "audio": audio[start_sample:end_sample],
                                "duration": round(duration, 2),
                                "source": wav_path.name,
                            })
                except Exception as e:
                    logger.error(f"[{job_id}] VAD failed for {wav_path.name}: {e}")

        await run_blocking(run_vad)

        if not raw_segments:
            progress.update({"stage": "failed", "error": "No speech segments found"})
            await run_blocking(
                send_telegram, f"❌ No speech segments found for *{target}*", "voice"
            )
            return

        # 3. Embed
        progress.update({"stage": "embedding"})
        embedder = TitaNetEmbedder()

        def run_embedding():
            for seg in raw_segments:
                try:
                    seg["embedding"] = embedder.embed(seg["audio"])
                except Exception as e:
                    seg["embedding"] = None

        await run_blocking(run_embedding)
        embedded = [s for s in raw_segments if s.get("embedding") is not None]

        if not embedded:
            progress.update({"stage": "failed", "error": "No embeddings computed"})
            await run_blocking(
                send_telegram, f"❌ Failed to compute embeddings for *{target}*", "voice"
            )
            return

        # 4-5. Cluster + score
        progress.update({"stage": "clustering"})
        gen = SampleGenerator(target=target)
        gen.embedder = embedder

        def run_clustering():
            return gen.cluster_and_score(embedded)

        segments = await run_blocking(run_clustering)

        if not segments:
            progress.update({"stage": "failed", "error": "No target segments found"})
            await run_blocking(
                send_telegram, f"❌ No target voice segments found for *{target}*", "voice"
            )
            return

        # 6. Save WAVs + embeddings to disk, convert to OGG
        progress.update({"stage": "converting"})
        segments_dir = work_dir / "segments"
        segments_dir.mkdir(exist_ok=True)
        ogg_dir = work_dir / "ogg"
        ogg_dir.mkdir(exist_ok=True)

        def run_conversion():
            for i, seg in enumerate(segments):
                wav_path = segments_dir / f"{slug}_{i}.wav"
                emb_path = segments_dir / f"{slug}_{i}.embedding"
                sf.write(str(wav_path), seg["audio"], 16000)
                torch.save(seg["embedding"], str(emb_path))
                seg["wav_path"] = str(wav_path)
                seg["emb_path"] = str(emb_path)

                ogg_path = ogg_dir / f"{slug}_{i}.ogg"
                subprocess.run([
                    "ffmpeg", "-y", "-i", str(wav_path),
                    "-c:a", "libopus", "-b:a", "32k",
                    "-ar", "16000", "-ac", "1",
                    str(ogg_path),
                ], check=True, capture_output=True)
                seg["ogg_path"] = str(ogg_path)

        await run_blocking(run_conversion)

        # 7. Apply trust preferences and send for verification
        progress.update({"stage": "verification", "segment_count": len(segments)})

        def load_trust_data():
            trust_data = load_trust()
            return get_trust_for(slug, trust_data)

        auto_approve, threshold = await run_blocking(load_trust_data)

        # Never auto-approve samples for a speaker with no existing voice samples
        is_new_speaker = len(existing_samples) == 0

        # Select a diverse review subset: up to 3 segments per source video,
        # with a minimum of 5 distinct sources.
        # Segments outside this set are auto-approved and saved immediately.
        max_per_video = 3
        min_sources = 5
        by_source = {}
        for i, s in enumerate(segments):
            src = s.get("source", "unknown")
            by_source.setdefault(src, []).append((i, s))
        diverse = []
        for src, entries in by_source.items():
            entries.sort(key=lambda x: x[1]["score"], reverse=True)
            diverse.extend(entries[:max_per_video])
        diverse.sort(key=lambda x: x[1]["score"], reverse=True)

        # Ensure at least min_sources distinct sources
        seen_sources = {segments[idx].get("source") for idx, _ in diverse}
        if len(seen_sources) < min_sources:
            remaining_sources = [src for src in sorted(by_source) if src not in seen_sources]
            for src in remaining_sources:
                if len(seen_sources) >= min_sources:
                    break
                entries = by_source[src]
                entries.sort(key=lambda x: x[1]["score"], reverse=True)
                for idx, s in entries:
                    if idx not in {i for i, _ in diverse}:
                        diverse.append((idx, s))
                        seen_sources.add(src)
                        break
            diverse.sort(key=lambda x: x[1]["score"], reverse=True)

        review_set = {idx for idx, _ in diverse}

        pre_approved_idxs = []
        sent_count = 0

        for i, seg in enumerate(segments):
            score = seg["score"]
            in_review = i in review_set
            is_pre_approved = False
            seg["approved"] = True if is_pre_approved else None

            set_verification_state(slug, i, {
                "target": target,
                "score": score,
                "duration": seg["duration"],
                "job_id": job_id,
                "source": seg.get("source", ""),
                "ogg_path": seg["ogg_path"],
                "wav_path": seg["wav_path"],
                "emb_path": seg["emb_path"],
                "work_dir": str(work_dir),
                "approved": True if is_pre_approved else None,
                "ref_score": seg.get("ref_score"),
            })

            pre_label = " (pre-approved)" if is_pre_approved else ""

            if is_pre_approved and not in_review:
                # Auto-saved without sending for review
                pre_approved_idxs.append(i)
                logger.info(f"[{job_id}] Segment {i} auto-saved (score={score:.3f}, outside review set)")
                continue

            source = seg.get("source", "").replace(".wav", "")
            vid_id = source.rsplit("_", 1)[-1] if "_" in source else source
            source_url = f"https://youtube.com/watch?v={vid_id}" if vid_id else "unknown"
            caption = (
                f"\U0001f399️ {target} — sample {i + 1}/{len(segments)}\n"
                f"Confidence: {score:.3f} | Duration: {seg['duration']:.1f}s{pre_label}\n"
                f"Source: {source_url}"
            )
            if is_pre_approved:
                pre_approved_idxs.append(i)
                keyboard = build_inline_keyboard([
                    [("❌ Reject", f"{CALLBACK_PREFIX}:reject:{slug}:{i}")],
                ])
            else:
                keyboard = build_inline_keyboard([
                    [("✅ Approve", f"{CALLBACK_PREFIX}:approve:{slug}:{i}"),
                     ("❌ Reject", f"{CALLBACK_PREFIX}:reject:{slug}:{i}")],
                    [("🎯 Best per source", f"{CALLBACK_PREFIX}:auto_best:{slug}:{i}")],
                ])

            result = await run_blocking(
                send_telegram_voice, seg["ogg_path"],
                caption=caption, reply_markup=keyboard, channel="voice"
            )
            if result.get("ok"):
                sent_count += 1
                logger.info(f"[{job_id}] Sent segment {i} for review (score={score:.3f}{pre_label})")
            else:
                logger.error(f"[{job_id}] Failed to send segment {i}: {result}")

        logger.info(
            f"[{job_id}] Verification: {len(pre_approved_idxs)} pre-approved, "
            f"{sent_count} sent for review, {len(segments)} total"
        )

        progress.update({
            "stage": "done",
            "status": "awaiting_verification",
            "segment_count": len(segments),
            "pre_approved": len(pre_approved_idxs),
            "sent": sent_count,
            "slug": slug,
        })

        await run_blocking(
            send_telegram,
            f"\U0001f50d *{target}* — {sent_count} segment(s) sent for review\n"
            f"{len(pre_approved_idxs)} pre-approved (auto-saved)\n"
            f"Job: `{job_id}`",
            "voice",
        )

    except Exception as e:
        logger.exception(f"[{job_id}] Sample generation failed: {e}")
        await run_blocking(
            send_telegram, f"❌ Sample generation failed for *{target}*: {e}", "voice"
        )
        raise

JOB_TIMEOUT_SEC = 60 * 60  # 1 hour — gives yt-dlp plenty of headroom for slow connections

async def process_sample_generation(job, job_token):
    progress = {}
    try:
        await asyncio.wait_for(
            _process_sample_generation(job, job_token, progress),
            timeout=JOB_TIMEOUT_SEC,
        )
    except asyncio.TimeoutError:
        stage = progress.get("stage", "unknown")
        target = job.data.get("target", "?")
        segment_count = progress.get("segment_count", "?")
        minutes = JOB_TIMEOUT_SEC // 60
        logger.error(
            f"[{job.id}] Job timed out after {minutes}min — "
            f"target={target}, stage={stage}, segments_so_far={segment_count}"
        )
        await run_blocking(
            send_telegram,
            f"⏰ Sample generation timed out for *{target}* after {minutes} min\n"
            f"Stage: {stage} | Segments found: {segment_count}\n"
            f"Check yt-0dlp connectivity, VAD model, or TitaNet availability.",
            "voice",
        )
        raise


def save_to_library_from_segments(segments, approved_idxs, slug, target, max_total=30):
    """Save approved segments directly to audio-library (sync, called via run_blocking).
    Enforces max_total cap across all runs for this speaker."""
    AUDIO_LIBRARY.mkdir(parents=True, exist_ok=True)

    existing = sorted(AUDIO_LIBRARY.glob(f"{slug}*.wav"))
    existing_count = len(existing)
    remaining = max(0, max_total - existing_count)

    if remaining <= 0:
        logger.info(f"Speaker '{target}' already has {existing_count} samples (cap: {max_total}). Skipping save.")
        send_telegram(
            f"\U0001f4e6 Samples for *{target}*\n"
            f"Already at cap: {existing_count}/{max_total} samples in library. Nothing saved.",
            "voice",
        )
        return 0

    # Only save top-scoring approved up to remaining slots
    approved_sorted = sorted(approved_idxs, key=lambda i: segments[i]["score"], reverse=True)
    to_save = approved_sorted[:remaining]
    skipped = len(approved_idxs) - len(to_save)

    if skipped > 0:
        logger.info(f"Capping at {max_total} total: saving {len(to_save)}, skipping {skipped} (already have {existing_count})")

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
    for i in to_save:
        seg = segments[i]
        suffix = f"-{next_idx}" if next_idx > 0 else ""
        wav_path = AUDIO_LIBRARY / f"{slug}{suffix}.wav"
        emb_path = AUDIO_LIBRARY / f"{slug}{suffix}.embedding"

        sf.write(str(wav_path), seg["audio"], 16000)
        torch.save(seg["embedding"], str(emb_path))

        upload_to_s3(str(wav_path), f"speaker_embeddings/{wav_path.name}")
        upload_to_s3(str(emb_path), f"speaker_embeddings/{emb_path.name}")

        logger.info(f"Saved {wav_path.name} (score={seg['score']:.3f}, duration={seg['duration']:.1f}s)")
        next_idx += 1
        saved += 1

    logger.info(f"Saved {saved} sample(s) to {AUDIO_LIBRARY} (total: {existing_count + saved}/{max_total})")
    scores = [segments[i]["score"] for i in to_save]
    send_telegram(
        f"\U0001f4e6 Samples saved for *{target}*\n"
        f"Saved {saved} segment(s) to `{AUDIO_LIBRARY}`\n"
        f"Total: {existing_count + saved}/{max_total}\n"
        f"Score range: {min(scores):.3f} – {max(scores):.3f}" if scores else f"\U0001f4e6 No samples saved for *{target}*",
        "voice",
    )
    return saved


# ---------------------------------------------------------------------------
# Save samples processor
# ---------------------------------------------------------------------------

async def process_save_samples(job, job_token):
    slug = job.data["slug"]
    target = job.data.get("target", slug.replace("-", " ").title())
    approved_idxs = job.data["approved_indices"]
    job_id = job.id or "?"

    states = get_all_verification_states(slug)
    if not states:
        await run_blocking(
            send_telegram, f"❌ Failed to save samples for *{target}*: verification state expired", "voice"
        )
        raise RuntimeError("No verification state found")

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
    for idx in sorted(approved_idxs):
        state = states.get(idx)
        if not state:
            logger.warning(f"No state for segment {idx}, skipping")
            continue

        if state.get("saved"):
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
            import librosa
            embedder = TitaNetEmbedder()
            audio, _ = librosa.load(str(wav_dest), sr=16000)
            emb = embedder.embed(audio)
            torch.save(emb, str(emb_dest))

        upload_to_s3(str(wav_dest), f"speaker_embeddings/{wav_dest.name}")
        upload_to_s3(str(emb_dest), f"speaker_embeddings/{emb_dest.name}")

        update_verification_state(slug, idx, saved=True)

        logger.info(f"Saved {wav_dest.name} (score={state.get('score', '?')})")
        next_idx += 1
        saved += 1

    # Only cleanup when ALL segments for this slug are resolved
    all_resolved = all(s.get("approved") is not None for s in states.values())
    if not all_resolved:
        return

    # Cleanup work directory
    first_state = states.get(approved_idxs[0]) if approved_idxs else None
    if first_state:
        work_dir = first_state.get("work_dir")
        if work_dir and Path(work_dir).exists():
            shutil.rmtree(work_dir, ignore_errors=True)
            logger.info(f"Cleaned up {work_dir}")

    clear_verification_state(slug)

    await run_blocking(
        send_telegram,
        f"\U0001f4e6 Samples saved for *{target}*\n"
        f"Saved {saved}/{len(approved_idxs)} segment(s) to `{AUDIO_LIBRARY}`",
        "voice",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(description="BullMQ queue worker")
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
    redis_port = int(os.environ.get("REDIS_PORT", "6379"))
    connection = {"host": redis_host, "port": redis_port}

    logger.info("Queue worker starting …")

    shutdown = asyncio.Event()

    def on_signal(signum, frame):
        logger.info(f"Received signal {signum}, shutting down …")
        shutdown.set()

    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)

    gen_worker = Worker(
        "sample-generation", process_sample_generation,
        {"connection": connection, "concurrency": 1, "lockDuration": 30 * 60 * 1000, "stalledInterval": 30 * 60 * 1000},
    )
    save_worker = Worker(
        "save-samples", process_save_samples,
        {"connection": connection, "concurrency": 1, "lockDuration": 10 * 60 * 1000, "stalledInterval": 10 * 60 * 1000},
    )

    gen_worker.on("completed", lambda job: logger.info(f"sample-generation job {job.id} completed"))
    gen_worker.on("failed", lambda job, err: logger.error(f"sample-generation job {job.id} failed: {err}"))
    save_worker.on("completed", lambda job: logger.info(f"save-samples job {job.id} completed"))
    save_worker.on("failed", lambda job, err: logger.error(f"save-samples job {job.id} failed: {err}"))

    await shutdown.wait()

    logger.info("Closing workers …")
    await gen_worker.close()
    await save_worker.close()
    logger.info("Workers shut down.")


if __name__ == "__main__":
    asyncio.run(main())
