#!/usr/bin/env python3
"""
generate_samples.py — Automatically build voice samples for a target speaker.

Given a target name (e.g. "Donald Trump"), searches YouTube via yt-dlp,
downloads audio, extracts speech segments via Silero VAD, computes TitaNet
embeddings, clusters them to isolate the target speaker's voice, then sends
candidates to the user via Telegram for verification.

Verified samples are saved to ~/audio-library/ with computed embeddings.

Usage:
    python3 scripts/generate_samples.py "Donald Trump"
    python3 scripts/generate_samples.py "Donald Trump" --num-videos 5 --max-duration 120
    python3 scripts/generate_samples.py "Donald Trump" --auto-threshold 0.85
"""

import argparse
import asyncio
import hashlib
import shutil

YT_DLP = shutil.which("yt-dlp") or "yt-dlp"
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import normalize

# Project root for imports
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from pylib.telegram import (
    send_telegram_voice,
    send_telegram,
    build_inline_keyboard,
    poll_telegram_callbacks,
    answer_callback_query,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).resolve().parent.parent / "logs" / "generate-samples.log"),
    ],
)
logger = logging.getLogger("generate_samples")

AUDIO_LIBRARY = Path("~/audio-library").expanduser()
TRUST_FILE = AUDIO_LIBRARY / "trust.json"
CALLBACK_PREFIX = "gs"  # short prefix to save callback_data bytes

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def load_trust():
    if TRUST_FILE.exists():
        try:
            return json.loads(TRUST_FILE.read_text())
        except Exception:
            pass
    return {}


def save_trust(data):
    TRUST_FILE.parent.mkdir(parents=True, exist_ok=True)
    TRUST_FILE.write_text(json.dumps(data, indent=2))


def get_trust_for(slug, trust_data):
    """Return (auto_approve: bool, threshold: float) for a target slug."""
    entry = trust_data.get(slug, {})
    default = trust_data.get("default", {})
    auto = entry.get("auto_approve", default.get("auto_approve", False))
    threshold = entry.get("auto_approve_threshold", default.get("auto_approve_threshold", 0.85))
    return auto, threshold


# ---------------------------------------------------------------------------
# VAD
# ---------------------------------------------------------------------------

class VAD:
    """Silero VAD wrapper for splitting audio into speech chunks."""

    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate
        model, utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True,
        )
        self.model = model
        self.utils = utils

    def get_speech_segments(self, audio: np.ndarray) -> list:
        """
        Return list of (start_sample, end_sample) for speech regions.
        audio must be float32, 16kHz.
        """
        # Ensure float32
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        tensor = torch.from_numpy(audio)
        timestamps = self.utils[0](
            tensor,
            self.model,
            sampling_rate=self.sample_rate,
            min_speech_duration_ms=600,
            min_silence_duration_ms=600,
            speech_pad_ms=300,
        )
        return [(ts["start"], ts["end"]) for ts in timestamps]


# ---------------------------------------------------------------------------
# TitaNet embedding
# ---------------------------------------------------------------------------

class TitaNetEmbedder:
    """Loads TitaNet-Large and computes speaker embeddings."""

    def __init__(self, device: str = "cpu"):
        from nemo.collections.asr.models import EncDecSpeakerLabelModel

        logger.info("Loading TitaNet-Large …")
        self.model = EncDecSpeakerLabelModel.from_pretrained(
            model_name="titanet_large"
        ).to(device)
        self.model.eval()
        self.device = device

    def embed(self, audio: np.ndarray) -> torch.Tensor:
        """Compute embedding for 16kHz float32 audio. Returns (1, D) tensor."""
        with torch.no_grad():
            t = torch.from_numpy(audio).float().to(self.device).unsqueeze(0)
            length = torch.tensor([t.shape[1]], device=self.device)
            _, emb = self.model.forward(input_signal=t, input_signal_length=length)
            return emb.cpu()


# ---------------------------------------------------------------------------
# yt-dlp
# ---------------------------------------------------------------------------

