#!/usr/bin/env python3
"""
remote_server.py — Remote WebSocket server for audio transcription & Kalshi trading

Receives compressed audio (AAC/ADTS) from tvclient.js over WebSocket,
decodes to PCM via ffmpeg, transcribes in-process via faster-whisper,
does keyword matching, and trades on Kalshi.

Usage:
    python3 remote_server.py --env prod --port 8090
    python3 remote_server.py --env prod --port 8090 --model base.en --device cpu
"""

import argparse
import asyncio
import json
import logging
import math
import os
import re
import struct
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from kalshi_python_sync.models.create_order_request import CreateOrderRequest

import numpy as np
import websockets
from faster_whisper import WhisperModel
from clip import FrameClassifier

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

# ── Kalshi client ─────────────────────────────────────────────────────

class KalshiClient:
    """Thin wrapper around the Kalshi Python sync SDK."""

    def __init__(self, key_id: str, private_key_path: str, environment: str = "prod"):
        from kalshi_python_sync import Configuration, ApiClient, OrdersApi, MarketApi, PortfolioApi

        self.key_id = key_id
        self.private_key_path = private_key_path
        self.environment = environment

        base_path = (
            "https://api.elections.kalshi.com/trade-api/v2"
            if environment == "prod"
            else "https://demo-api.kalshi.co/trade-api/v2"
        )

        config = Configuration(host=base_path)
        api_client = ApiClient(config)
        
        from kalshi_python_sync.auth import KalshiAuth
        private_key = Path(private_key_path).read_text()
        api_client.kalshi_auth = KalshiAuth(key_id=key_id, private_key_pem=private_key)

        self.orders_api = OrdersApi(api_client)
        self.market_api = MarketApi(api_client)
        self.portfolio_api = PortfolioApi(api_client)
        logger.info(f"Kalshi SDK initialized for {base_path}")

    def place_fill_or_kill_order(self, ticker: str, count: int, action: str = "buy",
                                  side: str = "yes", order_type: str = "market",
                                  yes_price: int = None, no_price: int = None):
        params = {
            "ticker": ticker,
            "action": action,
            "side": side.lower(),
            "count": count,
            "type": order_type,
            "time_in_force": "immediate_or_cancel",
            "client_order_id": f"auto_{int(time.time() * 1000)}",
        }

        if yes_price is not None:
            params["yes_price"] = yes_price
        if no_price is not None:
            params["no_price"] = no_price

        # Default prices for market orders
        if order_type == "market" and yes_price is None and no_price is None:
            if side.lower() == "yes":
                params["yes_price"] = 90
            else:
                params["no_price"] = 10

        return self.orders_api.create_order(**params)


# ── Keyword matching (port of lib/matching.js) ────────────────────────

def build_keyword_index(keywords: dict) -> dict:
    """Build an index of keyword phrases keyed by their last word."""
    index = {}
    for key, value in keywords.items():
        words = key.lower().split()
        last_word = words[-1]
        if last_word not in index:
            index[last_word] = []
        index[last_word].append({"key": key, "words": words, "value": value})
    return index


def find_keyword_match(index: dict, transcript: list, word: str):
    """Check if the newly added word completes any keyword phrase."""
    candidates = index.get(word)
    if not candidates:
        return None

    for candidate in candidates:
        length = len(candidate["words"])
        if len(transcript) < length:
            continue

        tail = transcript[-length:]
        if tail == candidate["words"]:
            return {"key": candidate["key"], "value": candidate["value"]}

    return None


def remove_from_index(index: dict, key: str):
    """Remove a matched keyword from the index."""
    words = key.lower().split()
    last_word = words[-1]
    if last_word in index:
        index[last_word] = [c for c in index[last_word] if c["key"] != key]
        if not index[last_word]:
            del index[last_word]

def remove_market_from_index(index: dict, value: str):
    """Remove all keywords from the index that correspond to the given market (value)."""
    empty_keys = []
    for last_word, candidates in index.items():
        index[last_word] = [c for c in candidates if c["value"] != value]
        if not index[last_word]:
            empty_keys.append(last_word)
            
    for k in empty_keys:
        del index[k]





# ── Audio decoder ─────────────────────────────────────────────────────

import os as _os
import threading
from collections import deque

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
        self._pcm_chunks = deque(maxlen=50) # Cap at ~5s of audio to prevent stale backlog
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


# ── VAD ───────────────────────────────────────────────────────────────

def calculate_rms(pcm_bytes: bytes) -> float:
    """Calculate RMS of 16-bit signed LE PCM."""
    n_samples = len(pcm_bytes) // 2
    if n_samples == 0:
        return 0.0
    samples = struct.unpack(f"<{n_samples}h", pcm_bytes[:n_samples * 2])
    sum_sq = sum((s / 32768.0) ** 2 for s in samples)
    return math.sqrt(sum_sq / n_samples)


