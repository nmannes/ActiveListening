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

import numpy as np
import websockets
from faster_whisper import WhisperModel

# ── Logging ───────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stderr),
    ],
)
logger = logging.getLogger("remote_server")

# ── Kalshi client ─────────────────────────────────────────────────────

class KalshiClient:
    """Thin wrapper around the Kalshi Python sync SDK."""

    def __init__(self, key_id: str, private_key_path: str, environment: str = "prod"):
        from kalshi_python_sync import Configuration, OrdersApi, MarketApi, PortfolioApi
        from kalshi_python_sync.auth import KalshiAuth

        self.key_id = key_id
        self.private_key_path = private_key_path
        self.environment = environment

        base_path = (
            "https://api.elections.kalshi.com/trade-api/v2"
            if environment == "prod"
            else "https://demo-api.kalshi.co/trade-api/v2"
        )

        private_key = Path(private_key_path).read_text()
        config = Configuration(
            base_path=base_path,
            api_key=key_id,
            private_key_pem=private_key,
        )

        self.orders_api = OrdersApi(config)
        self.market_api = MarketApi(config)
        self.portfolio_api = PortfolioApi(config)
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
                params["yes_price"] = 95
            else:
                params["no_price"] = 60

        return self.orders_api.create_order(params)


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





# ── Audio decoder ─────────────────────────────────────────────────────

import os as _os
import threading
from collections import deque

