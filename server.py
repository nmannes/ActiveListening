#!/usr/bin/env python3
"""
server.py — Remote WebSocket server for audio transcription & Kalshi trading
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional, Dict, Any, Callable, Awaitable

import websockets
from websockets.server import WebSocketServerProtocol

from pylib.kalshi_client import KalshiClient
from pylib.keyword_matching import build_keyword_index
from pylib.audio_decoder import AudioDecoder
from pylib.transcriber import Transcriber
from pylib.nemo_transcriber import NemoTranscriber
from pylib.clip import FrameClassifier
from pylib.speaker_recognition import SpeakerRecognizer
from pylib.vad import VoiceActivityDetector
from pylib.token_processor import TokenProcessor
from pylib.audio_processor import AudioProcessor
from pylib.session_context import SessionContext
from pylib.frame_processor import FrameProcessor

# ── Logging ───────────────────────────────────────────────────────────

os.makedirs("debug", exist_ok=True)
os.makedirs("logs", exist_ok=True)

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

# ── Client Handler ───────────────────────────────────────────────

async def handle_client(
    websocket: WebSocketServerProtocol, 
    args: argparse.Namespace, 
    transcriber: Transcriber, 
    speaker_recognizer: SpeakerRecognizer, 
    vad: VoiceActivityDetector, 
    frame_classifier: FrameClassifier, 
    clip_executor: ThreadPoolExecutor, 
    vad_executor: ThreadPoolExecutor, 
    kalshi: KalshiClient, 
    trade_for_real: bool
) -> None:
    logger.info("[server] New client connection")
    
    audio_inbox = bytearray()
    audio_inbox_lock = threading.Lock()
    audio_task: Optional[asyncio.Task] = None
    frame_task: Optional[asyncio.Task] = None
    session_id: str = "unknown"

    try:
        async for message in websocket:
            if isinstance(message, str):
                msg = json.loads(message)
                if msg.get("type") == "ping":
                    await websocket.send(json.dumps({"type": "pong", "ts": msg.get("ts")}))
                    continue

                if msg.get("type") == "hello" and "market" in msg:
                    market = msg["market"]
                    audio_only = msg.get("audioOnly", False)
                    voice_profile = msg.get("voiceProfile")
                    session_id = market.get("slug", f"session-{int(time.time())}")
                    ctx = SessionContext(is_content_visible=audio_only)

                    logger.info(f"[{session_id}] Client identified: {market.get('title', session_id)} (audioOnly={audio_only})")

                    keyword_index = build_keyword_index(market.get("keywords", {}))
                    
                    token_processor = TokenProcessor(
                        session_id=session_id, 
                        websocket=websocket, 
                        keyword_index=keyword_index, 
                        market=market, 
                        kalshi=kalshi, 
                        trade_for_real=trade_for_real, 
                        buy_count=args.buy_count, 
                        last_words_count=args.last_words_count
                    )
                    
                    audio_processor = AudioProcessor(
                        session_id=session_id, 
                        websocket=websocket, 
                        transcriber=transcriber, 
                        vad=vad, 
                        vad_executor=vad_executor, 
                        speaker_recognizer=speaker_recognizer, 
                        voice_profile=voice_profile, 
                        token_processor=token_processor, 
                        get_content_visible_cb=lambda: ctx.is_content_visible
                    )

                    if audio_task: audio_task.cancel()
                    if frame_task: frame_task.cancel()

                    audio_task = asyncio.create_task(audio_processor.run(audio_inbox, audio_inbox_lock))
                    if not audio_only:
                        frame_processor = FrameProcessor(session_id, websocket, clip_executor, frame_classifier, ctx)
                        frame_task = asyncio.create_task(frame_processor.run())

                    logger.info(f"[{session_id}] Session ready")

            elif isinstance(message, bytes):
                if len(message) > 3 and message[0] == 0x01 and message[1] == 0xFF and message[2] == 0xD8:
                    frame_data = message[1:]
                    debug_dir = Path(__file__).parent / "debug"
                    (debug_dir / f"frame-{session_id}.jpg").write_bytes(frame_data)
                else:
                    with audio_inbox_lock:
                        audio_inbox.extend(message)
                        if len(audio_inbox) > 16000 * 2 * 30:
                            del audio_inbox[:len(audio_inbox) - 16000 * 2 * 30]

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        logger.info(f"[{session_id}][server] Client disconnected")
        if audio_task: audio_task.cancel()
        if frame_task: frame_task.cancel()

# ── Main ───────────────────────────────────────────────────────────

async def main() -> None:
    parser = argparse.ArgumentParser(description="Remote transcription & trading server")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--env", type=str, default="prod", choices=["prod", "demo"])
    parser.add_argument("--model", type=str, default=None)
    parser.add_argument("--device", type=str, default=os.environ.get("DEVICE", "cpu"), choices=["cpu", "cuda"])
    parser.add_argument("--buy-count", type=int, default=40)
    parser.add_argument("--last-words-count", type=int, default=7)
    parser.add_argument("--content-profile", type=str, default="basketball")
    parser.add_argument("--whisper", action="store_true")
    args = parser.parse_args()

    if args.model is None:
        args.model = "small.en" if args.device == "cuda" else "base.en"

    env_file = Path(__file__).parent / f".env.{args.env}"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

    trade_for_real = os.environ.get("TRADE_FOR_REAL", None) is not None
    logger.info(f"Environment: {args.env}, Trading enabled: {trade_for_real}")

    transcriber = Transcriber(model_size=args.model, device=args.device) if args.whisper else NemoTranscriber(device=args.device)
    speaker_recognizer = SpeakerRecognizer(device=args.device)
    vad = VoiceActivityDetector(device=args.device)
    frame_classifier = FrameClassifier(device=args.device, content_profile=args.content_profile)
    
    clip_executor = ThreadPoolExecutor(max_workers=1)
    vad_executor = ThreadPoolExecutor(max_workers=1)

    kalshi = KalshiClient(
        key_id=os.environ["KALSHI_KEY_ID"],
        private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
        environment=args.env,
    )

    logger.info(f"WebSocket server listening on port {args.port}")
    async with websockets.serve(
        lambda ws: handle_client(ws, args, transcriber, speaker_recognizer, vad, frame_classifier, clip_executor, vad_executor, kalshi, trade_for_real),
        "0.0.0.0", args.port, ping_interval=None, max_size=None
    ):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
