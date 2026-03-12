"""
audio_decoder.py — Decodes compressed audio to raw PCM via ffmpeg subprocess.
"""

import logging
import subprocess
import threading
from collections import deque

logger = logging.getLogger("remote_server")


class AudioDecoder:
    """Decodes compressed audio (RTP/AAC) to raw PCM via ffmpeg subprocess.

    Uses a background thread to read decoded PCM from ffmpeg stdout into a
    thread-safe buffer, so the async event loop never blocks.
    """

    def __init__(self, stream_url="udp://0.0.0.0:8092"):
        self.ffmpeg_log = open("ffmpeg.log", "a")
        self.proc = subprocess.Popen(
            [
                'ffmpeg',
                '-y',
                '-fflags', 'nobuffer+genpts+discardcorrupt',
                '-flags', 'low_delay',
                '-f', 's16le',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                '-i', stream_url,
                '-f', 's16le',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                'pipe:1',
            ],
            stdout=subprocess.PIPE,
            stderr=self.ffmpeg_log,
        )
        self._pcm_chunks = deque(maxlen=50)  # Cap at ~5s of audio to prevent stale backlog
        self._lock = threading.Lock()
        self._stopped = False

        # Background thread reads decoded PCM continuously
        self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._reader_thread.start()
        logger.info(f"[decoder] ffmpeg audio decoder started listening on {stream_url}")

    def _reader_loop(self):
        """Continuously read decoded PCM from ffmpeg stdout."""
        while not self._stopped:
            data = self.proc.stdout.read(3200)  # ~0.1s of 16kHz 16-bit mono
            if not data:
                break
            with self._lock:
                self._pcm_chunks.append(data)

    def drain(self) -> bytes:
        """Return all available decoded PCM without blocking."""
        with self._lock:
            if not self._pcm_chunks:
                return b""
            result = b"".join(self._pcm_chunks)
            self._pcm_chunks.clear()
            return result

    def kill(self):
        """Terminate the ffmpeg process."""
        self._stopped = True
        self.proc.kill()
        self.proc.wait()
        if hasattr(self, 'ffmpeg_log'):
            self.ffmpeg_log.close()
        logger.info("[decoder] ffmpeg decoder stopped")
