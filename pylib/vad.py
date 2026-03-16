import torch
import numpy as np
import logging
import nemo.collections.asr.models as nemo_asr

logger = logging.getLogger("remote_server")

class VoiceActivityDetector:
    def __init__(self, device: str = "cpu"):
        self.device = device
        logger.info(f"Loading NeMo VAD model (marblenet) on {device}...")
        self.model = nemo_asr.EncDecClassificationModel.from_pretrained(
            model_name="vad_marblenet"
        ).to(device)
        self.model.eval()
        
        # VAD thresholds
        self.threshold = 0.5
        self.sample_rate = 16000
        
    def is_speech(self, audio_data: np.ndarray) -> bool:
        """
        Check if the given audio chunk contains speech.
        Expects 16kHz float32 audio.
        """
        if len(audio_data) == 0:
            return False
            
        audio_tensor = torch.from_numpy(audio_data).to(self.device).unsqueeze(0)
        audio_len = torch.tensor([audio_tensor.shape[1]]).to(self.device)
        
        with torch.no_grad():
            logits = self.model.forward(
                input_signal=audio_tensor, input_signal_length=audio_len
            )
            # Marblenet VAD output is usually [batch, classes] where class 1 is speech
            probs = torch.softmax(logits, dim=-1)
            speech_prob = probs[0][1].item()
            
        return speech_prob > self.threshold

    async def get_speech_prob(self, audio_data: np.ndarray) -> float:
        """Asynchronous wrapper for speech probability."""
        if len(audio_data) == 0:
            return 0.0
            
        audio_tensor = torch.from_numpy(audio_data).to(self.device).unsqueeze(0)
        audio_len = torch.tensor([audio_tensor.shape[1]]).to(self.device)
        
        with torch.no_grad():
            logits = self.model.forward(
                input_signal=audio_tensor, input_signal_length=audio_len
            )
            probs = torch.softmax(logits, dim=-1)
            return probs[0][1].item()
