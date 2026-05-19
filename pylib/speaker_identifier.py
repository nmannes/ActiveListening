import asyncio
import logging
import torch
import numpy as np
import librosa
from pathlib import Path
from typing import Dict, Optional, Tuple

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
        reference_dir: Optional[Path] = None,
        device: str = "cpu",
        threshold: float = 0.65,
    ):
        self.reference_dir = reference_dir or (
            Path(__file__).parent.parent / "audio-library"
        )
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

            if not self.reference_dir.exists():
                logger.warning(f"Reference dir not found: {self.reference_dir}. Skipping TitaNet load.")
                self._ready = True
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

            # Load every .embedding and .wav in reference_dir
            if not self.reference_dir.exists():
                logger.warning(f"Reference dir not found: {self.reference_dir}")
            else:
                # Load pre-computed embeddings first
                for emb_path in sorted(self.reference_dir.glob("*.embedding")):
                    name = emb_path.stem
                    logger.info(f"  loading pre-computed embedding: {name}")
                    try:
                        emb = await loop.run_in_executor(
                            None, lambda p=emb_path: torch.load(str(p), map_location=self.device)
                        )
                        self.references[name] = emb
                    except Exception as e:
                        logger.error(f"  Failed to load pre-computed embedding {emb_path}: {e}")

                # Load any wav files that don't have an embedding yet
                for wav in sorted(self.reference_dir.glob("*.wav")):
                    name = wav.stem                      # e.g. "jeff-probst"
                    if name in self.references:
                        continue
                        
                    logger.info(f"  computing reference embedding from wav: {name}")
                    audio = await loop.run_in_executor(
                        None, lambda p=wav: librosa.load(str(p), sr=16000)[0]
                    )
                    emb = await self._embed(audio)
                    if emb is not None:
                        self.references[name] = emb
                        
                        # Save the embedding for future use
                        emb_path = wav.with_suffix(".embedding")
                        try:
                            await loop.run_in_executor(
                                None, lambda p=emb_path, t=emb: torch.save(t, str(p))
                            )
                            logger.info(f"  saved pre-computed embedding to {emb_path}")
                        except Exception as e:
                            logger.error(f"  Failed to save embedding to {emb_path}: {e}")

            logger.info(
                f"SpeakerIdentifier ready – {len(self.references)} reference(s) loaded"
            )
            self._ready = True

    # ------------------------------------------------------------------
    # Core
    # ------------------------------------------------------------------

    async def identify(
        self, audio: np.ndarray, threshold: Optional[float] = None
    ) -> Tuple[Optional[str], Dict[str, float]]:
        """
        Identify who is speaking in *audio* (16 kHz float32 numpy array).

        Returns:
            (best_name, scores)
            best_name is None when nothing exceeds threshold.
            scores is a dict of {name: cosine_similarity} for every reference.
        """
        if not self._ready:
            await self.initialize()

        if not self.references:
            return None, {}

        thr = threshold if threshold is not None else self.threshold
        target = await self._embed(audio)
        if target is None:
            return None, {}

        scores: Dict[str, float] = {}
        for name, ref in self.references.items():
            sim = torch.nn.functional.cosine_similarity(target, ref).item()
            scores[name] = round(sim, 4)

        best_name = max(scores, key=scores.get)
        best_score = scores[best_name]

        if best_score >= thr:
            logger.info(
                f"Speaker identified: {best_name} ({best_score:.3f}) | all: {scores}"
            )
            return best_name, scores

        logger.debug(f"No match above {thr}. Scores: {scores}")
        return None, scores

    async def identify_file(
        self, path: Path, threshold: Optional[float] = None
    ) -> Tuple[Optional[str], Dict[str, float]]:
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
