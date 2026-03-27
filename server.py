#!/usr/bin/env python3
"""
server.py — Remote WebSocket server for audio transcription & Kalshi trading

Receives compressed audio (AAC/ADTS) from tvclient.js over WebSocket,
decodes to PCM via ffmpeg, transcribes in-process via faster-whisper,
does keyword matching, and trades on Kalshi.

Usage:
    python3 server.py --env prod --port 8090
    python3 server.py --env prod --port 8090 --model base.en --device cpu
"""

import argparse
import asyncio
import json
import numpy as np
import logging
import os
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import websockets

from pylib.kalshi_client import KalshiClient
from pylib.keyword_matching import build_keyword_index
from pylib.audio_decoder import AudioDecoder
from pylib.transcriber import Transcriber, calculate_rms
from pylib.nemo_transcriber import NemoTranscriber
from pylib.clip import FrameClassifier
from pylib.speaker_recognition import SpeakerRecognizer
from pylib.vad import VoiceActivityDetector
from pylib.audio_processor import AudioProcessor
from pylib.frame_processor import FrameProcessor

# ── Logging ───────────────────────────────────────────────────────────

os.makedirs("debug", exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d %(levelname)s [%(threadName)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stderr),
        logging.FileHandler("logs/remote_server.log"),
    ],
)
logger = logging.getLogger("remote_server")
transcript_logger = logging.getLogger("transcript")
transcript_logger.setLevel(logging.INFO)
transcript_logger.addHandler(logging.FileHandler("logs/transcript.log"))


# ── Main server ───────────────────────────────────────────────────────


class Config:
    def __init__(self, args):
        self.port = getattr(args, "port", 8090)
        self.env = getattr(args, "env", "prod")
        self.device = getattr(args, "device", os.environ.get("DEVICE", "cpu"))
        self.buy_count = getattr(args, "buy_count", 40)
        self.last_words_count = getattr(args, "last_words_count", 7)
        self.content_profile = getattr(args, "content_profile", "basketball")
        self.whisper = getattr(args, "whisper", False)
        self.model = getattr(args, "model", None)

        # Auto-select model based on device if not specified
        if self.model is None:
            self.model = "small.en" if self.device == "cuda" else "base.en"
            logger.info(f"Auto-selected model '{self.model}' for device '{self.device}'")

        # Load env file
        env_file = Path(__file__).parent / f".env.{self.env}"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())

        self.trade_for_real = os.environ.get("TRADE_FOR_REAL", None) is not None
        logger.info(f"Environment: {self.env}")
        logger.info(f"Trading enabled: {self.trade_for_real}")


