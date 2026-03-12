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
from pylib.keyword_matching import build_keyword_index, find_keyword_match, remove_from_index, remove_market_from_index
from pylib.audio_decoder import AudioDecoder
from pylib.transcriber import Transcriber, calculate_rms
from pylib.clip import FrameClassifier
from pylib.speaker_recognition import SpeakerRecognizer

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


# ── Main server ───────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Remote transcription & trading server")
    parser.add_argument("--port", type=int, default=8090, help="WebSocket listen port")
    parser.add_argument("--env", type=str, default="prod", choices=["prod", "demo"])
    parser.add_argument("--model", type=str, default=None, help="Whisper model name (default: small.en for cuda, base.en for cpu)")
    parser.add_argument("--device", type=str, default=os.environ.get("DEVICE", "cpu"), choices=["cpu", "cuda"])
    parser.add_argument("--buy-count", type=int, default=1)
    parser.add_argument("--last-words-count", type=int, default=7)
    parser.add_argument("--content-profile", type=str, default="basketball", help="CLIP content profile (default: basketball)")
    args = parser.parse_args()

    # Auto-select model based on device if not specified
    if args.model is None:
        args.model = "small.en" if args.device == "cuda" else "base.en"
        logger.info(f"Auto-selected model '{args.model}' for device '{args.device}'")

    # Load env file
    env_file = Path(__file__).parent / f".env.{args.env}"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

    trade_for_real = os.environ.get("TRADE_FOR_REAL", None) is not None
    logger.info(f"Environment: {args.env}")
    logger.info(f"Trading enabled: {trade_for_real}")

    # Init transcriber
    transcriber = Transcriber(model_size=args.model, device=args.device)
    speaker_recognizer = SpeakerRecognizer(device=args.device)
    frame_classifier = FrameClassifier(device=args.device, content_profile=args.content_profile)
    clip_executor = ThreadPoolExecutor(max_workers=1)

    # Init Kalshi client
    kalshi = KalshiClient(
        key_id=os.environ["KALSHI_KEY_ID"],
        private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
        environment=args.env,
    )

    # ── Per-client handler ────────────────────────────────────────────

    async def handle_client(websocket):
        logger.info("[server] New client connection")


        session = None
        keyword_index = None
        voice_profile = None
        decoder = None
        transcript = []
        is_content_visible = False
        punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')

        last_proc_time = [0.0]

        async def audio_processing_loop(session_id, audio_inbox, audio_inbox_lock, keyword_index, voice_profile):
            transcript.clear()
            logger.info(f"[{session_id}] Audio processing loop started (Device: {transcriber.device}, voiceProfile: {voice_profile})")

            # Simple fixed-interval transcription: accumulate N seconds, transcribe, repeat
            CHUNK_SECS = 1.5
            CHUNK_BYTES = int(CHUNK_SECS * 16000 * 2)  # 16kHz, 16-bit mono
            audio_buffer = b""

            async def process_text(text: str):
                if not text:
                    return
                
                words = text.split()
                new_tokens = []
                for word in words:
                    token = punct_re.sub("", word).lower()
                    if not token:
                        continue

                    # Deduplicate adjacent
                    if transcript and transcript[-1] == token:
                        continue
                    if new_tokens and new_tokens[-1] == token:
                        continue

                    transcript.append(token)
                    new_tokens.append(token)
                    if len(transcript) > 500:
                        transcript.pop(0)

                    matched = find_keyword_match(keyword_index, transcript, token)
                    if matched:
                        logger.info(f"[{session_id}][SIGNAL] Detected: \"{matched['key']}\"")

                        # If voice profile is active, check speaker similarity
                        if voice_profile:
                            t0_speaker = time.time()
                            similarity = await speaker_recognizer.verify_speaker(chunk, voice_profile)
                            t1_speaker = time.time()
                            logger.info(f"[{session_id}][SPEAKER] Profile '{voice_profile}' similarity: {similarity:.4f} (took {t1_speaker - t0_speaker:.4f}s)")
                            
                            # Notify client of speaker match result
                            try:
                                await websocket.send(json.dumps({
                                    "type": "speaker_match",
                                    "profile": voice_profile,
                                    "similarity": similarity,
                                }))
                            except websockets.exceptions.ConnectionClosed:
                                pass

                            if similarity < 0.8:
                                logger.info(f"[{session_id}][SPEAKER] Skipping trade: speaker similarity {similarity:.4f} below threshold 0.8")
                                continue

                        if not is_content_visible:
                            logger.info(f"[{session_id}][TRADE] Skipping trade because desired content not on screen")
                        elif trade_for_real:

                            try:
                                t0_trade = time.time()
                                kalshi.place_fill_or_kill_order(
                                    yes_price=95,
                                    ticker=matched["value"],
                                    count=args.buy_count,
                                )
                                t1_trade = time.time()
                                logger.info(f"[{session_id}][TRADE] Successfully placed order for {matched['value']} (took {t1_trade - t0_trade:.4f}s)")
                            except Exception as e:
                                logger.error(f"[{session_id}][TRADE] Error placing order: {e}")
                        else:
                            logger.info(f"[{session_id}][TRADE] Not trading for real but \"{matched['key']}\" detected")


                        remove_market_from_index(keyword_index, matched["value"])
                        
                        # Notify client
                        try:
                            await websocket.send(json.dumps({
                                "type": "signal",
                                "keyword": matched["key"],
                                "ticker": matched["value"],
                            }))
                        except websockets.exceptions.ConnectionClosed:
                            pass

                if new_tokens:
                    recent = " ".join(transcript[-args.last_words_count:])
                    logger.info(f"[{session_id}] Transcript: {text} (Last {args.last_words_count}: {recent})")
                    try:
                        await websocket.send(json.dumps({
                            "type": "transcript",
                            "text": " ".join(new_tokens),
                        }))
                    except websockets.exceptions.ConnectionClosed:
                        pass

            async def telemetry_loop():
                while True:
                    await asyncio.sleep(5)
                    try:
                        # Audio buffer backlog in ms
                        with audio_inbox_lock:
                            inbox_ms = int(len(audio_inbox) / (16000 * 2) * 1000)
                        buffer_ms = int(len(audio_buffer) / (16000 * 2) * 1000)

                        await websocket.send(json.dumps({
                            "type": "telemetry",
                            "buffer_ms": inbox_ms + buffer_ms,
                            "last_proc_ms": int(last_proc_time[0] * 1000)
                        }))
                    except Exception:
                        break

            telemetry_task = asyncio.create_task(telemetry_loop())

            try:
                while True:
                    await asyncio.sleep(0.1)

                    # Drain audio from WebSocket inbox
                    with audio_inbox_lock:
                        if not audio_inbox:
                            continue
                        pcm_data = bytes(audio_inbox)
                        audio_inbox.clear()

                    audio_buffer += pcm_data

                    # Cap buffer to avoid runaway memory
                    if len(audio_buffer) > CHUNK_BYTES * 2:
                        audio_buffer = audio_buffer[-CHUNK_BYTES:]

                    # Transcribe every CHUNK_SECS
                    if len(audio_buffer) >= CHUNK_BYTES:
                        chunk = audio_buffer[:CHUNK_BYTES]
                        audio_buffer = audio_buffer[CHUNK_BYTES:]

                        # Skip silence — don't transcribe noise/music
                        rms = calculate_rms(chunk)
                        if rms < 0.01:
                            continue

                        t0_audio = time.time()
                        text = await transcriber.transcribe_raw(chunk)
                        last_proc_time[0] = time.time() - t0_audio
                        
                        await process_text(text)

            except asyncio.CancelledError:
                logger.info(f"[{session_id}] Audio processing loop cancelled")
            except Exception as e:
                logger.exception(f"[{session_id}] Unexpected error in audio_processing_loop: {e}")
            finally:
                if 'telemetry_task' in locals():
                    telemetry_task.cancel()

        # Simple thread-safe audio buffer — receives PCM from WebSocket binary messages
        audio_inbox = bytearray()
        audio_inbox_lock = threading.Lock()

        audio_task = None
        frame_task = None

        try:
            async for message in websocket:
                # ── Text message: handshake ───────────────────────────
                if isinstance(message, str):
                    try:
                        msg = json.loads(message)
                        if msg.get("type") == "ping":
                            await websocket.send(json.dumps({
                                "type": "pong",
                                "ts": msg.get("ts")
                            }))
                            continue

                            if msg.get("type") == "hello" and "market" in msg:
                                market = msg["market"]
                                audio_only = msg.get("audioOnly", False)
                                voice_profile = msg.get("voiceProfile")
                                session_id = market.get("slug", f"session-{int(time.time())}")

                                logger.info(f"[{session_id}] Client identified: {market.get('title', session_id)} (audioOnly={audio_only}, voiceProfile={voice_profile})")

                            if audio_only:
                                is_content_visible = True

                            # Build keyword index
                            keyword_index = build_keyword_index(market.get("keywords", {}))
                            logger.info(f"[{session_id}] Keyword index: {len(keyword_index)} last-words")

                            # Save debug index
                            debug_dir = Path(__file__).parent / "debug"
                            debug_dir.mkdir(exist_ok=True)
                            (debug_dir / f"indexedKeywordsByLastWord-{session_id}.json").write_text(
                                json.dumps(keyword_index, indent=2, default=str)
                            )

                            if audio_task:
                                audio_task.cancel()

                            # Background task: classify frame-{sid}.jpg every 2s
                            async def frame_classification_loop(sid):
                                frame_path = Path(__file__).parent / "debug" / f"frame-{sid}.jpg"
                                last_mtime = 0
                                while True:
                                    await asyncio.sleep(2)
                                    try:
                                        if not frame_path.exists():
                                            continue
                                        mtime = frame_path.stat().st_mtime
                                        if mtime == last_mtime:
                                            continue
                                        last_mtime = mtime
                                        data = frame_path.read_bytes()
                                        if len(data) < 3 or data[0] != 0xFF or data[1] != 0xD8:
                                            continue
                                        result = await asyncio.get_running_loop().run_in_executor(
                                            clip_executor, frame_classifier.classify, data
                                        )
                                        nonlocal is_content_visible
                                        is_content_visible = result['is_desired_content_visible']
                                        logger.info(
                                            f"[{sid}][clip] content_visible={result['is_desired_content_visible']} "
                                            f"profile={result['content_profile']} "
                                            f"conf={result['confidence']:.2f} "
                                            f"({result['elapsed_ms']}ms)"
                                        )

                                        # Save frame and result for debugging
                                        frames_dir = Path(__file__).parent / "debug" / "frames"
                                        frames_dir.mkdir(exist_ok=True, parents=True)
                                        
                                        # Use a timestamp to keep them ordered
                                        ts = int(time.time() * 1000)
                                        prefix = f"{sid}_{ts}"
                                        
                                        (frames_dir / f"{prefix}.jpg").write_bytes(data)
                                        (frames_dir / f"{prefix}.json").write_text(json.dumps(result, indent=2))

                                        await websocket.send(json.dumps({
                                            "type": "frame_classification",
                                            **result,
                                        }))
                                    except websockets.exceptions.ConnectionClosed:
                                        break
                                    except Exception as e:
                                        logger.error(f"[{sid}][clip] classification error: {e}")


                            if not audio_only:
                                frame_task = asyncio.create_task(frame_classification_loop(session_id))
                            else:
                                logger.info(f"[{session_id}] Audio-only mode — skipping frame classification")

                            # Start the background task that processes PCM from audio_inbox
                            audio_task = asyncio.create_task(audio_processing_loop(session_id, audio_inbox, audio_inbox_lock, keyword_index, voice_profile))

                            session = {
                                "id": session_id,
                                "market": market,
                            }

                            logger.info(f"[{session_id}] Session ready — receiving audio over WebSocket")
                    except Exception as e:
                        logger.error(f"Handshake parse error: {e}")
                    continue

                # ── Binary message: PCM audio or video frame ─────────
                if isinstance(message, bytes):
                    # Video frames are tagged with 0x01 prefix + JPEG data (starts with FF D8)
                    if len(message) > 3 and message[0] == 0x01 and message[1] == 0xFF and message[2] == 0xD8:
                        # Video frame (JPEG) — confirmed by SOI marker
                        frame_data = message[1:]
                        logger.info(f"[{session_id}] frame received ({len(frame_data)} bytes)")

                        # Save debug frame
                        debug_dir = Path(__file__).parent / "debug"
                        debug_dir.mkdir(exist_ok=True)
                        (debug_dir / f"frame-{session_id}.jpg").write_bytes(frame_data)
                    else:
                        # Audio PCM data
                        with audio_inbox_lock:
                            audio_inbox.extend(message)
                            # Cap at ~10s to prevent memory blowup
                            max_bytes = 16000 * 2 * 10
                            if len(audio_inbox) > max_bytes:
                                del audio_inbox[:len(audio_inbox) - max_bytes]

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            sid = session['id'] if session else 'unknown'
            logger.info(f"[{sid}][server] Client disconnected")

            if audio_task:
                audio_task.cancel()
            if frame_task:
                frame_task.cancel()

    # ── Start server ──────────────────────────────────────────────────
    logger.info(f"WebSocket server listening on port {args.port}")
    async with websockets.serve(handle_client, "0.0.0.0", args.port, ping_interval=None,
                                 max_size=None):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
