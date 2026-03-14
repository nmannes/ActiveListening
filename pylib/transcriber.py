"""
transcriber.py — In-process faster-whisper transcription with sliding window.
"""

import asyncio
import logging
import math
import struct
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from faster_whisper import WhisperModel

logger = logging.getLogger("remote_server")


def calculate_rms(pcm_bytes: bytes) -> float:
    """Calculate RMS of 16-bit signed LE PCM."""
    n_samples = len(pcm_bytes) // 2
    if n_samples == 0:
        return 0.0
    samples = struct.unpack(f"<{n_samples}h", pcm_bytes[: n_samples * 2])
    sum_sq = sum((s / 32768.0) ** 2 for s in samples)
    return math.sqrt(sum_sq / n_samples)


class Transcriber:
    """In-process faster-whisper transcription with sliding window."""

    def __init__(self, model_size: str = "base.en", device: str = "cpu"):
        self.device = device
        compute_type = "float16" if device == "cuda" else "int8"
        logger.info(
            f"Loading Whisper model '{model_size}' on {device} ({compute_type})..."
        )
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("Whisper model loaded.")

        self.last_proc_time = 0
        self.executor = ThreadPoolExecutor(max_workers=1)

        # Sliding window config (primarily for CPU mode)
        self.sample_rate = 16000
        self.bytes_per_sample = 2
        self.window_secs = 3.0
        self.step_secs = 1.0
        self.window_bytes = int(
            self.window_secs * self.sample_rate * self.bytes_per_sample
        )
        self.step_bytes = int(self.step_secs * self.sample_rate * self.bytes_per_sample)

        self.audio_buffer = b""
        self.incoming = b""

    async def transcribe_raw(self, pcm_data: bytes) -> str:
        """Directly transcribe a PCM chunk without sliding window."""
        if not pcm_data:
            return ""

        safe_len = len(pcm_data) - (len(pcm_data) % 2)
        if safe_len == 0:
            return ""

        samples = (
            np.frombuffer(pcm_data[:safe_len], dtype=np.int16).astype(np.float32)
            / 32768.0
        )

        def do_transcribe():
            segments, _ = self.model.transcribe(
                samples,
                beam_size=1,
                language="en",
                vad_filter=False,
                condition_on_previous_text=False,
            )
            return " ".join(seg.text.strip() for seg in segments).strip()

        t0 = time.time()
        text = await asyncio.get_running_loop().run_in_executor(
            self.executor, do_transcribe
        )
        t1 = time.time()
        self.last_proc_time = t1 - t0
        return text

    async def feed(self, pcm_data: bytes) -> list[str]:
        """Feed PCM data and return a list of transcription results (may be empty)."""
        self.incoming += pcm_data
        results = []

        # Drop old audio if we are falling behind (max backlog 3 seconds)
        max_backlog = int(3.0 * self.sample_rate * self.bytes_per_sample)
        if len(self.incoming) > max_backlog:
            logger.warning(
                f"Dropping {len(self.incoming) - max_backlog} bytes of backlog to catch up!"
            )
            self.incoming = self.incoming[-max_backlog:]

        while len(self.incoming) >= self.step_bytes:
            chunk = self.incoming[: self.step_bytes]
            self.incoming = self.incoming[self.step_bytes :]

            self.audio_buffer += chunk
            if len(self.audio_buffer) > self.window_bytes:
                self.audio_buffer = self.audio_buffer[-self.window_bytes :]

            safe_len = len(self.audio_buffer) - (len(self.audio_buffer) % 2)
            if safe_len == 0:
                continue

            samples = (
                np.frombuffer(self.audio_buffer[:safe_len], dtype=np.int16).astype(
                    np.float32
                )
                / 32768.0
            )

            # Skip silence more aggressively
            rms = float(np.sqrt(np.mean(samples**2)))
            if rms < 0.01:  # Increased from 0.005
                continue

            def do_transcribe():
                segments, _ = self.model.transcribe(
                    samples,
                    beam_size=1,
                    language="en",
                    vad_filter=False,
                    condition_on_previous_text=False,
                )
                return " ".join(seg.text.strip() for seg in segments).strip()

            t0 = time.time()
            text = await asyncio.get_running_loop().run_in_executor(
                self.executor, do_transcribe
            )
            t1 = time.time()
            self.last_proc_time = t1 - t0

            if t1 - t0 > self.step_secs:
                logger.debug(
                    f"Transcription took {t1 - t0:.2f}s (>{self.step_secs}s step)"
                )

            if text:
                results.append(text)

        return results

    def reset(self):
        """Reset buffers for a new session."""
        self.audio_buffer = b""
        self.incoming = b""
