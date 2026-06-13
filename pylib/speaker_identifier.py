import asyncio
import logging
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
    ):
        self.reference_dir = Path(audio_library_path)
        self.device = device
        self.threshold = threshold

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

            # Load pre-computed embeddings
            for emb_path in sorted(self.reference_dir.glob("*.embedding")):
                name = emb_path.stem
                logger.info(f"  loading pre-computed embedding: {name}")
                try:
                    emb = await loop.run_in_executor(
                        None, lambda p=emb_path: torch.load(str(p), map_location=self.device, weights_only=False)
                    )
                    self.references[name] = emb
                except Exception as e:
                    logger.error(f"  Failed to load pre-computed embedding {emb_path}: {e}")

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
        if not self._ready:
            await self.initialize()

        if not self.references:
            return [], {}

        thr = threshold if threshold is not None else self.threshold
        target = await self._embed(audio)
        if target is None:
            return [], {}

        scores: Dict[str, float] = {}
        for name, ref in self.references.items():
            sim = torch.nn.functional.cosine_similarity(target, ref).item()
            scores[name] = round(sim, 4)

        matches = sorted(
            [name for name, score in scores.items() if score >= thr],
            key=lambda n: scores[n],
            reverse=True,
        )

        if matches:
            logger.info(
                f"[AUDIO] Speaker identified: {matches} (threshold={thr:.3f}) | all: {scores}"
            )
        else:
            logger.debug(f"No match above {thr}. Scores: {scores}")

        return matches, scores

    async def identify_file(
        self, path: Path, threshold: Optional[float] = None
    ) -> Tuple[List[str], Dict[str, float]]:
        """Convenience wrapper that accepts a .wav path."""
        loop = asyncio.get_running_loop()
        audio = await loop.run_in_executor(
            None, lambda: librosa.load(str(path), sr=16000)[0]
        )
        return await self.identify(audio, threshold=threshold)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

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