def search_and_download(target: str, num_videos: int, max_duration: int, work_dir: Path) -> list:
    """
    Search YouTube with diverse queries to get varied audio quality/situations.
    Returns list of downloaded WAV paths (deduplicated across queries).
    """
    queries = [
        f"{target} speech",
        f"{target} interview",
        f"{target} press conference",
        f"{target} speaking event",
        f"{target} hearing",
    ]

    videos_per_query = max(1, num_videos // len(queries))
    remainder = num_videos % len(queries)

    seen_ids = set()
    all_wavs = []

    for i, q in enumerate(queries):
        count = videos_per_query + (1 if i < remainder else 0)
        query = f"ytsearch{count}:{q}"
        output_template = work_dir / f"q{i}_%(id)s.%(ext)s"

        cmd = [
            YT_DLP,
            "--extract-audio",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "--output", str(output_template),
            "--no-playlist",
            "--no-continue",
            "--socket-timeout", "30",
            "--match-filter", f"duration <= {max_duration}",
            query,
        ]

        logger.info(f"Searching [{i + 1}/{len(queries)}]: {q} ({count} videos, max {max_duration}s)")
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=300)
        except subprocess.CalledProcessError as e:
            logger.error(f"yt-dlp failed for '{q}': {e.stderr[:200]}")
        except subprocess.TimeoutExpired:
            logger.error(f"yt-dlp timed out for '{q}'")

        for wav in sorted(work_dir.glob(f"q{i}_*.wav")):
            vid_id = wav.stem.split("_", 1)[1] if "_" in wav.stem else wav.stem
            if vid_id not in seen_ids:
                seen_ids.add(vid_id)
                all_wavs.append(wav)

    logger.info(f"Downloaded {len(all_wavs)} unique audio files across {len(queries)} queries")
    return all_wavs


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