# ── Transcription engine ─────────────────────────────────────────────

class Transcriber:
    """In-process faster-whisper transcription with sliding window."""

    def __init__(self, model_size: str = "base.en", device: str = "cpu"):
        self.device = device
        compute_type = "float16" if device == "cuda" else "int8"
        logger.info(f"Loading Whisper model '{model_size}' on {device} ({compute_type})...")
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("Whisper model loaded.")

        self.last_proc_time = 0
        self.executor = ThreadPoolExecutor(max_workers=1)

        # Sliding window config (primarily for CPU mode)
        self.sample_rate = 16000
        self.bytes_per_sample = 2
        self.window_secs = 3.0
        self.step_secs = 1.0
        self.window_bytes = int(self.window_secs * self.sample_rate * self.bytes_per_sample)
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
            
        samples = np.frombuffer(pcm_data[:safe_len], dtype=np.int16).astype(np.float32) / 32768.0

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
        text = await asyncio.get_running_loop().run_in_executor(self.executor, do_transcribe)
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
            logger.warning(f"Dropping {len(self.incoming) - max_backlog} bytes of backlog to catch up!")
            self.incoming = self.incoming[-max_backlog:]

        while len(self.incoming) >= self.step_bytes:
            chunk = self.incoming[:self.step_bytes]
            self.incoming = self.incoming[self.step_bytes:]

            self.audio_buffer += chunk
            if len(self.audio_buffer) > self.window_bytes:
                self.audio_buffer = self.audio_buffer[-self.window_bytes:]

            safe_len = len(self.audio_buffer) - (len(self.audio_buffer) % 2)
            if safe_len == 0:
                continue

            samples = np.frombuffer(self.audio_buffer[:safe_len], dtype=np.int16).astype(np.float32) / 32768.0

            # Skip silence
            rms = float(np.sqrt(np.mean(samples ** 2)))
            if rms < 0.005:
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
            text = await asyncio.get_running_loop().run_in_executor(self.executor, do_transcribe)
            t1 = time.time()
            self.last_proc_time = t1 - t0

            if t1 - t0 > self.step_secs:
                logger.debug(f"Transcription took {t1 - t0:.2f}s (>{self.step_secs}s step)")

            if text:
                results.append(text)

        return results

    def reset(self):
        """Reset buffers for a new session."""
        self.audio_buffer = b""
        self.incoming = b""


# ── Main server ───────────────────────────────────────────────────────

async def main():
    parser = argparse.ArgumentParser(description="Remote transcription & trading server")
    parser.add_argument("--port", type=int, default=8090, help="WebSocket listen port")
    parser.add_argument("--env", type=str, default="prod", choices=["prod", "demo"])
    parser.add_argument("--model", type=str, default=None, help="Whisper model name (default: small.en for cuda, base.en for cpu)")
    parser.add_argument("--device", type=str, default=os.environ.get("DEVICE", "cpu"), choices=["cpu", "cuda"])
    parser.add_argument("--buy-count", type=int, default=5)
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
        decoder = None
        transcript = []
        is_content_visible = False
        punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')

        last_proc_time = [0.0]

        async def audio_processing_loop(session_id, audio_inbox, audio_inbox_lock, keyword_index):
            transcript.clear()
            logger.info(f"[{session_id}] Audio processing loop started (Device: {transcriber.device})")

            # Simple fixed-interval transcription: accumulate N seconds, transcribe, repeat
            CHUNK_SECS = 3.0
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

                        if not is_content_visible:
                            logger.info(f"[{session_id}][TRADE] Skipping trade because desired content not on screen")
                        elif trade_for_real:

                            try:
                                t0_trade = time.time()
                                kalshi.place_fill_or_kill_order(
                                    ticker=matched["value"],
                                    count=args.buy_count,
                                )
                                t1_trade = time.time()
                                logger.info(f"[TRADE] Successfully placed order for {matched['value']} (took {t1_trade - t0_trade:.4f}s)")
                            except Exception as e:
                                logger.error(f"[TRADE] Error placing order: {e}")
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
                    if len(audio_buffer) > CHUNK_BYTES * 3:
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
                            session_id = market.get("slug", f"session-{int(time.time())}")

                            logger.info(f"[{session_id}] Client identified: {market.get('title', session_id)}")

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


                            frame_task = asyncio.create_task(frame_classification_loop(session_id))

                            # Start the background task that processes PCM from audio_inbox
                            audio_task = asyncio.create_task(audio_processing_loop(session_id, audio_inbox, audio_inbox_lock, keyword_index))

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
