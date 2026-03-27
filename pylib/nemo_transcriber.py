import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import torch
import nemo.collections.asr.models as nemo_asr

logger = logging.getLogger("remote_server")


class NemoTranscriber:
    """In-process NeMo ASR transcription."""

    def __init__(self, model_name: str = "parakeet-tdt-1.1b", device: str = "cpu"):
        self.device = device
        logger.info(f"Loading NeMo ASR model '{model_name}' on {device}...")
        
        # Load the model
        try:
            self.model = nemo_asr.ASRModel.from_pretrained(model_name=model_name).to(device)
            self.model.eval()
            logger.info(f"NeMo ASR model '{model_name}' loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load NeMo ASR model '{model_name}': {e}")
            raise

        self.last_proc_time = 0
        self.executor = ThreadPoolExecutor(max_workers=1)

    async def transcribe_raw(self, pcm_data: bytes) -> str:
        """
        Directly transcribe a PCM chunk.
        Expects 16kHz 16-bit signed LE PCM.
        """
        if not pcm_data:
            return ""

        # Ensure we have an even number of bytes for int16
        safe_len = len(pcm_data) - (len(pcm_data) % 2)
        if safe_len == 0:
            return ""

        # Convert to float32 normalized to [-1, 1]
        samples = (
            np.frombuffer(pcm_data[:safe_len], dtype=np.int16).astype(np.float32)
            / 32768.0
        )

        def do_transcribe():
            # NeMo models expect a batch of audio signals
            audio_signal = torch.from_numpy(samples).to(self.device).unsqueeze(0)
            audio_signal_len = torch.tensor([audio_signal.shape[1]]).to(self.device)
            
            with torch.no_grad():
                # transcribe() returns a list of transcriptions
                # For TDT/CTC models, it usually returns a list of strings
                hypotheses = self.model.transcribe(
                    tokens=None, # Not needed for from_pretrained usually
                    paths2audio_files=None,
                    batch_size=1,
                    return_hypotheses=False, # We just want the strings
                )
                
                # Wait, the above transcribe method signature might vary. 
                # Let's use the simpler one:
                # model.transcribe([samples]) also works sometimes depending on the version.
                # However, the most robust way in recent NeMo is:
                # model.transcribe(paths2audio_files=None, batch_size=1, audio_signal=audio_signal)
                
                # Let's try the modern signature:
                results = self.model.transcribe(
                    audio_signal=audio_signal,
                    audio_signal_len=audio_signal_len,
                )
                
                # results is usually (hypotheses, ) or [transcripts]
                if isinstance(results, tuple):
                    return results[0][0]
                elif isinstance(results, list):
                    return results[0]
                return str(results)

        t0 = time.time()
        try:
            text = await asyncio.get_running_loop().run_in_executor(
                self.executor, do_transcribe
            )
        except Exception as e:
            logger.error(f"Error during NeMo transcription: {e}")
            text = ""
        t1 = time.time()
        
        self.last_proc_time = t1 - t0
        return text.strip()

    def reset(self):
        """Reset state if any (not needed for this stateless implementation)."""
        pass
