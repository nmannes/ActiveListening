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
import fcntl
import hashlib
import random
import shutil

YT_DLP = "/home/linuxbrew/.linuxbrew/bin/yt-dlp"
YT_DLP_JS_RUNTIME = "--js-runtimes=deno:/home/linuxbrew/.linuxbrew/bin/deno"

import json
import logging
import os
import re
import shutil
import subprocess
import sys

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
from pylib.sample_library import (
    AUDIO_LIBRARY,
    MAX_SAMPLES_PER_IDENTITY,
    slugify,
    count_samples,
    next_sample_index,
)
# Review-batch policy lives in pylib so queue_worker.py and the tests share it.
from pylib.sample_review import (
    MAX_REVIEW_PER_VIDEO,
    MAX_REVIEW_PER_BATCH,
    MAX_PERSIST_PER_VIDEO,
    select_review_subset,
    select_persist_subset,
)

_logs_dir = Path(__file__).resolve().parent.parent / "logs"
_logs_dir.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(_logs_dir / "generate-samples.log"),
    ],
)
logger = logging.getLogger("generate_samples")

NEGATIVE_AUDIO_LIBRARY = Path("~/negative-audio-library").expanduser()
PENDING_DIR = Path("~/pending-identifications").expanduser()
TRUST_FILE = AUDIO_LIBRARY / "trust.json"
CALLBACK_PREFIX = "gs"  # short prefix to save callback_data bytes
LOCK_FILE = Path("/tmp/generate_samples.lock")

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_video_id(url_or_id: str) -> str:
    """Extract YouTube video ID from a URL or return the ID as-is."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/|youtube\.com/live/)([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    return hashlib.md5(url_or_id.encode()).hexdigest()[:11]


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
        # Jitter VAD thresholds so segment boundaries shift between runs,
        # producing slightly different crops of the same audio.
        timestamps = self.utils[0](
            tensor,
            self.model,
            sampling_rate=self.sample_rate,
            min_speech_duration_ms=300 + random.randint(0, 200),
            min_silence_duration_ms=200 + random.randint(0, 200),
            speech_pad_ms=100 + random.randint(0, 150),
        )
        return [(ts["start"], ts["end"]) for ts in timestamps]


# ---------------------------------------------------------------------------
# TitaNet embedding
# ---------------------------------------------------------------------------

class TitaNetEmbedder:
    """Loads TitaNet-Large and computes speaker embeddings.

    Singleton — only one model instance is ever loaded. Subsequent
    instantiations return the cached instance, ignoring *device*.
    """

    _instance: "TitaNetEmbedder | None" = None
    _lock = __import__("threading").Lock()

    def __new__(cls, device: str = "cpu"):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    obj = super().__new__(cls)
                    obj._init_model(device)
                    cls._instance = obj
        return cls._instance

    def _init_model(self, device: str):
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

async def _run_ytdlp(cmd: list, timeout: int) -> None:
    """Run yt-dlp as an async subprocess so job cancellation can kill it.

    Raises subprocess.CalledProcessError or subprocess.TimeoutExpired on
    failure (same interface as subprocess.run with check=True) so existing
    error-handling code works unchanged.
    """
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise subprocess.TimeoutExpired(cmd, timeout)

    if process.returncode != 0:
        raise subprocess.CalledProcessError(
            process.returncode, cmd,
            stdout.decode() if stdout else "",
            stderr.decode() if stderr else "",
        )


async def _run_ytdlp_json(cmd: list, timeout: int) -> list[dict]:
    """Run yt-dlp --dump-json and return parsed JSON objects (one per line).

    Raises subprocess.CalledProcessError or subprocess.TimeoutExpired on
    failure (same interface as _run_ytdlp).
    """
    process = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        process.kill()
        await process.wait()
        raise subprocess.TimeoutExpired(cmd, timeout)

    if process.returncode != 0:
        raise subprocess.CalledProcessError(
            process.returncode, cmd,
            stdout.decode() if stdout else "",
            stderr.decode() if stderr else "",
        )

    results = []
    for line in stdout.decode().strip().split("\n"):
        line = line.strip()
        if line:
            try:
                results.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return results


# Negative keywords that suggest a video is *about* the target (news analysis,
# commentary, panel discussion) rather than featuring the target as a speaker.
_NEGATIVE_TITLE_KEYWORDS = [
    "highlights", "reaction", "analysis", "recap", "summary", "summarizes",
    "breaking", "explained", "explains", "what they said", "fact check",
    "fact-check", "takes on", "responds to", "slams", "blasts", "rips",
    "wins", "loses", "poll", "polls", "polling", "approval rating",
    "latest news", "week in review", "day in review",
]


def _target_in_metadata(target: str, info: dict) -> bool:
    """Check whether every word of the target name appears in the video
    title or description (case-insensitive)."""
    title = (info.get("title") or "").lower()
    description = (info.get("description") or "").lower()
    combined = f"{title} {description}"
    target_words = target.lower().split()
    return all(word in combined for word in target_words)


def _filter_candidates(target: str, candidates: list[dict]) -> list[dict]:
    """Filter candidate videos: word-match first pass, then negative keywords
    and duration heuristics to exclude news clips about the target."""
    # Pass 1: target name must appear in metadata
    matching = [c for c in candidates if _target_in_metadata(target, c)]

    # Pass 2: exclude titles with negative keywords
    filtered = []
    for c in matching:
        title = (c.get("title") or "").lower()
        if any(kw in title for kw in _NEGATIVE_TITLE_KEYWORDS):
            continue
        # Exclude very short videos (<90s) — likely clips, not full appearances
        duration = c.get("duration") or 0
        if duration and duration < 90:
            continue
        filtered.append(c)

    return filtered


async def _classify_via_js(target: str, candidates: list[dict]) -> dict[str, str]:
    """Classify video candidates using the Anthropic-powered JS classifier.

    Returns a dict mapping video ID to classification ("primary"|"mentioned"|"irrelevant").
    On failure, returns all as "primary" so the pipeline degrades gracefully.
    """
    videos_json = []
    for c in candidates:
        videos_json.append({
            "id": c.get("id", ""),
            "title": c.get("title", ""),
            "channel": c.get("channel") or c.get("uploader") or "",
            "description": c.get("description") or "",
            "duration_sec": c.get("duration") or 0,
        })

    classifier_script = ROOT / "lib" / "classify_video.js"
    try:
        proc = await asyncio.create_subprocess_exec(
            "node", str(classifier_script), target, json.dumps(videos_json),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
    except (FileNotFoundError, asyncio.TimeoutError) as e:
        logger.warning(f"JS classifier unavailable ({e}), falling back to word-match only")
        return {c.get("id", ""): "primary" for c in candidates}

    if proc.returncode != 0:
        logger.warning(f"JS classifier exited {proc.returncode}: {stderr.decode()[:200]}")
        return {c.get("id", ""): "primary" for c in candidates}

    try:
        result = json.loads(stdout.decode())
        return result.get("classifications", {})
    except (json.JSONDecodeError, KeyError) as e:
        logger.warning(f"JS classifier returned invalid JSON: {e}")
        return {c.get("id", ""): "primary" for c in candidates}


async def search_and_download(target: str, num_videos: int, work_dir: Path) -> list:
    """
    Search YouTube with diverse queries, filter candidates by checking that
    the target name appears in each video's title or description, then
    download matching videos.

    Returns list of downloaded WAV paths (deduplicated across queries).
    """
    pool = [
        f'"{target}" interview',
        f'"{target}" town hall',
        f'"{target}" debate',
        f'"{target}" Q&A',
        f'"{target}" podcast',
        f'"{target}" speaks at',
        f'"interview with {target}"',
        f'"{target}" press conference',
        f'"{target}" "questions from reporters"',
        f'"{target}" hearing',
        f'"{target}" "fireside chat"',
        f'"{target}" "one on one"',
        f'"{target}" "sit down"',
    ]

    # Use one distinct search query per desired video so every downloaded
    # clip comes from a different context (speech, interview, hearing, …).
    # This trades volume for variety — we want a few diverse samples, not
    # many clips from the same acoustic situation.
    num_queries = min(num_videos, len(pool))
    random.shuffle(pool)
    queries = pool[:num_queries]

    seen_ids = set()
    collected_ids = set()
    all_wavs = []
    total_candidates = 0
    total_filtered = 0
    total_downloaded = 0

    # Exclude videos uploaded in the last 7 days so results have had
    # time to stabilize — avoids just-uploaded/streamed content.
    cutoff_date = time.strftime("%Y%m%d", time.gmtime(time.time() - 7 * 86400))

    for i, q in enumerate(queries):
        # Fetch a random number of candidates so different runs see
        # different slices of YouTube results for the same query.
        search_count = random.randint(12, 25)

        # --- Step 1: fetch metadata for candidates without downloading ---
        search_query = f"ytsearch{search_count}:{q}"
        logger.info(f"Fetching metadata [{i + 1}/{len(queries)}]: {q} ({search_count} candidates)")

        search_cmd = [
            YT_DLP,
            YT_DLP_JS_RUNTIME,
            "--dump-json",
            "--no-playlist",
            "--socket-timeout", "30",
            "--retries", "2",
            "--datebefore", cutoff_date,
            search_query,
        ]

        candidates = []
        try:
            candidates = await _run_ytdlp_json(search_cmd, timeout=60)
        except subprocess.CalledProcessError as e:
            logger.error(f"yt-dlp search failed for '{q}': {e.stderr[:200] if isinstance(e.stderr, str) else str(e)[:200]}")
        except subprocess.TimeoutExpired as e:
            logger.error(f"yt-dlp search timed out for '{q}'")

        total_candidates += len(candidates)

        # --- Step 2: cheap filter (word-match + negative keywords + duration) ---
        matching = _filter_candidates(target, candidates)
        filtered = len(candidates) - len(matching)
        total_filtered += filtered
        if filtered > 0:
            logger.info(f"  Filtered {filtered}/{len(candidates)} — word-match, negative keywords, or duration")

        if not matching:
            logger.warning(f"  No candidates match filters for '{q}'")
            continue

        # --- Step 3: LLM classification via Anthropic ---
        classifications = await _classify_via_js(target, matching)
        primary = [c for c in matching if classifications.get(c.get("id", "")) == "primary"]
        mentioned = sum(1 for cls in classifications.values() if cls != "primary")
        if mentioned > 0:
            logger.info(f"  LLM: {len(primary)} primary, {mentioned} mentioned/irrelevant (filtered)")
        if not primary:
            logger.warning(f"  No primary videos found for '{q}' after LLM classification")
            continue

        # --- Step 4: pick randomly from primary results ---
        random.shuffle(primary)
        pick_count = random.randint(1, min(3, len(primary)))
        selected = primary[:pick_count]

        for j, info in enumerate(selected):
            vid_id = info.get("id")
            if not vid_id:
                continue
            if vid_id in seen_ids:
                continue
            seen_ids.add(vid_id)

            video_url = f"https://youtube.com/watch?v={vid_id}"
            output_template = work_dir / f"q{i}_%(id)s.%(ext)s"

            title = info.get("title", "?")
            logger.info(f"  Downloading [{j + 1}/{len(selected)}]: {title[:80]}")

            download_cmd = [
                YT_DLP,
                YT_DLP_JS_RUNTIME,
                "-f", "bestaudio/best",
                "--extract-audio",
                "--audio-format", "wav",
                "--audio-quality", "0",
                "--output", str(output_template),
                "--no-playlist",
                "--no-continue",
                "--socket-timeout", "30",
                "--retries", "2",
                video_url,
            ]

            try:
                await _run_ytdlp(download_cmd, timeout=120)
            except subprocess.CalledProcessError as e:
                stderr = e.stderr[:200] if isinstance(e.stderr, str) else str(e)[:200]
                logger.error(f"yt-dlp failed for '{title[:60]}': {stderr}")
            except subprocess.TimeoutExpired as e:
                logger.error(f"yt-dlp timed out for '{title[:60]}'")

        # Collect any newly downloaded WAVs for this query.
        for wav in sorted(work_dir.glob(f"q{i}_*.wav")):
            vid_id = wav.stem.split("_", 1)[1] if "_" in wav.stem else wav.stem
            if vid_id not in collected_ids:
                collected_ids.add(vid_id)
                all_wavs.append(wav)
                total_downloaded += 1

    logger.info(
        f"Downloaded {total_downloaded} unique videos across {len(queries)} queries "
        f"({total_filtered}/{total_candidates} candidates filtered — '{target}' not in metadata)"
    )
    return all_wavs


async def download_from_urls(urls: list, work_dir: Path, target: str | None = None) -> list:
    """
    Download specific YouTube videos by URL or video ID (not search).
    Each URL gets a random 8-minute section for diversity.
    When ``target`` is provided the video metadata is checked first and a
    warning is logged if the name doesn't appear — user-supplied URLs are
    never skipped, but the warning helps catch misattributed links.
    Returns list of downloaded WAV paths (deduplicated by video ID).
    """
    seen_ids = set()
    all_wavs = []

    for i, url in enumerate(urls):
        vid_id = extract_video_id(url)
        if vid_id in seen_ids:
            logger.info(f"Skipping duplicate video: {vid_id}")
            continue
        seen_ids.add(vid_id)

        # Check metadata for user-provided URLs (warning only — never skip).
        if target:
            try:
                meta_cmd = [
                    YT_DLP,
                    YT_DLP_JS_RUNTIME,
                    "--dump-json",
                    "--no-playlist",
                    "--socket-timeout", "15",
                    url,
                ]
                meta = await _run_ytdlp_json(meta_cmd, timeout=30)
                if meta:
                    info = meta[0]
                    title = info.get("title", "?")
                    if not _target_in_metadata(target, info):
                        logger.warning(
                            f"  Target '{target}' not found in title/description of "
                            f"user-provided URL: {title[:80]} — downloading anyway"
                        )
                    else:
                        # Run LLM classifier for an additional quality check
                        classifications = await _classify_via_js(target, [info])
                        cls = classifications.get(info.get("id", ""), "primary")
                        if cls != "primary":
                            logger.warning(
                                f"  LLM classifies as '{cls}': {title[:80]} — "
                                f"may not feature {target} as a speaker"
                            )
            except Exception as e:
                logger.warning(f"  Could not fetch metadata for {url}: {e}")

        output_template = work_dir / f"v{i}_%(id)s.%(ext)s"

        cmd = [
            YT_DLP,
            YT_DLP_JS_RUNTIME,
            "-f", "bestaudio/best",
            "--extract-audio",
            "--audio-format", "wav",
            "--audio-quality", "0",
            "--output", str(output_template),
            "--no-playlist",
            "--no-continue",
            "--socket-timeout", "30",
            "--retries", "2",
            url,
        ]

        logger.info(f"Downloading [{i + 1}/{len(urls)}]: {url}")
        try:
            await _run_ytdlp(cmd, timeout=120)
        except subprocess.CalledProcessError as e:
            logger.error(f"yt-dlp failed for '{url}': {e.stderr[:200]}")
        except subprocess.TimeoutExpired as e:
            stderr = (e.stderr or b"") if isinstance(e.stderr, bytes) else (e.stderr or "")
            stderr = stderr[:200] if stderr else "(no output)"
            logger.error(f"yt-dlp timed out for '{url}': {stderr}")

        for wav in sorted(work_dir.glob(f"v{i}_*.wav")):
            all_wavs.append(wav)

    logger.info(f"Downloaded {len(all_wavs)} videos from {len(urls)} URLs ({len(urls) - len(all_wavs)} failed)")
    return all_wavs


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

class SampleGenerator:
    def __init__(self, target: str, num_videos: int = 5,
                 auto_threshold: float | None = None, skip_verify: bool = False,
                 max_per_video: int = 3, max_total: int = MAX_SAMPLES_PER_IDENTITY):
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

    async def download(self, work_dir: Path) -> list:
        return await search_and_download(self.target, self.num_videos, work_dir)

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
                # Jitter the gap threshold so merge boundaries vary across runs.
                max_gap_s = 0.3 + random.random() * 0.5  # 0.3–0.8s
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
                    chunk = audio[start_sample:end_sample].copy()
                    duration = end_s - start_s
                    if 2.0 <= duration <= 60.0:
                        raw_segments.append({
                            "audio": chunk,
                            "duration": round(duration, 2),
                            "start": round(start_s, 2),
                            "source": wav_path.name,
                        })
                del audio
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

    def _load_reference_embedding(self) -> tuple[torch.Tensor | None, list[torch.Tensor]]:
        """Load existing approved embeddings for this slug and return their
        L2-normalized mean as a reference centroid, plus any negative embeddings
        from previously rejected segments. Returns (None, []) if no
        existing embeddings found."""
        pos_files = sorted(AUDIO_LIBRARY.glob(f"{self.slug}.embedding"))
        pos_files += sorted(AUDIO_LIBRARY.glob(f"{self.slug}-*.embedding"))
        neg_lib = NEGATIVE_AUDIO_LIBRARY
        neg_files = sorted(neg_lib.glob(f"{self.slug}.negative.*.embedding")) if neg_lib.exists() else []

        refs = []
        for ef in pos_files:
            try:
                emb = torch.load(str(ef), weights_only=False)
                if emb.dim() == 2:
                    emb = emb.squeeze(0)
                refs.append(emb)
            except Exception as e:
                logger.warning(f"Failed to load reference embedding {ef}: {e}")

        negs = []
        for nf in neg_files:
            try:
                emb = torch.load(str(nf), weights_only=False)
                if emb.dim() == 2:
                    emb = emb.squeeze(0)
                negs.append(emb)
            except Exception as e:
                logger.warning(f"Failed to load negative embedding {nf}: {e}")

        if not refs:
            return None, negs

        ref_matrix = torch.stack(refs).numpy()
        ref_centroid = normalize(ref_matrix.mean(axis=0, keepdims=True), norm="l2")
        if negs:
            logger.info(f"Loaded {len(refs)} reference(s) from {AUDIO_LIBRARY} and {len(negs)} negative(s) for '{self.target}' from {neg_lib}")
        else:
            logger.info(f"Loaded {len(refs)} reference embedding(s) for '{self.target}' from {AUDIO_LIBRARY}")
        return torch.from_numpy(ref_centroid), negs

    def _load_library_centroids(self) -> dict[str, torch.Tensor]:
        """Load centroid embeddings for every speaker in the audio library except the target.

        Returns a dict mapping speaker slug to L2-normalized centroid tensor.
        Speakers with only a single embedding are included as-is.
        """
        all_embeddings = sorted(AUDIO_LIBRARY.glob("*.embedding"))
        by_speaker: dict[str, list[torch.Tensor]] = {}

        for emb_path in all_embeddings:
            name = emb_path.stem
            base = re.sub(r"-\d+$", "", name)
            if base == self.slug:
                continue

            try:
                emb = torch.load(str(emb_path), weights_only=False)
                if emb.dim() == 2:
                    emb = emb.squeeze(0)
                by_speaker.setdefault(base, []).append(emb)
            except Exception:
                pass

        centroids = {}
        for speaker, refs in by_speaker.items():
            matrix = torch.stack(refs).numpy()
            centroids[speaker] = torch.from_numpy(
                normalize(matrix.mean(axis=0, keepdims=True), norm="l2")
            )

        return centroids

    def _load_existing_individuals(self) -> list[torch.Tensor]:
        """Load all individual embeddings for this speaker (not centroids)."""
        emb_files = sorted(AUDIO_LIBRARY.glob(f"{self.slug}.embedding"))
        emb_files += sorted(AUDIO_LIBRARY.glob(f"{self.slug}-*.embedding"))
        refs = []
        for ef in emb_files:
            try:
                emb = torch.load(str(ef), weights_only=False)
                if emb.dim() == 2:
                    emb = emb.squeeze(0)
                refs.append(emb)
            except Exception:
                pass
        return refs

    def cluster_and_score(self, segments: list, min_cluster_ratio: float = 0.1,
                          min_ref_similarity: float = 0.2):
        """
        Cluster embeddings. If existing reference embeddings exist, ALL clusters
        whose centroid similarity to the reference exceeds min_ref_similarity are
        selected as target (to capture the same speaker across different acoustic
        conditions). Otherwise clusters with at least min_cluster_ratio of total
        segments are selected, to avoid discarding entire source videos.

        After filtering, at least one segment from each source video is
        guaranteed by pulling in the best segment from any missing source.

        Score each segment by cosine similarity to its cluster centroid.
        Also computes ref_score (similarity to reference centroid) when available.
        """
        ref_centroid, negs = self._load_reference_embedding()

        if len(segments) < 2:
            library_centroids = self._load_library_centroids()
            for s in segments:
                s["score"] = 1.0
                s["is_target"] = True
                if ref_centroid is not None:
                    emb_np = s["embedding"].squeeze(0).numpy()
                    emb_norm = normalize(emb_np.reshape(1, -1), norm="l2")
                    ref_sim = float(emb_norm @ ref_centroid.numpy().T)
                    s["ref_score"] = round(max(0.0, min(1.0, ref_sim)), 4)
                    # Downgrade if closer to a negative than to the reference
                    if negs:
                        neg_sims = [float(emb_norm @ neg.numpy().T) for neg in negs]
                        max_neg = max(neg_sims)
                        s["neg_score"] = round(max_neg, 4)
                        if max_neg >= ref_sim:
                            s["is_target"] = False
                # Cross-reference against library speakers
                if library_centroids:
                    e = normalize(s["embedding"].squeeze(0).numpy().reshape(1, -1), norm="l2")
                    best_sim = 0.0
                    best_speaker = None
                    for speaker, centroid in library_centroids.items():
                        sim = float(e @ centroid.numpy().T)
                        if sim > best_sim:
                            best_sim = sim
                            best_speaker = speaker
                    if best_sim >= 0.70:
                        s["score"] = round(s["score"] * (1.0 - best_sim), 4)
                        s["cross_match"] = best_speaker
                        s["cross_match_score"] = round(best_sim, 4)
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
            # No reference: include all clusters with non-trivial size to ensure
            # diverse acoustic conditions / source videos are represented.
            # A single speaker recorded in different environments often splits
            # across clusters; taking only the largest discards entire videos.
            min_cluster_size = max(2, int(len(segments) * min_cluster_ratio))
            target_labels = {label for label in unique
                             if counts[unique == label][0] >= min_cluster_size}
            if not target_labels:
                target_labels = {unique[counts.argmax()]}
            total_target = sum(counts[unique == l][0] for l in target_labels)
            logger.info(
                f"Clusters: {dict(zip(unique.tolist(), counts.tolist()))}, "
                f"target clusters (size >= {min_cluster_size}): {sorted(target_labels)} "
                f"({total_target} segments)"
            )

        # --- Cross-video constraint ---
        # A voice that appears across multiple source videos is far more
        # likely to be the target than a voice found in only one. Require
        # target clusters to span at least 2 different videos when enough
        # sources exist; otherwise a single-video rando can dominate a cluster.
        total_sources = len({s.get("source") for s in segments})
        if total_sources >= 3:
            cluster_sources = {}
            for i, s in enumerate(segments):
                src = s.get("source", "")
                cluster_sources.setdefault(labels[i], set()).add(src)

            multi_source_labels = {
                label for label in target_labels
                if len(cluster_sources.get(label, set())) >= 2
            }

            if multi_source_labels:
                dropped = target_labels - multi_source_labels
                if dropped:
                    dropped_srcs = {label: sorted(cluster_sources.get(label, set()))
                                    for label in dropped}
                    logger.info(
                        f"Cross-video filter: dropped cluster(s) {dropped_srcs} "
                        f"(span < 2 source videos)"
                    )
                target_labels = multi_source_labels
            else:
                logger.warning(
                    f"No cluster spans 2+ source videos; "
                    f"keeping original target clusters {sorted(target_labels)}"
                )
                # Keep original target_labels — don't return nothing.

        # Score each segment
        neg_filtered = 0
        for i, s in enumerate(segments):
            centroid = centroids[labels[i]]
            sim = float((emb_norm[i] @ centroid.T).item())
            s["score"] = round(max(0.0, min(1.0, sim)), 4)
            s["cluster"] = int(labels[i])
            s["is_target"] = labels[i] in target_labels
            if ref_centroid is not None:
                ref_sim = float(emb_norm[i] @ ref_centroid.numpy().T)
                s["ref_score"] = round(max(0.0, min(1.0, ref_sim)), 4)
                if negs:
                    neg_sims = [float(emb_norm[i] @ neg.numpy().T) for neg in negs]
                    max_neg = max(neg_sims)
                    s["neg_score"] = round(max_neg, 4)
                    # Segment is closer to a known non-target speaker than to the
                    # target: exclude from target set regardless of cluster.
                    if max_neg >= ref_sim:
                        s["is_target"] = False
                        neg_filtered += 1
        if neg_filtered:
            logger.info(f"Negatives filtered {neg_filtered} segment(s) that matched known non-target speakers")

        # Cross-reference against every speaker in the audio library: discount
        # segments whose embedding is closer to an existing speaker (who isn't
        # the target) than to the target's own centroid. A segment that matches
        # "donald-trump" at 0.85 while we're building "joe-biden" gets its
        # score multiplied by (1 - 0.85) = 0.15.
        library_centroids = self._load_library_centroids()
        if library_centroids:
            cross_penalized = 0
            for i, s in enumerate(segments):
                e = emb_norm[i].reshape(1, -1)
                best_speaker = None
                best_sim = 0.0
                for speaker, centroid in library_centroids.items():
                    sim = float(e @ centroid.numpy().T)
                    if sim > best_sim:
                        best_sim = sim
                        best_speaker = speaker
                if best_sim >= 0.70:
                    s["score"] = round(s["score"] * (1.0 - best_sim), 4)
                    s["cross_match"] = best_speaker
                    s["cross_match_score"] = round(best_sim, 4)
                    cross_penalized += 1
            if cross_penalized:
                logger.info(f"Cross-reference: discounted {cross_penalized} segment(s) matching existing library speakers")

        # Filter: keep only target cluster, above score threshold
        min_score = 0.65
        target_segments = [
            s for s in segments
            if s.get("is_target") and s["score"] >= min_score
        ]

        # Sort by score descending
        target_segments.sort(key=lambda s: s["score"], reverse=True)

        # Ensure at least one segment from each source video survives.
        # Without a reference embedding, clustering can split the same speaker
        # across clusters by acoustic environment, and the score threshold can
        # filter out entire videos. Pull in the best segment from any missing
        # source even if it falls below the score threshold.
        seen_sources = {s.get("source") for s in target_segments}
        non_target = [s for s in segments
                      if s.get("source") and s["source"] not in seen_sources
                      and not s.get("is_target")]
        non_target.sort(key=lambda s: s.get("score", 0), reverse=True)
        added_sources = set()
        for s in non_target:
            src = s["source"]
            if src not in seen_sources and src not in added_sources:
                s["is_target"] = True
                s["score"] = max(s.get("score", 0), 0.0)
                target_segments.append(s)
                added_sources.add(src)
        if added_sources:
            target_segments.sort(key=lambda s: s["score"], reverse=True)
            logger.info(
                f"Added {len(added_sources)} segment(s) from "
                f"under-represented source(s): {sorted(added_sources)}"
            )

        source_count = len({s.get("source") for s in target_segments})
        logger.info(
            f"Target clusters yield {len(target_segments)} segments "
            f"from {source_count} source(s) above score {min_score}. "
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

async def verify_via_telegram(generator: SampleGenerator, work_dir: Path):
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

    # Scale review batch down as library grows: fewer sources and fewer
    # per-video segments needed once we have a solid reference to rank against.
    existing_count = count_samples(slug)
    if existing_count >= 5:
        max_per_video = 1
        min_sources = 2
    elif existing_count >= 3:
        max_per_video = 2
        min_sources = 3
    else:
        max_per_video = generator.max_per_video
        min_sources = 5

    # Load existing embeddings for dedup checks (only when library exists)
    existing_individuals = generator._load_existing_individuals() if existing_count > 0 else []

    # Select a diverse subset for human review (per-source cap, source
    # diversity guarantee, batch cap) — see select_review_subset.
    review_indices, _diverse, seen_sources = select_review_subset(
        segments, max_per_video=max_per_video, min_sources=min_sources
    )
    review_set_indices = set(review_indices)

    # Only the review set plus a bounded spare pool per video is persisted.
    persist_set = select_persist_subset(segments, review_indices)

    if len(review_indices) < len(segments):
        logger.info(
            f"Diverse review: {len(review_indices)}/{len(segments)} segments "
            f"from {len(seen_sources)} video(s) (max {min(max_per_video, MAX_REVIEW_PER_VIDEO)}/video, "
            f"min {min_sources} sources, batch cap {MAX_REVIEW_PER_BATCH}); "
            f"persisting {len(persist_set)}"
        )

    # Persist segments to disk so they survive past this process.
    segments_dir = work_dir / "segments"
    segments_dir.mkdir(exist_ok=True)

    pre_approved_idxs = []
    needs_approval = 0
    sent_count = 0

    # Persist the review set + bounded spare pool and register those in Redis.
    # Trimmed segments are dropped entirely (no files, no verification state).
    for i, seg in enumerate(segments):
        if i not in persist_set:
            continue
        score = seg["score"]
        in_review = i in review_set_indices
        is_pre_approved = False

        # Save WAV + embedding to disk
        wav_path = segments_dir / f"{slug}_{i}.wav"
        emb_path = segments_dir / f"{slug}_{i}.embedding"
        sf.write(str(wav_path), seg["audio"], 16000)
        torch.save(seg["embedding"], str(emb_path))

        set_verification_state(slug, i, {
            "target": target,
            "score": score,
            "duration": seg["duration"],
            "start": seg.get("start"),
            "source": seg.get("source", ""),
            "ogg_path": str(seg["ogg_path"]),
            "wav_path": str(wav_path),
            "emb_path": str(emb_path),
            "work_dir": str(work_dir),
            "approved": True if is_pre_approved else None,
            "ref_score": seg.get("ref_score"),
        })

        if not in_review:
            continue
        if score >= 1.0:
            logger.info(f"  Segment {i} skipped (score=1.0, likely duplicate)")
            continue

        # Near-duplicate of an existing library sample — skip review.
        if existing_individuals and seg.get("ref_score") is not None:
            emb_np = seg["embedding"].squeeze(0).numpy()
            emb_n = normalize(emb_np.reshape(1, -1), norm="l2")
            max_dup = max(
                float(emb_n @ normalize(ref.numpy().reshape(1, -1), norm="l2").T)
                for ref in existing_individuals
            )
            if max_dup > 0.95:
                logger.info(f"  Segment {i} skipped (near-duplicate of existing, sim={max_dup:.3f})")
                continue

        # When we already have a solid library, skip segments that are
        # acoustically redundant — very close to what we already have.
        if existing_count >= 3 and seg.get("ref_score") is not None and seg["ref_score"] >= 0.90:
            logger.info(f"  Segment {i} skipped (acoustically redundant, ref_score={seg['ref_score']:.3f})")
            continue

        needs_approval += 1
        source = seg.get("source", "").replace(".wav", "")
        vid_id = source.split("_", 1)[1] if "_" in source else source
        source_url = f"https://youtube.com/watch?v={vid_id}" if vid_id else "unknown"

        # Find the review-set display number for this segment
        display_num = review_indices.index(i) + 1 if i in review_set_indices else i + 1
        caption = (
            f"🎙️ {target} — sample {display_num}/{len(review_set_indices)}\n"
            f"Confidence: {score:.3f} | Duration: {seg['duration']:.1f}s\n"
            f"Source: {source_url}"
        )

        keyboard = build_inline_keyboard([
            [("✅ Approve", f"{CALLBACK_PREFIX}:approve:{slug}:{i}"),
             ("❌ Reject", f"{CALLBACK_PREFIX}:reject:{slug}:{i}")],
            [("🎯 Best per source", f"{CALLBACK_PREFIX}:auto_best:{slug}:{i}")],
        ])

        result = send_telegram_voice(
            str(seg["ogg_path"]),
            caption=caption,
            reply_markup=keyboard,
            channel="voice",
        )

        if result.get("ok"):
            sent_count += 1
            msg_result = result.get("result", {})
            update_verification_state(slug, i, {
                "message_id": msg_result.get("message_id"),
                "chat_id": msg_result.get("chat", {}).get("id") or msg_result.get("chat_id"),
            })
            logger.info(f"  Sent segment {i} (score={score:.3f})")
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

def save_to_library(generator: SampleGenerator, approved_indices: list,
                    max_total: int = MAX_SAMPLES_PER_IDENTITY):
    """Save approved segments to ~/audio-library/ as WAV + compute .embedding.
    Enforces max_total cap across all runs for this speaker."""
    slug = generator.slug
    embedder = generator.embedder
    segments = generator.segments

    AUDIO_LIBRARY.mkdir(parents=True, exist_ok=True)

    # Count existing samples for this slug
    existing_count = count_samples(slug)
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
    next_idx = next_sample_index(slug)

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
    parser.add_argument("--max-per-video", type=int, default=3,
                        help="Max samples to keep per source video (default: 3, hard max 4)")
    parser.add_argument("--max-total", type=int, default=MAX_SAMPLES_PER_IDENTITY,
                        help=f"Max total samples per speaker across all runs (default: {MAX_SAMPLES_PER_IDENTITY})")
    parser.add_argument("--video-url", action="append", default=None,
                        help="YouTube URL or video ID to download (repeatable, skips search)")
    parser.add_argument("--videos-file", type=str, default=None,
                        help="File with one YouTube URL/ID per line (skips search)")
    args = parser.parse_args()

    # Serialize runs so only one yt-dlp instance runs at a time.
    # Concurrent yt-dlp processes trigger YouTube rate limiting and
    # JS challenge solving that causes consistent 90s timeouts.
    lock_fd = open(LOCK_FILE, "w")
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        logger.error("Another generate_samples.py instance is already running. Exiting.")
        sys.exit(1)

    # Collect manual URLs if provided
    urls = []
    if args.video_url:
        urls.extend(args.video_url)
    if args.videos_file:
        with open(args.videos_file) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    urls.append(line)

    generator = SampleGenerator(
        target=args.target,
        num_videos=args.num_videos,
        auto_threshold=args.auto_threshold,
        skip_verify=args.skip_verify,
        max_per_video=min(args.max_per_video, MAX_REVIEW_PER_VIDEO),
        max_total=args.max_total,
    )

    # Work in a temp directory
    work_dir = PENDING_DIR / f"{generator.slug}_{os.urandom(4).hex()}"
    work_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"Working directory: {work_dir}")

    # Stop generating once the identity is at the sample limit
    existing_count = count_samples(generator.slug)
    if existing_count >= MAX_SAMPLES_PER_IDENTITY:
        logger.info(f"'{args.target}' already has {existing_count} samples (limit: {MAX_SAMPLES_PER_IDENTITY}). Skipping generation.")
        send_telegram(
            f"📦 *{args.target}* already has {existing_count} samples (limit: {MAX_SAMPLES_PER_IDENTITY}). Skipping generation.",
            "voice",
        )
        return

    pending = 0

    try:
        # 1. Download
        if urls:
            logger.info(f"Using {len(urls)} provided URL(s) (search disabled)")
            wav_paths = await download_from_urls(urls, work_dir, target=args.target)
        else:
            wav_paths = await generator.download(work_dir)
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
            approved, pending = await verify_via_telegram(generator, work_dir)

        # 9. Save pre-approved segments immediately; pending ones are saved
        #    asynchronously by telegram_server via the save-samples queue.
        if approved:
            save_to_library(generator, approved, max_total=generator.max_total)

    finally:
        fcntl.flock(lock_fd, fcntl.LOCK_UN)
        lock_fd.close()

        # Only clean up if no pending verifications; otherwise the save
        # job (triggered by telegram_server callbacks) will clean up.
        if pending > 0:
            logger.info(f"Keeping {work_dir} — {pending} segment(s) awaiting async verification")
        else:
            logger.info(f"Cleaning up {work_dir}")
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