class ClientSession:
    def __init__(self, websocket, server):
        self.websocket = websocket
        self.server = server
        self.session_id = None
        self.market = None
        self.audio_only = False
        self.voice_profile = None
        self.keyword_index = None
        
        self.transcript = []
        self.is_content_visible = False
        self.punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')
        self.last_proc_time = [0.0]
        
        # Simple thread-safe audio buffer — receives PCM from WebSocket binary messages
        self.audio_inbox = bytearray()
        self.audio_inbox_lock = threading.Lock()
        
        self.audio_task = None
        self.frame_task = None

    async def run(self):
        logger.info("[server] New client connection")
        try:
            async for message in self.websocket:
                # ── Text message: handshake ───────────────────────────
                if isinstance(message, str):
                    await self.handle_text_message(message)
                    continue

                # ── Binary message: PCM audio or video frame ─────────
                if isinstance(message, bytes):
                    await self.handle_binary_message(message)

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            sid = self.session_id if self.session_id else "unknown"
            logger.info(f"[{sid}][server] Client disconnected")
            self.cleanup()

    async def handle_text_message(self, message):
        try:
            msg = json.loads(message)
            if msg.get("type") == "ping":
                await self.websocket.send(
                    json.dumps({"type": "pong", "ts": msg.get("ts")})
                )
                return

            if msg.get("type") == "hello" and "market" in msg:
                await self.start_session(msg)
        except Exception as e:
            logger.error(f"Handshake parse error: {e}")

    async def start_session(self, msg):
        self.market = msg["market"]
        self.audio_only = msg.get("audioOnly", False)
        self.voice_profile = msg.get("voiceProfile")
        self.session_id = self.market.get("slug", f"session-{int(time.time())}")

        logger.info(
            f"[{self.session_id}] Client identified: {self.market.get('title', self.session_id)} (audioOnly={self.audio_only}, voiceProfile={self.voice_profile})"
        )

        if self.audio_only:
            self.is_content_visible = True

        # Build keyword index
        self.keyword_index = build_keyword_index(self.market.get("keywords", {}))
        logger.info(f"[{self.session_id}] Keyword index: {len(self.keyword_index)} last-words")

        # Save debug index
        debug_dir = Path(__file__).parent / "debug"
        debug_dir.mkdir(exist_ok=True)
        (debug_dir / f"indexedKeywordsByLastWord-{self.session_id}.json").write_text(
            json.dumps(self.keyword_index, indent=2, default=str)
        )

        if self.audio_task:
            self.audio_task.cancel()

        if not self.audio_only:
            self.frame_processor = FrameProcessor(self)
            self.frame_task = asyncio.create_task(self.frame_processor.run())
        else:
            logger.info(f"[{self.session_id}] Audio-only mode — skipping frame classification")

        # Start the background task that processes PCM from audio_inbox
        self.audio_processor = AudioProcessor(self)
        self.audio_task = asyncio.create_task(self.audio_processor.run())

        logger.info(f"[{self.session_id}] Session ready — receiving audio over WebSocket")

    async def handle_binary_message(self, message):
        # Video frames are tagged with 0x01 prefix + JPEG data (starts with FF D8)
        if (
            len(message) > 3
            and message[0] == 0x01
            and message[1] == 0xFF
            and message[2] == 0xD8
        ):
            # Video frame (JPEG) — confirmed by SOI marker
            frame_data = message[1:]
            logger.info(f"[{self.session_id}] frame received ({len(frame_data)} bytes)")

            # Save debug frame
            debug_dir = Path(__file__).parent / "debug"
            debug_dir.mkdir(exist_ok=True)
            if self.session_id:
                (debug_dir / f"frame-{self.session_id}.jpg").write_bytes(frame_data)
        else:
            # Audio PCM data
            with self.audio_inbox_lock:
                self.audio_inbox.extend(message)
            # Capping - keep 30 seconds max
            max_bytes = 16000 * 2 * 30
            if len(self.audio_inbox) > max_bytes:
                dropped_bytes = len(self.audio_inbox) - max_bytes
                del self.audio_inbox[:dropped_bytes]
                logger.warning(f"[{self.session_id}] Dropped {dropped_bytes} bytes from WebSocket inbox (30s cap)")


    def cleanup(self):
        if self.audio_task:
            self.audio_task.cancel()
        if self.frame_task:
            self.frame_task.cancel()


class TradingServer:
    def __init__(self, config):
        self.config = config
        
        # Shared resources
        logger.info(f"Using faster-whisper ({config.model})")
        self.transcriber = Transcriber(model_size=config.model, device=config.device)
        self.speaker_recognizer = SpeakerRecognizer(device=config.device)
        self.vad = VoiceActivityDetector(device=config.device)
        self.frame_classifier = FrameClassifier(
            device=config.device, content_profile=config.content_profile
        )
        
        self.clip_executor = ThreadPoolExecutor(max_workers=1)
        self.vad_executor = ThreadPoolExecutor(max_workers=1)

        # Init Kalshi client
        self.kalshi = KalshiClient(
            key_id=os.environ["KALSHI_KEY_ID"],
            private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
            environment=config.env,
        )

    async def handle_client(self, websocket):
        session = ClientSession(websocket, self)
        await session.run()

    async def start(self):
        logger.info(f"WebSocket server listening on port {self.config.port}")
        async with websockets.serve(
            self.handle_client, "0.0.0.0", self.config.port, ping_interval=None, max_size=None
        ):
            await asyncio.Future()  # run forever


async def main():
    parser = argparse.ArgumentParser(
        description="Remote transcription & trading server"
    )
    parser.add_argument("--port", type=int, default=8090, help="WebSocket listen port")
    parser.add_argument("--env", type=str, default="prod", choices=["prod", "demo"])
    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Whisper model name (default: small.en for cuda, base.en for cpu)",
    )
    parser.add_argument(
        "--device",
        type=str,
        default=os.environ.get("DEVICE", "cpu"),
        choices=["cpu", "cuda"],
    )
    parser.add_argument("--buy-count", type=int, default=40)
    parser.add_argument("--last-words-count", type=int, default=7)
    parser.add_argument(
        "--content-profile",
        type=str,
        default="basketball",
        help="CLIP content profile (default: basketball)",
    )
    parser.add_argument(
        "--whisper",
        action="store_true",
        help="Use faster-whisper instead of NeMo ASR (default)",
    )
 
    args = parser.parse_args()

    config = Config(args)
    server = TradingServer(config)
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
