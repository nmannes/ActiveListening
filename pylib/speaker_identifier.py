import asyncio
import logging
import re
import time
import torch
import numpy as np
import librosa
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from nemo.collections.asr.models import EncDecSpeakerLabelModel

logger = logging.getLogger("remote_server")


class SpeakerIdentifier:
    """
    Given a set of reference .wav files (one per known speaker),
    computes TitaNet embeddings and identifies the closest match
    for any new audio segment.

    Usage:
        identifier = SpeakerIdentifier()
        await identifier.initialize()                    # loads model + references
        name, score = await identifier.identify(pcm_np)  # 16kHz float32 numpy
    """

    def __init__(
        self,
        audio_library_path: Path,
        device: str = "cpu",
        threshold: float = 0.65,
        max_embeddings_per_identity: int = 20,
    ):
        self.reference_dir = Path(audio_library_path)
        self.device = device
        self.threshold = threshold
        # Active-gallery cap per identity: matching cost and max-of-N false
        # accepts both grow with the number of references, so only a bounded,
        # representative subset is kept in memory (the full library stays on
        # disk / S3).
        self.max_embeddings_per_identity = max_embeddings_per_identity

        self.model = None
        self.references: Dict[str, torch.Tensor] = {}   # name -> embedding
        self._ready = False
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Initialization
    # ------------------------------------------------------------------

    async def initialize(self):
        """Load model and pre-compute reference embeddings (idempotent)."""
        async with self._lock:
            if self._ready:
                return

            loop = asyncio.get_running_loop()

            logger.info("SpeakerIdentifier: loading TitaNet-Large …")
            self.model = await loop.run_in_executor(
                None,
                lambda: EncDecSpeakerLabelModel.from_pretrained(
                    model_name="titanet_large"
                ).to(self.device),
            )
            self.model.eval()

            # Ensure reference dir exists
            self.reference_dir.mkdir(parents=True, exist_ok=True)

            # Sync pre-computed embeddings from S3 speaker_embeddings folder
            try:
                import boto3
                import os

                bucket = os.environ.get("S3_BUCKET")
                if not bucket:
                    raise ValueError("S3_BUCKET not set in environment")
                s3 = boto3.client("s3")

                logger.info(f"Syncing speaker embeddings from s3://{bucket}/speaker_embeddings/...")
                resp = await loop.run_in_executor(
                    None,
                    lambda: s3.list_objects_v2(Bucket=bucket, Prefix="speaker_embeddings/")
                )

                contents = resp.get("Contents", [])
                download_count = 0
                for obj in contents:
                    key = obj.get("Key", "")
                    if key == "speaker_embeddings/":
                        continue
                    if key.endswith(".embedding"):
                        filename = os.path.basename(key)
                        dest_path = self.reference_dir / filename
                        if not dest_path.exists():
                            logger.info(f"Downloading missing embedding from S3: {filename}")
                            await loop.run_in_executor(
                                None,
                                lambda k=key, d=dest_path: s3.download_file(bucket, k, str(d))
                            )
                            download_count += 1
                logger.info(f"Downloaded {download_count} speaker embedding(s) from S3.")
            except Exception as e:
                logger.error(f"Failed to sync speaker embeddings from S3: {e}")

            # Load pre-computed embeddings, capped per identity.  Selection is
            # deterministic (bare slug first, then greedily the embedding least
            # similar to those already selected) instead of random, so matching
            # is reproducible across restarts while still spanning the range of
            # recording conditions in the library.
            all_embeddings = sorted(self.reference_dir.glob("*.embedding"))
            # Group by base identity: strip trailing "-\d+" suffix
            by_identity: Dict[str, List[Path]] = {}
            for emb_path in all_embeddings:
                base = re.sub(r"-\d+\.embedding$", ".embedding", emb_path.name)
                base_stem = base[:-10]  # strip ".embedding"
                by_identity.setdefault(base_stem, []).append(emb_path)
            for base_stem, emb_paths in by_identity.items():
                loaded: Dict[Path, torch.Tensor] = {}
                for emb_path in emb_paths:
                    try:
                        loaded[emb_path] = await loop.run_in_executor(
                            None, lambda p=emb_path: torch.load(str(p), map_location=self.device, weights_only=False)
                        )
                    except Exception as e:
                        logger.error(f"  Failed to load pre-computed embedding {emb_path}: {e}")
                cap = self.max_embeddings_per_identity
                if len(loaded) > cap:
                    selected = self._select_diverse(base_stem, loaded, cap)
                    logger.info(
                        f"  capping '{base_stem}' from {len(loaded)} to {len(selected)} embeddings (deterministic diverse subset)"
                    )
                else:
                    selected = sorted(loaded)
                for emb_path in selected:
                    name = emb_path.stem
                    logger.info(f"  loading pre-computed embedding: {name}")
                    self.references[name] = loaded[emb_path]

            logger.info(
                f"SpeakerIdentifier ready – {len(self.references)} reference(s) loaded"
            )
            self._ready = True

    # ------------------------------------------------------------------
    # Core
    # ------------------------------------------------------------------

    async def identify(
        self, audio: np.ndarray, threshold: Optional[float] = None
    ) -> Tuple[List[str], Dict[str, float]]:
        """
        Identify who is speaking in *audio* (16 kHz float32 numpy array).

        Returns:
            (matches, scores) where matches is a list of names whose
            cosine similarity meets or exceeds the threshold, sorted by
            score descending. Empty list when no reference passes threshold.
            scores is a dict of {name: cosine_similarity} for every reference.
        """
        matches, scores, _ = await self.identify_with_embedding(audio, threshold=threshold)
        return matches, scores

    async def identify_with_embedding(
        self, audio: np.ndarray, threshold: Optional[float] = None
    ) -> Tuple[List[str], Dict[str, float], Optional[torch.Tensor]]:
        """Like identify(), but also returns the embedding computed for *audio*.

        Callers can reuse the embedding (live speaker-ask stores it for the
        confirm-time self-similarity gate and for sample curation) without
        re-running the model.
        """
        if not self._ready:
            await self.initialize()

        if not self.references:
            return [], {}, None

        thr = threshold if threshold is not None else self.threshold
        target = await self._embed(audio)
        if target is None:
            return [], {}, None

        scores: Dict[str, float] = {}
        t0 = time.perf_counter()
        for name, ref in self.references.items():
            sim = torch.nn.functional.cosine_similarity(target, ref).item()
            scores[name] = round(sim, 4)
        cosine_elapsed = time.perf_counter() - t0

        matches = sorted(
            [name for name, score in scores.items() if score >= thr],
            key=lambda n: scores[n],
            reverse=True,
        )

        if matches:
            logger.info(
                f"[AUDIO] Speaker identified: {matches} (threshold={thr:.3f}, cosine_time={cosine_elapsed:.3f}s) | all: {scores}"
            )
        else:
            logger.debug(f"No match above {thr} (cosine_time={cosine_elapsed:.3f}s). Scores: {scores}")

        return matches, scores, target

    async def identify_file(
        self,
        path: Path,
        threshold: Optional[float] = None,
        start_frame: Optional[int] = None,
    ) -> Tuple[List[str], Dict[str, float]]:
        """Convenience wrapper that accepts a .wav path.

        With *start_frame*, only the audio from that sample frame to the end of
        the file is embedded — for identifying on the most recent audio of a
        WAV that is still being appended to, instead of re-embedding the full
        history.
        """
        loop = asyncio.get_running_loop()

        def _load_recent():
            # WAVs written by AudioProcessor are standard 16-bit PCM with a
            # 44-byte header.  Reading raw to EOF also works while the header
            # is unfinalized (file still open for writing).
            with open(str(path), "rb") as f:
                f.seek(44 + start_frame * 2)
                raw = f.read()
            return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0

        loader = (
            _load_recent
            if start_frame is not None
            else lambda: librosa.load(str(path), sr=16000)[0]
        )
        audio = await loop.run_in_executor(None, loader)
        return await self.identify(audio, threshold=threshold)

    async def embed_audio(self, audio: np.ndarray) -> Optional[torch.Tensor]:
        """Embedding for 16 kHz float32 audio, without scoring against references.

        Used by the live speaker-ask flow (confirm-time self-similarity gate
        and sample curation) so it never re-runs the model for scoring data it
        doesn't need.
        """
        if not self._ready:
            await self.initialize()
        return await self._embed(audio)

    def has_sample_for(self, entity: str) -> bool:
        """Check whether any reference embedding matches the given entity name."""
        slug = entity.replace(" ", "-").lower()
        return any(
            key == slug or key.startswith(slug + "-") or key.startswith(slug + "_")
            for key in self.references
        )

    def count_references(self, entity: str) -> int:
        """Number of active references for an identity (slug prefix match)."""
        slug = entity.replace(" ", "-").lower()
        return sum(
            1 for key in self.references
            if key == slug or key.startswith(slug + "-") or key.startswith(slug + "_")
        )

    async def add_reference(self, name: str, embedding: torch.Tensor):
        """Insert a newly-confirmed reference embedding (no disk I/O).

        Keeps the active gallery bounded: when the identity exceeds
        ``max_embeddings_per_identity``, the most redundant reference — the one
        with the highest similarity to another current reference — is dropped.
        The just-added reference is never evicted, so a human-confirmed sample
        identifies immediately in the running session.
        """
        async with self._lock:
            self.references[name] = embedding
            base = re.sub(r"-\d+$", "", name)
            keys = [
                k for k in self.references
                if k == base or k.startswith(base + "-") or k.startswith(base + "_")
            ]
            while len(keys) > self.max_embeddings_per_identity:
                victim = self._most_redundant(keys, exclude=name)
                if victim is None:
                    break
                logger.info(
                    f"SpeakerIdentifier: gallery cap — dropping redundant reference '{victim}'"
                )
                self.references.pop(victim, None)
                keys.remove(victim)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _suffix_key(stem: str, base_stem: str) -> Tuple[int, int]:
        """Sort key: bare canonical slug first, then numeric suffixes ascending."""
        if stem == base_stem:
            return (0, 0)
        m = re.search(r"-(\d+)$", stem)
        return (1, int(m.group(1)) if m else 0)

    @staticmethod
    def _flat(emb: torch.Tensor) -> torch.Tensor:
        return torch.nn.functional.normalize(
            emb.detach().to("cpu").float().reshape(-1), dim=0
        )

    @classmethod
    def _select_diverse(cls, base_stem: str, loaded: Dict[Path, torch.Tensor],
                        cap: int) -> List[Path]:
        """Deterministic farthest-point selection over one identity's embeddings.

        Starts from the canonical (bare) sample — or the lowest suffix — then
        repeatedly adds the embedding least similar to everything selected so
        far, keeping span across recording conditions within the cap.
        """
        ordered = sorted(loaded, key=lambda p: cls._suffix_key(p.stem, base_stem))
        if cap <= 0 or not ordered:
            return []
        flat = {p: cls._flat(loaded[p]) for p in ordered}
        selected = [ordered[0]]
        selected_set = {ordered[0]}
        while len(selected) < cap and len(selected) < len(ordered):
            sim, _, pick = min(
                (max(float(torch.dot(flat[p], flat[s])) for s in selected),
                 cls._suffix_key(p.stem, base_stem), p)
                for p in ordered if p not in selected_set
            )
            selected.append(pick)
            selected_set.add(pick)
        return selected

    def _most_redundant(self, keys: List[str], exclude: str) -> Optional[str]:
        """Key with the highest similarity to another current key, ignoring *exclude*.

        Ties prefer the higher numeric suffix so the bare canonical sample
        (suffix -1) survives near-duplicates.
        """
        def suffix_num(key: str) -> int:
            m = re.search(r"-(\d+)$", key)
            return int(m.group(1)) if m else -1

        flat = {k: self._flat(self.references[k]) for k in keys}
        best_key, best_rank = None, None
        for k in sorted(keys):
            if k == exclude:
                continue
            sim = max(
                (float(torch.dot(flat[k], flat[o])) for o in keys if o != k),
                default=-2.0,
            )
            rank = (sim, suffix_num(k))
            if best_rank is None or rank > best_rank:
                best_key, best_rank = k, rank
        return best_key

    async def _embed(self, audio: np.ndarray) -> Optional[torch.Tensor]:
        """Compute speaker embedding from 16 kHz float32 numpy array."""
        if self.model is None:
            return None

        loop = asyncio.get_running_loop()

        def _compute():
            with torch.no_grad():
                t = torch.from_numpy(audio).float().to(self.device).unsqueeze(0)
                length = torch.tensor([t.shape[1]], device=self.device)
                _, emb = self.model.forward(
                    input_signal=t, input_signal_length=length
                )
                return emb.cpu()

        try:
            return await loop.run_in_executor(None, _compute)
        except Exception as e:
            logger.error(f"Embedding computation failed: {e}")
            return None
