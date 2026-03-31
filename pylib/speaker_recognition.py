import os
import torch
import numpy as np
import logging
from pathlib import Path
import nemo.collections.asr.models as nemo_asr
from omegaconf import OmegaConf
from abc import ABC, abstractmethod

logger = logging.getLogger("remote_server")

# Note: Profile labels and mapping are now managed per-session via SpeakerRecognitionSession.

class BaseSpeakerRecognizer(ABC):
    @abstractmethod
    async def verify_speaker(self, data, profile_name: str) -> float:
        """
        Verify if the speaker in data matches the reference profile.
        Returns confidence score (0.0 to 1.0).
        """
        pass

class AudioSpeakerRecognizer(BaseSpeakerRecognizer):
    def __init__(self, listening_session, device: str = "cpu"):
        self.listening_session = listening_session
        self.device = device
        logger.info(f"Loading NeMo SpeakerVerificationModel on {device}...")

        # Using TitaNet-L for high accuracy speaker verification
        self.model = nemo_asr.EncDecSpeakerLabelModel.from_pretrained(
            model_name="titanet_large"
        ).to(device)
        self.model.eval()

        self.reference_embeddings = {}
        self.audio_samples_dir = Path(__file__).parent.parent / "audio-samples"
        logger.info(
            f"SpeakerRecognizer initialized. Reference dir: {self.audio_samples_dir}"
        )

    def _get_embedding(self, audio_data: np.ndarray) -> torch.Tensor:
        """Extract speaker embedding from audio samples (16kHz, float32)."""
        audio_tensor = torch.from_numpy(audio_data).to(self.device).unsqueeze(0)
        audio_len = torch.tensor([audio_tensor.shape[1]]).to(self.device)

        with torch.no_grad():
            _, embedding = self.model.forward(
                input_signal=audio_tensor, input_signal_length=audio_len
            )
        return embedding

    def load_reference(self, profile_name: str):
        """Load and cache embedding for a reference speaker from audio-samples/."""
        if profile_name in self.reference_embeddings:
            return

        wav_path = self.audio_samples_dir / f"{profile_name}.wav"
        if not wav_path.exists():
            logger.error(
                f"Reference wav not found for profile '{profile_name}' at {wav_path}"
            )
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

        similarity = torch.nn.functional.cosine_similarity(
            current_embedding, ref_embedding
        ).item()
        return similarity

class TranscriptSpeakerRecognizer(BaseSpeakerRecognizer):
    def __init__(self, listening_session):
        self.listening_session = listening_session

    async def verify_speaker(self, transcript_text: str, profile_name: str) -> float:
        """
        Verify if the transcript matches a profile using word analysis / NLP.
        """
        # TODO: Scaffold logic for transcript word analysis
        return 0.0

class SpeakerRecognitionSession:
    """Manages speaker recognition and entity mapping for a specific broadcast session."""
    def __init__(self, listening_session, market_entities: list[str]):
        self.listening_session = listening_session
        self.session_id = getattr(listening_session, "session_id", "unknown_session")
        self.market_entities = market_entities
        
        # Session-specific profile labels (e.g., "voice_profile_1": "advertisement")
        self.profile_labels = {}
        
        # Instantiated recognizers for this session
        self.audio_recognizer = AudioSpeakerRecognizer(listening_session=self.listening_session)
        self.transcript_recognizer = TranscriptSpeakerRecognizer(listening_session=self.listening_session)

    def set_profile_label(self, voice_profile_id: str, label: str):
        self.profile_labels[voice_profile_id] = label

    def map_voice_profile_to_entity(self, voice_profile_id: str) -> str | None:
        """
        Maps a given voice profile ID to a known entity in the market for this session.
        """
        label = self.profile_labels.get(voice_profile_id)
        if label == "advertisement":
            return "advertisement"

        # TODO: Implement mapping logic here
        # Speaker identification will be done on a loop. Given the speaker entities,
        # this function should attempt to assign a mapping of voice profile id
        # to the known entity in the market.
        return None

