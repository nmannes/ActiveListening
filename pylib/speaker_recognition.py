import os
import torch
import numpy as np
import logging
from pathlib import Path
import nemo.collections.asr.models as nemo_asr
from omegaconf import OmegaConf

logger = logging.getLogger("remote_server")

class SpeakerRecognizer:
    def __init__(self, device: str = "cpu"):
        self.device = device
        logger.info(f"Loading NeMo SpeakerVerificationModel on {device}...")
        
        # Using TitaNet-L for high accuracy speaker verification
        self.model = nemo_asr.SpeakerVerificationModel.from_pretrained(
            model_name="nvidia/speakerverification_en_titanet_l"
        ).to(device)
        self.model.eval()
        
        self.reference_embeddings = {}
        self.audio_samples_dir = Path(__file__).parent.parent / "audio-samples"
        logger.info(f"SpeakerRecognizer initialized. Reference dir: {self.audio_samples_dir}")

    def _get_embedding(self, audio_data: np.ndarray) -> torch.Tensor:
        """Extract speaker embedding from audio samples (16kHz, float32)."""
        audio_tensor = torch.from_numpy(audio_data).to(self.device).unsqueeze(0)
        audio_len = torch.tensor([audio_tensor.shape[1]]).to(self.device)
        
        with torch.no_grad():
            _, embedding = self.model.forward(input_signal=audio_tensor, input_signal_length=audio_len)
        return embedding

    def load_reference(self, profile_name: str):
        """Load and cache embedding for a reference speaker from audio-samples/."""
        if profile_name in self.reference_embeddings:
            return

        wav_path = self.audio_samples_dir / f"{profile_name}.wav"
        if not wav_path.exists():
            logger.error(f"Reference wav not found for profile '{profile_name}' at {wav_path}")
            return

        logger.info(f"Loading reference embedding for '{profile_name}'...")
        # NeMo expectations: 16kHz, single channel
        import librosa
        audio, _ = librosa.load(str(wav_path), sr=16000)
        self.reference_embeddings[profile_name] = self._get_embedding(audio)

    async def verify_speaker(self, pcm_data: bytes, profile_name: str) -> float:
        """
        Verify if the speaker in pcm_data matches the reference profile.
        Returns cosine similarity (0.0 to 1.0).
        """
        if profile_name not in self.reference_embeddings:
            self.load_reference(profile_name)
        
        if profile_name not in self.reference_embeddings:
            return 0.0

        # Convert PCM bytes to float32
        samples = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32) / 32768.0
        
        # Extract embedding for the current chunk
        current_embedding = self._get_embedding(samples)
        
        # Calculate cosine similarity
        ref_embedding = self.reference_embeddings[profile_name]
        
        similarity = torch.nn.functional.cosine_similarity(current_embedding, ref_embedding).item()
        return similarity
