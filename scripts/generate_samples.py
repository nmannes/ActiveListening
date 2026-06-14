#!/usr/bin/env python
"""
generate_samples.py — Automatically build voice samples for a target speaker.

Given a target name (e.g. "Donald Trump"), searches YouTube via yt-dlp,
downloads audio, extracts speech segments via Silero VAD, computes TitaNet
embeddings, clusters them to isolate the target speaker's voice, then sends
candidates to the user via Telegram for verification.

Verified samples are saved to ~/audio-library/ with computed embeddings.

Usage:
    python scripts/generate_samples.py "Donald Trump"
    python scripts/generate_samples.py "Donald Trump" --num-videos 5
    python scripts/generate_samples.py "Donald Trump" --auto-threshold 0.85
"""

import argparse
import asyncio
import hashlib
import random
import shutil

YT_DLP = "yt-dlp"

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
from pylib.verification_state import (
    set_verification_state,
    get_all_verification_states,
    clear_verification_state,
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
    """Return (auto_approve: bool, threshold: float) for a target slug.

    Default threshold of 1.0 means nothing is auto-approved unless the user
    explicitly sets a lower threshold in trust.json. This ensures human review
    is always required by default.
    """
    entry = trust_data.get(slug, {})
    default = trust_data.get("default", {})
    auto = entry.get("auto_approve", default.get("auto_approve", False))
    threshold = entry.get("auto_approve_threshold", default.get("auto_approve_threshold", 1.0))
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

def search_and_download(target: str, num_videos: int, work_dir: Path) -> list:
    """
    Search YouTube with diverse queries to get varied audio quality/situations.
    Downloads top results (sorted by relevance/popularity) per query.
    Returns list of downloaded WAV paths (deduplicated across queries).
    """
    pool = [
        f"{target} speech",
        f"{target} interview",
        f"{target} press conference",
        f"{target} speaking event",
        f"{target} hearing",
        f"{target} announces",
        f"{target} remarks",
        f"{target} address",
        f"{target} appearance",
    ]

    # Shuffle and pick a random subset so each run uses different search terms.
    # Use at most num_videos queries (one video per query minimum) but always
    # use at least a few queries, capped by the pool size.
    num_queries = min(num_videos, len(pool))
    random.shuffle(pool)
    queries = pool[:num_queries]

    videos_per_query = max(1, num_videos // len(queries))
    remainder = num_videos % len(queries)

    seen_ids = set()
    all_wavs = []

    for i, q in enumerate(queries):
        count = videos_per_query + (1 if i < remainder else 0)
        if count <= 0:
            continue
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
            query,
        ]

        logger.info(f"Searching [{i + 1}/{len(queries)}]: {q} ({count} videos)")
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
    def __init__(self, target: str, num_videos: int = 5,
                 auto_threshold: float | None = None, skip_verify: bool = False,
                 max_per_video: int = 3, max_total: int = 30):
        self.target = target
        self.slug = slugify(target)
        self.num_videos = num_videos
        self.auto_threshold = auto_threshold
        self.skip_verify = skip_verify
        self.max_per_video = max_per_video
        self.max_total = max_total

        self.vad = None
        self.embedder = None
        self.segments: list = []  # list of dicts: {audio, duration, embedding, score, path}

    # ---- step 1: download ----

    def download(self, work_dir: Path) -> list:
        return search_and_download(self.target, self.num_videos, work_dir)

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
                    if 4.0 <= duration <= 60.0:
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

    def _load_reference_embedding(self) -> torch.Tensor | None:
        """Load existing approved embeddings for this slug and return their
        L2-normalized mean as a reference centroid. Returns None if no
        existing embeddings found."""
        emb_files = sorted(AUDIO_LIBRARY.glob(f"{self.slug}*.embedding"))
        if not emb_files:
            return None

        refs = []
        for ef in emb_files:
            try:
                emb = torch.load(str(ef), weights_only=False)
                if emb.dim() == 2:
                    emb = emb.squeeze(0)
                refs.append(emb)
            except Exception as e:
                logger.warning(f"Failed to load reference embedding {ef}: {e}")

        if not refs:
            return None

        ref_matrix = torch.stack(refs).numpy()
        ref_centroid = normalize(ref_matrix.mean(axis=0, keepdims=True), norm="l2")
        logger.info(f"Loaded {len(refs)} reference embedding(s) for '{self.target}' from {AUDIO_LIBRARY}")
        return torch.from_numpy(ref_centroid)

    def cluster_and_score(self, segments: list, min_cluster_ratio: float = 0.3,
                          min_ref_similarity: float = 0.2):
        """
        Cluster embeddings. If existing reference embeddings exist, ALL clusters
        whose centroid similarity to the reference exceeds min_ref_similarity are
        selected as target (to capture the same speaker across different acoustic
        conditions). Otherwise the largest cluster is used.

        Score each segment by cosine similarity to its cluster centroid.
        Also computes ref_score (similarity to reference centroid) when available.
        Discards segments in clusters smaller than min_cluster_ratio of total.
        """
        ref_centroid = self._load_reference_embedding()

        if len(segments) < 2:
            for s in segments:
                s["score"] = 1.0
                s["is_target"] = True
                if ref_centroid is not None:
                    emb_np = s["embedding"].squeeze(0).numpy()
                    emb_norm = normalize(emb_np.reshape(1, -1), norm="l2")
                    s["ref_score"] = round(float(emb_norm @ ref_centroid.numpy().T), 4)
            return segments

        emb_matrix = torch.stack([s["embedding"].squeeze(0) for s in segments])
        emb_norm = normalize(emb_matrix.numpy(), norm="l2")

        # Cosine distance = 1 - cosine similarity
        dist_matrix = 1 - (emb_norm @ emb_norm.T)

        # Agglomerative clustering
        n = len(segments)
        clustering = AgglomerativeClustering(
            n_clusters=None,
            metric="precomputed",
            linkage="average",
            distance_threshold=0.35,
        )
        labels = clustering.fit_predict(dist_matrix)

        unique, counts = np.unique(labels, return_counts=True)

        # Compute centroids per cluster
        centroids = {}
        for label in unique:
            mask = labels == label
            centroids[label] = normalize(emb_norm[mask].mean(axis=0, keepdims=True), norm="l2")

        # --- Determine target cluster(s) ---
        if ref_centroid is not None:
            # Select ALL clusters whose centroid similarity to the reference
            # exceeds min_ref_similarity. A single speaker recorded in different
            # acoustic conditions often splits across clusters.
            ref_np = ref_centroid.numpy()
            cluster_sims = {}
            for label in unique:
                sim = float(centroids[label] @ ref_np.T)
                cluster_sims[label] = sim
            target_labels = {label for label, sim in cluster_sims.items()
                             if sim >= min_ref_similarity}
            if not target_labels:
                # Nothing matched — fall back to best match
                best = max(cluster_sims, key=cluster_sims.get)
                target_labels = {best}
            total_target = sum(counts[unique == l][0] for l in target_labels)
            logger.info(
                f"Clusters: {dict(zip(unique.tolist(), counts.tolist()))}, "
                f"reference similarities: {', '.join(f'{k}:{v:.3f}' for k, v in sorted(cluster_sims.items()))}, "
                f"target clusters (ref sim >= {min_ref_similarity}): {sorted(target_labels)} ({total_target} segments)"
            )
        else:
            # Fall back to largest cluster
            largest_label = unique[counts.argmax()]
            largest_count = counts.max()
            target_labels = {largest_label}
            logger.info(f"Clusters: {dict(zip(unique.tolist(), counts.tolist()))}, target cluster (largest): {largest_label} ({largest_count} segments)")

        # Score each segment
        for i, s in enumerate(segments):
            centroid = centroids[labels[i]]
            sim = float((emb_norm[i] @ centroid.T).item())
            s["score"] = round(max(0.0, min(1.0, sim)), 4)
            s["cluster"] = int(labels[i])
            s["is_target"] = labels[i] in target_labels
            if ref_centroid is not None:
                ref_sim = float(emb_norm[i] @ ref_centroid.numpy().T)
                s["ref_score"] = round(max(0.0, min(1.0, ref_sim)), 4)

        # Filter: keep only target cluster, above score threshold
        min_score = 0.65
        target_segments = [
            s for s in segments
            if s.get("is_target") and s["score"] >= min_score
        ]

        # Sort by score descending
        target_segments.sort(key=lambda s: s["score"], reverse=True)

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

async def verify_via_telegram(generator: SampleGenerator, trust_data: dict, work_dir: Path):
    """
    Persist segments to disk, register verification state in Redis, and send
    voice messages via Telegram for review. Returns immediately — callbacks are
    handled asynchronously by telegram_server, which enqueues save jobs when
    all segments for a slug are resolved.

    Returns (pre_approved_indices, pending_count) where pre_approved_indices
    are the original segment indices to save immediately.
    """
    segments = generator.segments
    slug = generator.slug
    target = generator.target

    if not segments:
        logger.warning("No segments to verify.")
        return [], 0

    auto_approve, trust_threshold = get_trust_for(slug, trust_data)
    effective_threshold = generator.auto_threshold or trust_threshold

    # Select a diverse subset for human review: up to max_per_video segments
    # per source video, sorted by score. Guarantee at least min_sources (5)
    # distinct sources by pulling in the best segment from additional sources.
    # All segments remain on generator.segments for reference-centroid use;
    # only the diverse subset is sent for verification.
    max_per_video = generator.max_per_video
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

    review_indices = [idx for idx, _ in diverse]
    review_set = [(j, segments[idx]) for j, (idx, _) in enumerate(diverse)]

    if len(segments) > len(review_set):
        logger.info(
            f"Diverse review: {len(review_set)}/{len(segments)} segments "
            f"from {len(seen_sources)} video(s) (max {max_per_video}/video, min {min_sources} sources)"
        )

    # Persist segments to disk so they survive past this process.
    segments_dir = work_dir / "segments"
    segments_dir.mkdir(exist_ok=True)

    review_set_indices = set(review_indices)
    pre_approved_idxs = []
    needs_approval = 0
    sent_count = 0

    # Persist ALL segments and register in Redis. Segments outside the
    # diverse review set are auto-approved and saved immediately.
    for i, seg in enumerate(segments):
        score = seg["score"]
        in_review = i in review_set_indices
        is_pre_approved = auto_approve or score >= effective_threshold or not in_review

        # Save WAV + embedding to disk
        wav_path = segments_dir / f"{slug}_{i}.wav"
        emb_path = segments_dir / f"{slug}_{i}.embedding"
        sf.write(str(wav_path), seg["audio"], 16000)
        torch.save(seg["embedding"], str(emb_path))

        set_verification_state(slug, i, {
            "target": target,
            "score": score,
            "duration": seg["duration"],
            "source": seg.get("source", ""),
            "ogg_path": str(seg["ogg_path"]),
            "wav_path": str(wav_path),
            "emb_path": str(emb_path),
            "work_dir": str(work_dir),
            "approved": True if is_pre_approved else None,
            "ref_score": seg.get("ref_score"),
        })

        if is_pre_approved and not in_review:
            pre_approved_idxs.append(i)
            logger.info(f"  Segment {i} auto-saved (score={score:.3f}, outside review set)")
            continue

        pre_label = " (pre-approved)" if is_pre_approved else ""
        source = seg.get("source", "").replace(".wav", "")
        vid_id = source.rsplit("_", 1)[-1] if "_" in source else source
        source_url = f"https://youtube.com/watch?v={vid_id}" if vid_id else "unknown"

        # Find the review-set display number for this segment
        display_num = review_indices.index(i) + 1 if i in review_set_indices else i + 1
        caption = (
            f"🎙️ {target} — sample {display_num}/{len(review_set_indices)}\n"
            f"Confidence: {score:.3f} | Duration: {seg['duration']:.1f}s{pre_label}\n"
            f"Source: {source_url}"
        )

        if is_pre_approved:
            pre_approved_idxs.append(i)
            keyboard = build_inline_keyboard([
                [("❌ Reject", f"{CALLBACK_PREFIX}:reject:{i}")],
            ])
        else:
            needs_approval += 1
            keyboard = build_inline_keyboard([
                [("✅ Approve", f"{CALLBACK_PREFIX}:approve:{i}"),
                 ("❌ Reject", f"{CALLBACK_PREFIX}:reject:{i}")],
                [("🤖 Auto-approve all remaining", f"{CALLBACK_PREFIX}:auto_all:{i}")],
            ])

        result = send_telegram_voice(
            str(seg["ogg_path"]),
            caption=caption,
            reply_markup=keyboard,
            channel="voice",
        )

        if result.get("ok"):
            sent_count += 1
            logger.info(f"  Sent segment {i} (score={score:.3f}{pre_label})")
        else:
            logger.error(f"  Failed to send segment {i}: {result}")

    pending = needs_approval
    logger.info(
        f"Verification: {len(pre_approved_idxs)} pre-approved, "
        f"{pending} sent for review (async)"
    )

    if pending > 0:
        send_telegram(
            f"🔍 *{target}* — {pending} segment(s) sent for review\n"
            f"{len(pre_approved_idxs)} pre-approved (saved immediately)\n"
            f"Approve/reject in this chat to save or discard.",
            "voice",
        )

    return pre_approved_idxs, pending


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
            "voice",
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
        "voice",
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
    parser.add_argument("--auto-threshold", type=float, default=None,
                        help="Auto-approve segments above this confidence score (0.0-1.0)")
    parser.add_argument("--skip-verify", action="store_true", help="Skip Telegram verification entirely")
    parser.add_argument("--dry-run", action="store_true", help="Download and cluster but don't save")
    parser.add_argument("--max-per-video", type=int, default=3, help="Max samples to keep per source video (default: 3)")
    parser.add_argument("--max-total", type=int, default=30, help="Max total samples per speaker across all runs (default: 30)")
    args = parser.parse_args()

    # Load trust preferences
    trust_data = load_trust()

    generator = SampleGenerator(
        target=args.target,
        num_videos=args.num_videos,
        auto_threshold=args.auto_threshold,
        skip_verify=args.skip_verify,
        max_per_video=args.max_per_video,
        max_total=args.max_total,
    )

    # Work in a temp directory
    work_dir = Path(tempfile.mkdtemp(prefix=f"samples_{generator.slug}_"))
    logger.info(f"Working directory: {work_dir}")

    # Check if we already have enough samples for this person
    existing_samples = sorted(AUDIO_LIBRARY.glob(f"{generator.slug}*.wav"))
    if len(existing_samples) > 10:
        logger.info(f"'{args.target}' already has {len(existing_samples)} samples (>10). Skipping generation.")
        send_telegram(
            f"📦 *{args.target}* already has {len(existing_samples)} samples in library. Skipping generation.",
            "voice",
        )
        return

    pending = 0

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
        generator.segments = generator.cluster_and_score(embedded)
        if not generator.segments:
            logger.error("No target segments found after clustering.")
            return

        # --- Dry-run: report findings and exit ---
        if args.dry_run:
            print_dry_run_summary(generator)
            return

        # 6. Convert to OGG for Telegram
        generator.convert_to_ogg(generator.segments, work_dir)

        # 7-8. Verify via Telegram (non-blocking — callbacks handled by telegram_server)
        if args.skip_verify:
            approved = list(range(len(generator.segments)))
            pending = 0
            logger.info(f"Skipping verification. {len(approved)} segment(s) will be saved.")
        else:
            approved, pending = await verify_via_telegram(generator, trust_data, work_dir)

        # 9. Save pre-approved segments immediately; pending ones are saved
        #    asynchronously by telegram_server via the save-samples queue.
        if approved:
            save_to_library(generator, approved, max_total=generator.max_total)

    finally:
        # Only clean up if no pending verifications; otherwise the save
        # job (triggered by telegram_server callbacks) will clean up.
        if pending > 0:
            logger.info(f"Keeping {work_dir} — {pending} segment(s) awaiting async verification")
        else:
            logger.info(f"Cleaning up {work_dir}")
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
