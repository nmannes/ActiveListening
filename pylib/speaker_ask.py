"""speaker_ask.py — live human-in-the-loop speaker identification.

When the live session can't confidently identify a speaker, build a Telegram
ask (voice clip + optional video GIF + candidate photos + answer buttons) and
apply the human's answer: label the speaker for the session, whitelist them
for trading when they are a market entity, and curate a few quality-checked
slices of the retained audio into the voice library (label != save — samples
are saved only when they pass the quality and diversity gates below).

Runs on the EC2 GPU server (has the speaker WAVs, ffmpeg, TitaNet and
Telegram).  Callbacks arrive from telegram_server (local) via Redis + the
client's WebSocket bridge — see lib/speaker_confirmations.js.
"""

import asyncio
import io
import json
import logging
import os
import re
import subprocess
import time
import wave
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

import numpy as np

from pylib.ask_callbacks import CallbackTooLong, build_ask_keyboard
from pylib.identity_photos import get_photo_url
from pylib.sample_library import MAX_SAMPLES_PER_IDENTITY, count_samples, slugify
from pylib.telegram import (
    send_telegram,
    send_telegram_animation,
    send_telegram_photo,
    send_telegram_voice,
)

logger = logging.getLogger("remote_server")

PCM_BYTES_PER_SEC = 32000
WAV_HEADER_BYTES = 44
SAMPLE_RATE = 16000

# A confirmation must be backed by audio that still sounds like the audio the
# ask was built from — otherwise a late click (after a diarization change or
# Deepgram reconnect) could label/save the wrong person.
SELF_SIMILARITY_FLOOR = 0.5
# Curated chunks must agree with each other at least this much (rejects
# straddling slices that overlap another speaker).
CHUNK_PAIRWISE_FLOOR = 0.5

FFMPEG_BIN = os.environ.get("FFMPEG_BIN", "ffmpeg")

# Entities that describe a role, not a person — you can't save a voice sample
# for "Reporters", and confirming one wouldn't identify anybody.
GENERIC_ENTITY_RE = re.compile(
    r"^(reporters?|panelists?|commentators?|announcers?|hosts?|moderators?|"
    r"advertis(?:e|ing|ement)|advertisement|n/?a)$",
    re.IGNORECASE,
)


def is_person_like(entity: str) -> bool:
    return not GENERIC_ENTITY_RE.match((entity or "").strip())


def rank_candidates(entities, scores, max_candidates):
    """Rank market entities by their best-scoring reference embedding.

    entities: display names.  scores: {reference_key: cosine} straight from
    SpeakerIdentifier.  Entities with no reference come last.  Returns a list
    of (name, best_score | None) truncated to *max_candidates*, keeping all
    scored entities before any unscored ones.
    """
    scored, unscored = [], []
    for name in entities:
        slug = slugify(name)  # library reference keys use the same normalization
        relevant = [
            score for key, score in (scores or {}).items()
            if key == slug or key.startswith(slug + "-") or key.startswith(slug + "_")
        ]
        (scored if relevant else unscored).append(
            (name, max(relevant) if relevant else None)
        )
    scored.sort(key=lambda x: x[1], reverse=True)
    return (scored + unscored)[:max_candidates]