class AudioDecoder:
    """Decodes compressed audio (AAC/ADTS) to raw PCM via ffmpeg subprocess.

    Uses a background thread to read decoded PCM from ffmpeg stdout into a
    thread-safe buffer, so the async event loop never blocks.
    """

    def __init__(self):
        self.proc = subprocess.Popen(
            [
                'ffmpeg',
                '-fflags', 'nobuffer',
                '-flags', 'low_delay',
                '-f', 'aac',
                '-i', 'pipe:0',
                '-f', 's16le',
                '-acodec', 'pcm_s16le',
                '-ar', '16000',
                '-ac', '1',
                'pipe:1',
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        self._pcm_chunks = deque()
        self._lock = threading.Lock()
        self._stopped = False

        # Background thread reads decoded PCM continuously
        self._reader_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self._reader_thread.start()
        logger.info("[decoder] ffmpeg audio decoder started")

    def _reader_loop(self):
        """Continuously read decoded PCM from ffmpeg stdout."""
        while not self._stopped:
            data = self.proc.stdout.read(3200)  # ~0.1s of 16kHz 16-bit mono
            if not data:
                break
            with self._lock:
                self._pcm_chunks.append(data)

    def write(self, data: bytes):
        """Feed compressed audio data to ffmpeg stdin."""
        try:
            self.proc.stdin.write(data)
            self.proc.stdin.flush()
        except BrokenPipeError:
            logger.error("[decoder] ffmpeg stdin pipe broken")

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
        try:
            self.proc.stdin.close()
        except Exception:
            pass
        self.proc.kill()
        self.proc.wait()
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
        compute_type = "float16" if device == "cuda" else "int8"
        logger.info(f"Loading Whisper model '{model_size}' on {device} ({compute_type})...")
        self.model = WhisperModel(model_size, device=device, compute_type=compute_type)
        logger.info("Whisper model loaded.")

        self.executor = ThreadPoolExecutor(max_workers=1)

        # Sliding window config
        self.sample_rate = 16000
        self.bytes_per_sample = 2
        self.window_secs = 3.0
        self.step_secs = 0.3
        self.window_bytes = int(self.window_secs * self.sample_rate * self.bytes_per_sample)
        self.step_bytes = int(self.step_secs * self.sample_rate * self.bytes_per_sample)

        self.audio_buffer = b""
        self.incoming = b""

    def feed(self, pcm_data: bytes) -> list[str]:
        """Feed PCM data and return a list of transcription results (may be empty)."""
        self.incoming += pcm_data
        results = []

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

            t0 = time.time()
            segments, _ = self.model.transcribe(
                samples,
                beam_size=1,
                language="en",
                vad_filter=False,
                condition_on_previous_text=False,
                initial_prompt=None,
            )
            text = " ".join(seg.text.strip() for seg in segments).strip()
            t1 = time.time()

            if t1 - t0 > 0.3:
                logger.warning(f"Transcription took {t1 - t0:.2f}s (>0.3s window)")

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
    parser.add_argument("--model", type=str, default="base.en", help="Whisper model name")
    parser.add_argument("--device", type=str, default="cpu", choices=["cpu", "cuda"])
    parser.add_argument("--buy-count", type=int, default=5)
    parser.add_argument("--last-words-count", type=int, default=7)
    args = parser.parse_args()

    # Load env file
    env_file = Path(__file__).parent / f".env.{args.env}"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())

    trade_for_real = os.environ.get("TRADE_FOR_REAL", "false").lower() == "true"
    logger.info(f"Environment: {args.env}")
    logger.info(f"Trading enabled: {trade_for_real}")

    # Init transcriber
    transcriber = Transcriber(model_size=args.model, device=args.device)

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
        punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')

        # VAD state
        VAD_THRESHOLD = 0.005
        VAD_CHUNK_SIZE = 3200  # 0.1s at 16kHz 16-bit mono
        vad_buffer = b""
        vad_skip_count = 0

        try:
            async for message in websocket:
                # ── Text message: handshake ───────────────────────────
                if isinstance(message, str):
                    try:
                        msg = json.loads(message)
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

                            # Start audio decoder (compressed → PCM)
                            if decoder:
                                decoder.kill()
                            decoder = AudioDecoder()

                            session = {
                                "id": session_id,
                                "market": market,
                            }
                            transcript.clear()
                            transcriber.reset()

                            logger.info(f"[{session_id}] Session ready — waiting for audio")
                    except Exception as e:
                        logger.error(f"Handshake parse error: {e}")
                    continue

                # ── Binary message: compressed audio ──────────────────
                if session is None or decoder is None:
                    continue  # ignore audio before handshake

                # Feed compressed audio to ffmpeg decoder
                decoder.write(message)

                # Drain whatever PCM the background reader has decoded so far
                pcm_data = decoder.drain()
                if not pcm_data:
                    continue

                vad_buffer += pcm_data

                while len(vad_buffer) >= VAD_CHUNK_SIZE:
                    chunk = vad_buffer[:VAD_CHUNK_SIZE]
                    vad_buffer = vad_buffer[VAD_CHUNK_SIZE:]

                    rms = calculate_rms(chunk)
                    if rms < VAD_THRESHOLD:
                        vad_skip_count += 1
                        if vad_skip_count % 50 == 1:
                            logger.debug(f"[{session['id']}] VAD silence skip #{vad_skip_count} (RMS: {rms:.4f})")
                        continue

                    # Active speech — transcribe
                    vad_skip_count = 0
                    texts = transcriber.feed(chunk)

                    for text in texts:
                        words = text.split()
                        for word in words:
                            token = punct_re.sub("", word).lower()
                            if not token:
                                continue

                            # Deduplicate adjacent
                            if transcript and transcript[-1] == token:
                                continue

                            transcript.append(token)
                            if len(transcript) > 500:
                                transcript.pop(0)

                            matched = find_keyword_match(keyword_index, transcript, token)
                            if matched:
                                logger.info(f"[{session['id']}][SIGNAL] Detected: \"{matched['key']}\"")

                                if trade_for_real:
                                    try:
                                        result = kalshi.place_fill_or_kill_order(
                                            ticker=matched["value"],
                                            count=args.buy_count,
                                        )
                                        logger.info(f"[TRADE] result: {result}")
                                    except Exception as e:
                                        logger.error(f"[TRADE] error: {e}")
                                else:
                                    logger.info(f"[TRADE] Not trading for real but \"{matched['key']}\" detected")

                                remove_from_index(keyword_index, matched["key"])
                                logger.info(
                                    f"[{session['id']}][SIGNAL] last {args.last_words_count} words: "
                                    f"{' '.join(transcript[-args.last_words_count:])}"
                                )

                                # Notify client
                                await websocket.send(json.dumps({
                                    "type": "signal",
                                    "keyword": matched["key"],
                                    "ticker": matched["value"],
                                }))

                            if len(transcript) % args.last_words_count == 0:
                                recent = " ".join(transcript[-args.last_words_count:])
                                logger.info(f"[{session['id']}] last {args.last_words_count} words: {recent}")

                                await websocket.send(json.dumps({
                                    "type": "transcript",
                                    "text": recent,
                                }))

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            logger.info(f"[server] Client disconnected{f' ({session[\"id\"]})' if session else ''}")
            if decoder:
                decoder.kill()

    # ── Start server ──────────────────────────────────────────────────
    logger.info(f"WebSocket server listening on port {args.port}")
    async with websockets.serve(handle_client, "0.0.0.0", args.port, ping_interval=None,
                                 max_size=None):
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