class SampleGenerator:
    def __init__(self, target: str, num_videos: int = 5, max_duration: int = 120,
                 auto_threshold: float | None = None, skip_verify: bool = False,
                 max_per_video: int = 5, max_total: int = 30):
        self.target = target
        self.slug = slugify(target)
        self.num_videos = num_videos
        self.max_duration = max_duration
        self.auto_threshold = auto_threshold
        self.skip_verify = skip_verify
        self.max_per_video = max_per_video
        self.max_total = max_total

        self.vad = None
        self.embedder = None
        self.segments: list = []  # list of dicts: {audio, duration, embedding, score, path}

    # ---- step 1: download ----

    def download(self, work_dir: Path) -> list:
        return search_and_download(self.target, self.num_videos, self.max_duration, work_dir)

    # ---- step 2: VAD segment ----

    def segment(self, wav_paths: list):
        if self.vad is None:
            self.vad = VAD()

        raw_segments = []
        for wav_path in wav_paths:
            logger.info(f"VAD processing: {wav_path.name}")
            try:
                audio, sr = librosa.load(str(wav_path), sr=16000)
                if sr != 16000:
                    audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)

                timestamps = self.vad.get_speech_segments(audio)

                # Merge adjacent segments that are close together to form
                # longer utterances — useful for human voice identification.
                max_gap_s = 1.5  # merge segments within 1.5s of each other
                merged = []
                for ts in timestamps:
                    start_s, end_s = ts[0] / 16000, ts[1] / 16000
                    if merged and (start_s - merged[-1][1]) <= max_gap_s:
                        merged[-1] = (merged[-1][0], end_s)
                    else:
                        merged.append((start_s, end_s))

                for start_s, end_s in merged:
                    start_sample = int(start_s * 16000)
                    end_sample = int(end_s * 16000)
                    chunk = audio[start_sample:end_sample]
                    duration = end_s - start_s
                    if 4.0 <= duration <= 25.0:
                        raw_segments.append({
                            "audio": chunk,
                            "duration": round(duration, 2),
                            "source": wav_path.name,
                        })
            except Exception as e:
                logger.error(f"VAD failed for {wav_path.name}: {e}")

        logger.info(f"VAD produced {len(raw_segments)} speech segments")
        return raw_segments

    # ---- step 3: embed ----

    def embed(self, segments: list):
        if self.embedder is None:
            self.embedder = TitaNetEmbedder()

        for seg in segments:
            try:
                seg["embedding"] = self.embedder.embed(seg["audio"])
            except Exception as e:
                logger.error(f"Embedding failed: {e}")
                seg["embedding"] = None

        # Drop failed embeddings
        valid = [s for s in segments if s.get("embedding") is not None]
        logger.info(f"Computed embeddings for {len(valid)}/{len(segments)} segments")
        return valid

    # ---- step 4 & 5: cluster + score ----

    def cluster_and_score(self, segments: list, min_cluster_ratio: float = 0.3,
                          max_per_video: int = 5):
        """
        Cluster embeddings. Largest cluster = target.
        Score each segment by cosine similarity to its cluster centroid.
        Discards segments in clusters smaller than min_cluster_ratio of total.
        Limits to max_per_video segments per source video for diversity.
        """
        if len(segments) < 2:
            for s in segments:
                s["score"] = 1.0
                s["is_target"] = True
            return segments

        emb_matrix = torch.stack([s["embedding"].squeeze(0) for s in segments])
        emb_norm = normalize(emb_matrix.numpy(), norm="l2")

        # Cosine distance = 1 - cosine similarity
        dist_matrix = 1 - (emb_norm @ emb_norm.T)

        # Agglomerative clustering
        n = len(segments)
        # Try distance thresholds to find reasonable clusters
        clustering = AgglomerativeClustering(
            n_clusters=None,
            metric="precomputed",
            linkage="average",
            distance_threshold=0.35,
        )
        labels = clustering.fit_predict(dist_matrix)

        # Find largest cluster
        unique, counts = np.unique(labels, return_counts=True)
        largest_label = unique[counts.argmax()]
        largest_count = counts.max()

        logger.info(f"Clusters: {dict(zip(unique.tolist(), counts.tolist()))}, target cluster: {largest_label} ({largest_count} segments)")

        # Compute centroids per cluster
        centroids = {}
        for label in unique:
            mask = labels == label
            centroids[label] = normalize(emb_norm[mask].mean(axis=0, keepdims=True), norm="l2")

        # Score each segment
        for i, s in enumerate(segments):
            centroid = centroids[labels[i]]
            sim = float((emb_norm[i] @ centroid.T).item())
            s["score"] = round(max(0.0, min(1.0, sim)), 4)
            s["cluster"] = int(labels[i])
            s["is_target"] = labels[i] == largest_label

        # Filter: keep only target cluster, above score threshold
        min_score = 0.65
        target_segments = [
            s for s in segments
            if s.get("is_target") and s["score"] >= min_score
        ]

        # Sort by score descending
        target_segments.sort(key=lambda s: s["score"], reverse=True)

        # Limit per source video for diversity of audio quality/situations
        if max_per_video and len(target_segments) > max_per_video:
            by_source = {}
            for s in target_segments:
                src = s.get("source", "unknown")
                by_source.setdefault(src, []).append(s)
            diverse = []
            for src, segs in by_source.items():
                diverse.extend(segs[:max_per_video])
            diverse.sort(key=lambda s: s["score"], reverse=True)
            skipped = len(target_segments) - len(diverse)
            target_segments = diverse
            logger.info(f"Per-video cap ({max_per_video}): kept {len(target_segments)} segments across {len(by_source)} videos, dropped {skipped}")

        logger.info(
            f"Target cluster has {len(target_segments)} segments above score {min_score}. "
            f"Score range: {target_segments[0]['score']:.3f} – {target_segments[-1]['score']:.3f}"
            if target_segments else "No segments passed filtering."
        )

        # Self-evaluation summary
        scores = [s["score"] for s in target_segments]
        if scores:
            logger.info(
                f"Self-eval: {len(scores)} samples | "
                f"mean={np.mean(scores):.3f} | "
                f"median={np.median(scores):.3f} | "
                f"min={np.min(scores):.3f} | "
                f"max={np.max(scores):.3f}"
            )

        return target_segments

    # ---- step 6: convert to OGG for Telegram ----

    def convert_to_ogg(self, segments: list, work_dir: Path):
        """Convert each segment's audio to OGG OPUS for Telegram voice messages."""
        ogg_dir = work_dir / "ogg"
        ogg_dir.mkdir(exist_ok=True)

        for i, seg in enumerate(segments):
            ogg_path = ogg_dir / f"{self.slug}_{i}.ogg"
            wav_tmp = ogg_dir / f"_tmp_{i}.wav"

            # Write WAV temp
            sf.write(str(wav_tmp), seg["audio"], 16000)

            # Convert to OGG OPUS via ffmpeg
            subprocess.run([
                "ffmpeg", "-y", "-i", str(wav_tmp),
                "-c:a", "libopus", "-b:a", "32k",
                "-ar", "16000", "-ac", "1",
                str(ogg_path),
            ], check=True, capture_output=True)

            wav_tmp.unlink()
            seg["ogg_path"] = ogg_path

        logger.info(f"Converted {len(segments)} segments to OGG")