def read_recent_pcm(wav_path, seconds: float) -> Optional[np.ndarray]:
    """Trailing *seconds* of a 16-bit PCM WAV as float32 mono 16 kHz.

    Reads raw past the 44-byte header, so it works while the file is still
    being appended to by AudioProcessor (header sizes are not yet finalized).
    """
    try:
        with open(str(wav_path), "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            start = max(WAV_HEADER_BYTES, size - int(seconds * PCM_BYTES_PER_SEC))
            f.seek(start)
            raw = f.read()
        if not raw:
            return None
        return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    except Exception as e:
        logger.error(f"[ask] failed reading {wav_path}: {e}")
        return None


def encode_ogg(pcm_f32: np.ndarray) -> Optional[bytes]:
    """Encode float32 mono 16 kHz PCM to OGG/Opus bytes (ffmpeg stdout — no temp files)."""
    raw = (np.clip(pcm_f32, -1.0, 1.0) * 32767).astype(np.int16).tobytes()
    cmd = [
        FFMPEG_BIN, "-hide_banner", "-loglevel", "error",
        "-f", "s16le", "-ar", str(SAMPLE_RATE), "-ac", "1", "-i", "pipe:0",
        "-c:a", "libopus", "-b:a", "32k", "-ar", str(SAMPLE_RATE), "-ac", "1",
        "-f", "ogg", "pipe:1",
    ]
    try:
        proc = subprocess.run(cmd, input=raw, capture_output=True, timeout=30)
    except Exception as e:
        logger.error(f"[ask] ffmpeg ogg encode failed: {e}")
        return None
    if proc.returncode != 0 or not proc.stdout:
        logger.error(f"[ask] ffmpeg ogg encode rc={proc.returncode}: {proc.stderr[:200]!r}")
        return None
    return proc.stdout


def _wav_bytes(pcm_f32: np.ndarray) -> bytes:
    """16-bit mono 16 kHz WAV with a RIFF header (like the library's other .wav files)."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes((np.clip(pcm_f32, -1.0, 1.0) * 32767).astype(np.int16).tobytes())
    return buf.getvalue()


def _cosine(a, b) -> Optional[float]:
    """Cosine similarity between two embedding tensors (device-safe)."""
    try:
        import torch
        a = a.detach().to("cpu").float().reshape(-1)
        b = b.detach().to("cpu").float().reshape(-1)
        return float(torch.nn.functional.cosine_similarity(a, b, dim=0))
    except Exception:
        return None


@dataclass
class AskRecord:
    """State kept between sending an ask and the human answering it."""

    spk: str
    slug: str
    epoch: int                     # audio_processor.dg_epoch when asked
    candidates: List[Tuple[str, Optional[float]]] = field(default_factory=list)
    embedding: object = None       # torch.Tensor of the ask audio
    retained_pcm: Optional[np.ndarray] = None
    created_at: float = 0.0
    resolved: bool = False


class SpeakerAskManager:
    """Per-session ask gating, message building, and confirmation handling."""

    def __init__(self, recognition, config: dict):
        self.recognition = recognition
        self.session = recognition.listening_session
        self.config = config or {}
        self.slug = getattr(self.session, "session_id", "unknown")

        self.asks: dict = {}                # spk -> AskRecord (pending)
        self.ignored: set = set()           # spk ignored this session
        self._ask_offsets: dict = {}        # spk -> WAV byte offset of last ask
        self._asked_at: dict = {}           # spk -> ts of last ask
        self.ask_count = 0
        self.last_ask_ts = 0.0
        self._tasks: set = set()
        self._closed = False

    # ------------------------------------------------------------------
    # Asking
    # ------------------------------------------------------------------

    async def maybe_ask(self):
        """Entry point from the identity-inference loop.  Never raises."""
        if self._closed or not self.config.get("enabled", True):
            return
        try:
            await self._maybe_ask_inner()
        except Exception:
            logger.exception(f"[{self.slug}] speaker-ask pass failed")

    async def _maybe_ask_inner(self):
        ws = getattr(self.session, "websocket", None)
        if ws is None or getattr(ws, "closed", False):
            return

        now = time.time()
        if self.ask_count >= int(self.config.get("maxAsksPerSession", 10)):
            return
        if now - self.last_ask_ts < float(self.config.get("minGapSecs", 45)):
            return

        entities = [e for e in self.recognition.market_entities if is_person_like(e)]
        if not entities:
            return

        audio_processor = getattr(self.session, "audio_processor", None)
        audio_dir = getattr(audio_processor, "_audio_dir", None) if audio_processor else None
        identifier = getattr(getattr(self.session, "server", None), "speaker_identifier", None)
        if audio_dir is None or identifier is None:
            return

        min_bytes = int(float(self.config.get("minAudioSecs", 10)) * PCM_BYTES_PER_SEC)
        min_words = int(self.config.get("minWords", 8))
        cooldown = float(self.config.get("perSpeakerCooldownSecs", 300))

        for wav_path in sorted(audio_dir.glob("speaker_*.wav")):
            spk = wav_path.stem.replace("speaker_", "")
            if spk in self.recognition.profile_labels:
                continue  # already labeled (machine or human)
            if spk in self.ignored or spk in self.asks:
                continue
            if spk in self._asked_at and now - self._asked_at[spk] < cooldown:
                continue
            try:
                size = wav_path.stat().st_size
            except OSError:
                continue
            new_bytes = size - self._ask_offsets.get(spk, 0)
            if new_bytes < min_bytes:
                continue
            tokens = self.session.transcript.get(spk) or []
            if len(tokens) < min_words:
                continue

            # Gates passed — spawn the (slow: embedding + ffmpeg + Telegram)
            # ask as a background task so the 10s inference loop never blocks.
            self._ask_offsets[spk] = size
            self._asked_at[spk] = now
            self.ask_count += 1
            self.last_ask_ts = now
            logger.info(
                f"[{self.slug}] Speaker {spk}: {new_bytes / PCM_BYTES_PER_SEC:.1f}s new "
                f"audio, {len(tokens)} words — asking the operator (ask {self.ask_count})"
            )
            self._spawn(self._send_ask(spk, wav_path, identifier, entities))
            return  # one ask per pass

    def _spawn(self, coro):
        task = asyncio.ensure_future(coro)
        self._tasks.add(task)

        def _done(t):
            self._tasks.discard(t)
            if t.cancelled():
                return
            exc = t.exception()
            if exc:
                logger.error(f"[{self.slug}] speaker-ask task failed: {exc!r}")

        task.add_done_callback(_done)
        return task

    def _speaker_wav(self, spk: str):
        audio_processor = getattr(self.session, "audio_processor", None)
        audio_dir = getattr(audio_processor, "_audio_dir", None) if audio_processor else None
        if audio_dir is None:
            return None
        return audio_dir / f"speaker_{spk}.wav"

    async def _send_ask(self, spk, wav_path, identifier, entities):
        ask_secs = float(self.config.get("askAudioSecs", 10))
        retain_secs = float(self.config.get("retainAudioSecs", 30))
        max_candidates = int(self.config.get("maxCandidates", 8))

        pcm = await asyncio.to_thread(read_recent_pcm, wav_path, retain_secs)
        if pcm is None or len(pcm) < SAMPLE_RATE:
            return
        ask_pcm = pcm[-int(ask_secs * SAMPLE_RATE):]

        _, scores, embedding = await identifier.identify_with_embedding(ask_pcm)
        if embedding is None:
            logger.warning(f"[{self.slug}] speaker {spk}: could not embed ask audio")
            return

        candidates = rank_candidates(entities, scores, max_candidates)
        if not candidates:
            return

        audio_processor = getattr(self.session, "audio_processor", None)
        record = AskRecord(
            spk=spk,
            slug=self.slug,
            epoch=getattr(audio_processor, "dg_epoch", 0),
            candidates=candidates,
            embedding=embedding,
            retained_pcm=pcm,
            created_at=time.time(),
        )

        ogg = await asyncio.to_thread(encode_ogg, ask_pcm)
        if ogg is None:
            return
        self.asks[spk] = record

        caption = self._ask_caption(spk, candidates, scores)
        try:
            keyboard = build_ask_keyboard(
                [(name, name) for name, _ in candidates], self.slug, spk
            )
        except CallbackTooLong as e:
            logger.error(f"[{self.slug}] cannot build ask keyboard: {e}")
            self.asks.pop(spk, None)
            return

        result = await asyncio.to_thread(
            send_telegram_voice, ogg, caption, keyboard, "voice"
        )
        if not result.get("ok"):
            logger.error(f"[{self.slug}] ask send failed for speaker {spk}: {result}")
            self.asks.pop(spk, None)
            return
        logger.info(f"[{self.slug}] ask sent for speaker {spk} ({len(candidates)} candidates)")

        gif_bytes = await self._fetch_gif(record)
        if gif_bytes:
            res = await asyncio.to_thread(
                send_telegram_animation, gif_bytes, None, None, "voice"
            )
            if not res.get("ok"):
                logger.warning(f"[{self.slug}] GIF send failed: {res}")

        if self.config.get("photos", {}).get("enabled", True):
            max_photos = int(self.config.get("photos", {}).get("maxPerAsk", 8))
            for name, _score in candidates[:max_photos]:
                url = await asyncio.to_thread(get_photo_url, name)
                if not url:
                    continue
                await asyncio.to_thread(send_telegram_photo, url, f"👤 {name}", "voice")
                await asyncio.sleep(0.3)

    def _ask_caption(self, spk, candidates, scores):
        """Neutral caption — candidates are listed flat (no 'recommended'
        highlight) to avoid anchoring the operator on the top match."""
        try:
            title = (self.session.market or {}).get("title", self.slug)
        except Exception:
            title = self.slug
        lines = [
            f"❓ Who is speaking? — {title}",
            f"Speaker {spk} is unlabeled ({float(self.config.get('askAudioSecs', 10)):.0f}s clip).",
        ]
        top = [(n, s) for n, s in candidates if s is not None][:5]
        if top:
            lines.append("Reference scores: " + ", ".join(f"{n} {s:.2f}" for n, s in top))
        lines.append("Pick a name, ✏️ Other to type one, or 🚫 Ignore.")
        return "\n".join(lines)[:1024]

    async def _fetch_gif(self, record: AskRecord):
        """Ask the client for a GIF of the video around the ask (Phase 2).

        Returns raw GIF bytes, or None when disabled/unsupported/timed out —
        the ask still goes out without it.
        """
        gif_cfg = self.config.get("gif", {}) or {}
        if not gif_cfg.get("enabled", True):
            return None
        request_gif = getattr(self.session, "request_gif", None)
        if request_gif is None:
            return None
        ask_secs = float(self.config.get("askAudioSecs", 10))
        max_span = float(gif_cfg.get("maxSpanSecs", 20))
        age_oldest = min(ask_secs + 4.0, max_span)
        try:
            return await request_gif(
                age_newest=0.0,
                age_oldest=age_oldest,
                timeout=float(gif_cfg.get("timeoutSecs", 12)),
                fps=int(gif_cfg.get("fps", 4)),
                width=int(gif_cfg.get("width", 320)),
            )
        except Exception as e:
            logger.warning(f"[{self.slug}] GIF request failed: {e}")
            return None

    # ------------------------------------------------------------------
    # Confirmation (human -> server)
    # ------------------------------------------------------------------

    async def handle_confirmation(self, msg: dict):
        """Handle a `speaker_confirmed` WS message from the local client.

        Applies in a background task: guards (epoch + self-similarity), then
        label + whitelist, and (gated) library sample curation.
        """
        spk = str(msg.get("spk", ""))
        record = self.asks.get(spk)
        if record is None:
            logger.info(f"[{self.slug}] confirmation for unknown/expired speaker {spk!r} — ignored")
            return
        self.asks.pop(spk, None)
        record.resolved = True
        self._spawn(self._apply_confirmation(record, msg))

    async def _apply_confirmation(self, record: AskRecord, msg: dict):
        spk = record.spk
        action = msg.get("action")

        # Guard 1: Deepgram reconnects reset speaker IDs — a confirmation that
        # lands after a reconnect may point at a different person.
        audio_processor = getattr(self.session, "audio_processor", None)
        current_epoch = getattr(audio_processor, "dg_epoch", 0) if audio_processor else 0
        if current_epoch != record.epoch:
            logger.warning(
                f"[{self.slug}] confirmation for speaker {spk} rejected: Deepgram epoch "
                f"{record.epoch} -> {current_epoch}"
            )
            await self._reply("⚠️ Deepgram reconnected since this ask — speaker IDs may have changed. It will re-ask if the speaker is still unknown.")
            return

        # Guard 2: the speaker's current audio must still sound like the ask audio.
        sim = await self._self_similarity(record)
        if sim is None or sim < SELF_SIMILARITY_FLOOR:
            logger.warning(
                f"[{self.slug}] confirmation for speaker {spk} rejected: "
                f"self-similarity={sim}"
            )
            await self._reply("⚠️ The speaker's audio changed since this ask — not applying. It will re-ask if still unknown.")
            return

        if action == "ignore":
            self.ignored.add(spk)
            logger.info(f"[{self.slug}] speaker {spk} ignored by operator (sim={sim:.3f})")
            await self._reply(f"🚫 Speaker {spk} ignored for this session (no label, nothing saved).")
            return

        if action == "confirm":
            idx = int(msg.get("idx", -1))
            if not (0 <= idx < len(record.candidates)):
                logger.error(f"[{self.slug}] confirm idx {idx} out of range for speaker {spk}")
                return
            entity = record.candidates[idx][0]
        elif action == "other":
            raw = (msg.get("entity") or "").strip()
            if len(raw) < 3:
                logger.info(f"[{self.slug}] 'other' name too short: {raw!r} — ignored")
                return
            canonical = next(
                (e for e in self.recognition.market_entities if e.lower() == raw.lower()),
                None,
            )
            entity = canonical or raw
        else:
            logger.warning(f"[{self.slug}] unknown confirmation action: {action!r}")
            return

        # Label (sticky against machine re-checks) + whitelist when the
        # entity belongs to one of the session's markets.
        self.recognition.set_profile_label(spk, entity, force=True)
        self.recognition.human_labels.add(spk)

        whitelisted = False
        is_market_entity = any(
            e.lower() == entity.lower() for e in self.recognition.market_entities
        )
        if is_market_entity and hasattr(self.session, "trade_processor"):
            market_indices = self.recognition._entity_market_indices(entity)
            self.session.trade_processor.add_trading_speaker(spk, market_indices=market_indices)
            whitelisted = True

        saved = await self._save_samples(record, entity)

        what = f"labeled as {entity}"
        if whitelisted:
            what += " + added to trading whitelist"
        if saved:
            what += f" + saved {saved} voice sample(s)"
        logger.info(
            f"[{self.slug}] speaker {spk} {what} (sim={sim:.3f}, action={action})"
        )
        await self._reply(f"✅ Speaker {spk} {what}.")

    async def _self_similarity(self, record: AskRecord) -> Optional[float]:
        """Cosine between the speaker's current recent audio and the ask audio."""
        wav_path = self._speaker_wav(record.spk)
        identifier = getattr(getattr(self.session, "server", None), "speaker_identifier", None)
        if wav_path is None or identifier is None:
            return None
        pcm = await asyncio.to_thread(read_recent_pcm, wav_path, 10.0)
        if pcm is None or len(pcm) < SAMPLE_RATE:
            return None
        embedding = await identifier.embed_audio(pcm)
        if embedding is None or record.embedding is None:
            return None
        return _cosine(embedding, record.embedding)

    async def _reply(self, text: str):
        try:
            await asyncio.to_thread(send_telegram, text, "voice")
        except Exception:
            logger.exception(f"[{self.slug}] failed sending ask reply")

    # ------------------------------------------------------------------
    # Sample curation (label != save)
    # ------------------------------------------------------------------

    async def _save_samples(self, record: AskRecord, entity: str) -> int:
        """Curate retained PCM into <= samplesPerConfirm chunks and distribute.

        Gates: chunk cosine to the ask embedding >= chunkFloor; chunks agree
        with each other (pairwise >= CHUNK_PAIRWISE_FLOOR); not a near-duplicate
        of existing library references; identity below MAX_SAMPLES_PER_IDENTITY.

        Distribution: S3 (speaker_embeddings/) + a WS push to the local client,
        which is the library of record and writes the only new files anywhere.
        Returns the number of samples saved.
        """
        cfg = self.config
        want = int(cfg.get("samplesPerConfirm", 3))
        if want <= 0 or record.retained_pcm is None or record.embedding is None:
            return 0
        identifier = getattr(getattr(self.session, "server", None), "speaker_identifier", None)
        if identifier is None:
            return 0

        slug = slugify(entity)
        if not slug:
            return 0
        existing = count_samples(slug)
        if existing >= MAX_SAMPLES_PER_IDENTITY:
            await self._reply(
                f"📦 {entity} is at the sample cap ({existing}/{MAX_SAMPLES_PER_IDENTITY}) — nothing saved."
            )
            return 0

        window = cfg.get("chunkSecs", [3, 6]) or [3, 6]
        lo_secs, hi_secs = int(window[0]), int(window[1])
        chunk_floor = float(cfg.get("chunkFloor", 0.60))
        dup_ceiling = float(cfg.get("nearDuplicateCeiling", 0.95))

        chunks = await self._curate_chunks(
            record, identifier, lo_secs, hi_secs, chunk_floor, dup_ceiling, slug
        )
        chunks = chunks[: want]
        if not chunks:
            logger.info(f"[{self.slug}] no samples passed curation for {entity}")
            return 0

        files = []
        base_index = existing  # best-effort local name; the writer resolves collisions
        for offset, (chunk_pcm, chunk_emb) in enumerate(chunks):
            name = f"{slug}-{base_index + offset}"
            wav_bytes = _wav_bytes(chunk_pcm)
            emb_buf = io.BytesIO()
            try:
                import torch
                torch.save(chunk_emb, emb_buf)
            except Exception as e:
                logger.error(f"[{self.slug}] embedding serialize failed: {e}")
                continue
            embed_bytes = emb_buf.getvalue()
            files.append((name, wav_bytes, embed_bytes))
            # In-process reference so the speaker self-identifies now.
            try:
                await identifier.add_reference(name, chunk_emb)
            except Exception:
                logger.exception(f"[{self.slug}] add_reference failed for {name}")

        if not files:
            return 0

        self._upload_to_s3(files)
        await self._push_to_client(files)

        logger.info(
            f"[{self.slug}] saved {len(files)} sample(s) for {entity}: "
            f"{[name for name, _, _ in files]}"
        )
        return len(files)

    async def _curate_chunks(self, record, identifier, lo_secs, hi_secs,
                             chunk_floor, dup_ceiling, slug):
        """Select up to *want* chunk embeddings (see _save_samples for gates).

        Returns a list of (pcm, embedding) in preference order.
        """
        pcm = record.retained_pcm
        chunk_len = int(hi_secs * SAMPLE_RATE)
        hop = max(int(lo_secs * SAMPLE_RATE), chunk_len // 2)
        if len(pcm) < chunk_len:
            return []

        # Existing references for this identity (near-duplicate gate).
        existing_refs = [
            emb for key, emb in identifier.references.items()
            if key == slug or key.startswith(slug + "-") or key.startswith(slug + "_")
        ]

        scored = []
        for start in range(0, len(pcm) - chunk_len + 1, hop):
            chunk = pcm[start:start + chunk_len]
            emb = await identifier.embed_audio(chunk)
            if emb is None:
                continue
            sim = _cosine(emb, record.embedding)
            if sim is None or sim < chunk_floor:
                continue
            if existing_refs:
                max_dup = max((_cosine(emb, ref) or 0.0) for ref in existing_refs)
                if max_dup > dup_ceiling:
                    logger.debug(
                        f"[{self.slug}] chunk dropped: near-duplicate of existing ref "
                        f"(sim={max_dup:.3f})"
                    )
                    continue
            scored.append((sim, start, chunk, emb))

        # Greedy by similarity to the ask audio, keeping only chunks that
        # agree with the ones already chosen (same-speaker consistency).
        scored.sort(key=lambda x: x[0], reverse=True)
        kept = []
        for sim, _start, chunk, emb in scored:
            if kept and min((_cosine(emb, k[3]) or 0.0) for k in kept) < CHUNK_PAIRWISE_FLOOR:
                continue
            kept.append((sim, _start, chunk, emb))
        return [(chunk, emb) for _sim, _start, chunk, emb in kept]

    def _upload_to_s3(self, files):
        """Best-effort upload of curated samples (never blocks the loop)."""
        try:
            import boto3
            bucket = os.environ.get("S3_BUCKET", "recordings-846345203908-us-east-1-an")
            s3 = boto3.client("s3")
            for name, wav_bytes, embed_bytes in files:
                for suffix, blob in ((".wav", wav_bytes), (".embedding", embed_bytes)):
                    s3.upload_fileobj(
                        io.BytesIO(blob), bucket, f"speaker_embeddings/{name}{suffix}"
                    )
            logger.info(f"[{self.slug}] uploaded {len(files)} sample(s) to s3://{bucket}/speaker_embeddings/")
        except Exception as e:
            logger.error(f"[{self.slug}] S3 sample upload failed: {e}")

    async def _push_to_client(self, files):
        """Push sample bytes to the local client (library of record)."""
        import base64
        payload = {
            "type": "sample_saved",
            "slug": self.slug,
            "files": [
                {
                    "name": name,
                    "wav_b64": base64.b64encode(wav).decode(),
                    "embedding_b64": base64.b64encode(emb).decode(),
                }
                for name, wav, emb in files
            ],
        }
        try:
            await self.session.websocket.send(json.dumps(payload))
        except Exception as e:
            logger.error(f"[{self.slug}] failed pushing samples to client: {e}")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self):
        self._closed = True
        for task in list(self._tasks):
            task.cancel()
        self._tasks.clear()
        self.asks.clear()