# ---------------------------------------------------------------------------
# Telegram verification
# ---------------------------------------------------------------------------

async def verify_via_telegram(generator: SampleGenerator, trust_data: dict):
    """
    Send each candidate segment as a Telegram voice message with inline keyboard.
    Poll for callback responses. Returns list of approved segments.
    """
    segments = generator.segments
    slug = generator.slug
    target = generator.target

    if not segments:
        logger.warning("No segments to verify.")
        return []

    auto_approve, trust_threshold = get_trust_for(slug, trust_data)

    if auto_approve:
        logger.info(f"Auto-approve enabled for '{target}'. Skipping verification.")
        return list(range(len(segments)))

    # Apply auto-threshold from CLI or trust config
    effective_threshold = generator.auto_threshold or trust_threshold

    # Send each segment
    sent_messages = {}  # callback_key -> segment_index
    pending: set = set()

    for i, seg in enumerate(segments):
        score = seg["score"]
        duration = seg["duration"]

        # Auto-approve above threshold
        if score >= effective_threshold:
            logger.info(f"  Segment {i}: score={score:.3f} >= {effective_threshold} — auto-approved")
            seg["auto_approved"] = True
            continue

        source = seg.get("source", "").replace(".wav", "")
        vid_id = source.rsplit("_", 1)[-1] if "_" in source else source
        source_url = f"https://youtube.com/watch?v={vid_id}" if vid_id else "unknown"

        caption = (
            f"🎙️ {target} — sample {i + 1}/{len(segments)}\n"
            f"Confidence: {score:.3f} | Duration: {duration:.1f}s\n"
            f"Source: {source_url}"
        )

        # Build inline keyboard
        cb_approve = f"{CALLBACK_PREFIX}:approve:{i}"
        cb_reject = f"{CALLBACK_PREFIX}:reject:{i}"
        cb_auto_all = f"{CALLBACK_PREFIX}:auto_all:{i}"

        keyboard = build_inline_keyboard([
            [("✅ Approve", cb_approve), ("❌ Reject", cb_reject)],
            [("🤖 Auto-approve all remaining", cb_auto_all)],
        ])

        result = send_telegram_voice(
            str(seg["ogg_path"]),
            caption=caption,
            reply_markup=keyboard,
        )

        if result.get("ok"):
            sent_messages[cb_approve] = i
            sent_messages[cb_reject] = i
            sent_messages[cb_auto_all] = i
            pending.add(i)
            logger.info(f"  Sent segment {i} (score={score:.3f})")
        else:
            logger.error(f"  Failed to send segment {i}: {result}")

    if not pending:
        logger.info("All segments auto-approved or failed to send.")
        return [i for i, s in enumerate(segments) if s.get("auto_approved")]

    # Poll for responses
    approvals = set(i for i, s in enumerate(segments) if s.get("auto_approved"))
    rejections = set()

    logger.info(f"Waiting for verification of {len(pending)} segment(s) via Telegram …")

    while pending:
        callbacks = poll_telegram_callbacks(timeout=30)

        for cb in callbacks:
            data = cb["data"]
            if not data.startswith(CALLBACK_PREFIX + ":"):
                continue

            # Parse callback data
            parts = data.split(":", 2)
            if len(parts) < 3:
                continue
            action = parts[1]
            idx_str = parts[2]

            try:
                idx = int(idx_str)
            except ValueError:
                continue

            if idx not in pending:
                continue

            if action == "approve":
                approvals.add(idx)
                pending.discard(idx)
                answer_callback_query(cb["callback_id"], "Approved ✅")
                logger.info(f"  Segment {idx} approved")

            elif action == "reject":
                rejections.add(idx)
                pending.discard(idx)
                answer_callback_query(cb["callback_id"], "Rejected ❌")
                logger.info(f"  Segment {idx} rejected")

            elif action == "auto_all":
                # Auto-approve all remaining pending
                for j in list(pending):
                    if j >= idx:  # from this segment onward
                        approvals.add(j)
                        pending.discard(j)
                answer_callback_query(cb["callback_id"], f"Auto-approving {len(pending) + approvals - len(approvals)} remaining ✅")
                logger.info(f"  Auto-approving all remaining from segment {idx}")

                # Update trust: bump auto-approve for this target
                trust_data[slug] = {**trust_data.get(slug, {}), "auto_approve_threshold": effective_threshold}
                save_trust(trust_data)

        # Small sleep to avoid hammering API
        await asyncio.sleep(2)

    # Return approved indices
    all_approved = sorted(approvals)
    logger.info(
        f"Verification complete: {len(all_approved)} approved, "
        f"{len(rejections)} rejected, "
        f"{len([i for i, s in enumerate(segments) if s.get('auto_approved')])} auto-approved"
    )
    return all_approved


# ---------------------------------------------------------------------------
# Save to library
# ---------------------------------------------------------------------------

def save_to_library(generator: SampleGenerator, approved_indices: list, max_total: int = 30):
    """Save approved segments to ~/audio-library/ as WAV + compute .embedding.
    Enforces max_total cap across all runs for this speaker."""
    slug = generator.slug
    embedder = generator.embedder
    segments = generator.segments

    AUDIO_LIBRARY.mkdir(parents=True, exist_ok=True)

    # Count existing samples for this slug
    existing = sorted(AUDIO_LIBRARY.glob(f"{slug}*.wav"))
    existing_count = len(existing)
    remaining = max(0, max_total - existing_count)

    if remaining <= 0:
        logger.info(f"Speaker '{generator.target}' already has {existing_count} samples (cap: {max_total}). Skipping save.")
        send_telegram(
            f"📦 Samples for *{generator.target}*\n"
            f"Already at cap: {existing_count}/{max_total} samples in library. Nothing saved.",
            "debug",
        )
        return 0

    # Only save top-scoring approved up to remaining slots
    approved_sorted = sorted(approved_indices, key=lambda i: segments[i]["score"], reverse=True)
    to_save = approved_sorted[:remaining]
    skipped = len(approved_indices) - len(to_save)

    if skipped > 0:
        logger.info(f"Capping at {max_total} total: saving {len(to_save)}, skipping {skipped} (already have {existing_count})")

    # Find next available suffix
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

        logger.info(f"Saved {wav_path.name} (score={seg['score']:.3f}, duration={seg['duration']:.1f}s)")
        next_idx += 1
        saved += 1

    logger.info(f"Saved {saved} sample(s) to {AUDIO_LIBRARY} (total: {existing_count + saved}/{max_total})")

    # Send summary via Telegram
    scores = [segments[i]["score"] for i in to_save]
    send_telegram(
        f"📦 Samples generated for *{generator.target}*\n"
        f"Saved {saved} segment(s) to `{AUDIO_LIBRARY}`\n"
        f"Total: {existing_count + saved}/{max_total}\n"
        f"Score range: {min(scores):.3f} – {max(scores):.3f}" if scores else f"📦 No samples saved for *{generator.target}*",
        "debug",
    )

    return saved


# ---------------------------------------------------------------------------
# Dry-run summary
# ---------------------------------------------------------------------------

def print_dry_run_summary(generator: SampleGenerator):
    """Print a detailed summary of what was found, without saving or sending."""
    segments = generator.segments
    scores = [s["score"] for s in segments]
    durations = [s["duration"] for s in segments]
    sources = set(s.get("source", "?") for s in segments)

    # Per-source breakdown
    by_source = {}
    for s in segments:
        src = s.get("source", "?")
        by_source.setdefault(src, []).append(s)

    print()
    print("=" * 60)
    print(f"  DRY RUN — {generator.target}")
    print("=" * 60)
    print(f"  Slug:          {generator.slug}")
    print(f"  Segments:      {len(segments)}")
    print(f"  Sources:       {len(sources)} video(s)")
    print(f"  Duration:      {min(durations):.1f}s – {max(durations):.1f}s "
          f"(avg {np.mean(durations):.1f}s, total {sum(durations):.0f}s)")
    print(f"  Scores:        {min(scores):.3f} – {max(scores):.3f} "
          f"(mean {np.mean(scores):.3f}, median {np.median(scores):.3f})")
    print()
    print(f"  Per video:")
    for src in sorted(by_source, key=lambda s: len(by_source[s]), reverse=True):
        src_scores = [s["score"] for s in by_source[src]]
        print(f"    {src}: {len(by_source[src])} segments, scores {min(src_scores):.3f}–{max(src_scores):.3f}")
    print()
    print(f"  Would save:    {len(segments)} segment(s) to {AUDIO_LIBRARY}")
    print(f"  Would send:    {len(segments)} voice message(s) via Telegram for verification")
    print()

    # Per-segment detail
    print(f"  {'#':>3}  {'score':>7}  {'duration':>8}  {'source'}")
    print(f"  {'---':>3}  {'-----':>7}  {'--------':>8}  {'------'}")
    for i, s in enumerate(segments):
        print(f"  {i:>3}  {s['score']:>7.3f}  {s['duration']:>7.1f}s  {s.get('source', '?')}")
    print("=" * 60)
    print()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main():
    parser = argparse.ArgumentParser(
        description="Generate voice samples for a target speaker via yt-dlp + TitaNet clustering"
    )
    parser.add_argument("target", help="Target speaker name (e.g. 'Donald Trump')")
    parser.add_argument("--num-videos", type=int, default=5, help="Number of YouTube videos to download")
    parser.add_argument("--max-duration", type=int, default=120, help="Max duration per video in seconds")
    parser.add_argument("--auto-threshold", type=float, default=None,
                        help="Auto-approve segments above this confidence score (0.0-1.0)")
    parser.add_argument("--skip-verify", action="store_true", help="Skip Telegram verification entirely")
    parser.add_argument("--dry-run", action="store_true", help="Download and cluster but don't save")
    parser.add_argument("--max-per-video", type=int, default=5, help="Max samples to keep per source video (default: 5)")
    parser.add_argument("--max-total", type=int, default=30, help="Max total samples per speaker across all runs (default: 30)")
    args = parser.parse_args()

    # Load trust preferences
    trust_data = load_trust()

    generator = SampleGenerator(
        target=args.target,
        num_videos=args.num_videos,
        max_duration=args.max_duration,
        auto_threshold=args.auto_threshold,
        skip_verify=args.skip_verify,
        max_per_video=args.max_per_video,
        max_total=args.max_total,
    )

    # Work in a temp directory
    work_dir = Path(tempfile.mkdtemp(prefix=f"samples_{generator.slug}_"))
    logger.info(f"Working directory: {work_dir}")

    try:
        # 1. Download
        wav_paths = generator.download(work_dir)
        if not wav_paths:
            logger.error("No audio downloaded. Check yt-dlp and target name.")
            return

        # 2. VAD
        raw = generator.segment(wav_paths)
        if not raw:
            logger.error("No speech segments found.")
            return

        # 3. Embed
        embedded = generator.embed(raw)
        if not embedded:
            logger.error("No embeddings computed.")
            return

        # 4-5. Cluster + score
        generator.segments = generator.cluster_and_score(embedded, max_per_video=generator.max_per_video)
        if not generator.segments:
            logger.error("No target segments found after clustering.")
            return

        # --- Dry-run: report findings and exit ---
        if args.dry_run:
            print_dry_run_summary(generator)
            return

        # 6. Convert to OGG for Telegram
        generator.convert_to_ogg(generator.segments, work_dir)

        # 7-8. Verify via Telegram
        if args.skip_verify:
            approved = list(range(len(generator.segments)))
            logger.info(f"Skipping verification. {len(approved)} segment(s) would be saved.")
        else:
            approved = await verify_via_telegram(generator, trust_data)

        # 9. Save
        if not approved:
            logger.info("No segments approved. Nothing saved.")
        else:
            save_to_library(generator, approved, max_total=generator.max_total)

    finally:
        # Cleanup
        logger.info(f"Cleaning up {work_dir}")
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
