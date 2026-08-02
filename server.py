#!/usr/bin/env python3
"""
server.py — Remote WebSocket server for audio transcription & Kalshi trading

Receives PCM audio from client over WebSocket,
streams to Deepgram for transcription/diarization,
does keyword matching, and trades on Kalshi.

Usage:
    python3 server.py --env prod --port 8090
"""

import argparse
import asyncio
import fcntl
import json
import numpy as np
import logging
import os
import re
import signal
import sys
import tempfile
import time
import threading
from collections import defaultdict
# from concurrent.futures import ThreadPoolExecutor  # CLIP disabled
from pathlib import Path

import websockets

from pylib.kalshi_client import KalshiClient
from pylib.keyword_matching import build_keyword_index
# from pylib.clip import FrameClassifier  # CLIP disabled to save ~600MB
from pylib.audio_processor import AudioProcessor
from pylib.trade_processor import TradeProcessor
# from pylib.frame_processor import FrameProcessor  # CLIP disabled
from pylib.speaker_recognition import SpeakerRecognitionSession
from pylib.speaker_identifier import SpeakerIdentifier

from pylib.word_prediction import WordPredictor
from pylib.orderbook_tracker import OrderbookTracker

from pylib.log_config import setup_logging, run_uuid_var, set_run_uuid
from pylib.telegram import send_telegram

# ── Config ────────────────────────────────────────────────────────────

def _load_config():
    import yaml
    config_yaml = Path(__file__).resolve().parent / "config.yaml"
    with open(config_yaml) as f:
        return yaml.safe_load(f)

_config = _load_config()

# ── Logging ───────────────────────────────────────────────────────────

logger, transcript_logger = setup_logging()

# ── Constants ────────────────────────────────────────────────────────

_ws = _config["server"]
AUDIO_INBOX_CAP_SECS = _ws["audioInboxCapSecs"]

LOCK_PATH = Path(tempfile.gettempdir()) / "kalshi-server.lock"


def acquire_singleton_lock() -> int:
    """Acquire an exclusive lock file. Returns fd. Exits if another server is running."""
    lock_fd = os.open(LOCK_PATH, os.O_CREAT | os.O_RDWR, 0o644)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        pid = Path(LOCK_PATH).read_text().strip() or "unknown"
        print(f"Server is already running (PID: {pid}). Exiting.", file=sys.stderr)
        os.close(lock_fd)
        sys.exit(1)
    os.truncate(lock_fd, 0)
    os.write(lock_fd, str(os.getpid()).encode())
    return lock_fd


# ── Main server ───────────────────────────────────────────────────────


class Config:
    def __init__(self, args):
        self.port = getattr(args, "port", 8090)
        self.env = getattr(args, "env", "prod")
        self.device = getattr(args, "device", os.environ.get("DEVICE", "cpu"))
        self.buy_count = getattr(args, "buy_count", 1)
        self.buy_max_cost = getattr(args, "buy_max_cost", 5)
        self.last_words_count = getattr(args, "last_words_count", 7)
        self.content_profile = getattr(args, "content_profile", "basketball")

        # Load env file
        env_files = [
            Path(__file__).parent / ".env",
            Path(__file__).parent / f".env.{self.env}",
        ]
        for env_file in env_files:
            if env_file.exists():
                for line in env_file.read_text().splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, _, value = line.partition("=")
                        os.environ.setdefault(key.strip(), value.strip())
                break

        self.trade_for_real = os.environ.get("TRADE_FOR_REAL", None) is not None
        self.kalshi_environment = self.env
        self.min_confidence = float(os.environ.get("MIN_CONFIDENCE", "0.80"))
        self.min_yes_ask_price = float(os.environ.get("MIN_YES_ASK_PRICE", "0.02"))
        self.max_session_loss = float(os.environ.get("MAX_SESSION_LOSS", _config["trading"]["maxSessionLoss"]))
        logger.info(f"Environment: {self.env}")
        logger.info(f"Trading enabled: {self.trade_for_real}")
        logger.info(f"Min confidence: {self.min_confidence}")
        self.word_prediction_enabled = os.environ.get("WORD_PREDICTION", None) is not None
        logger.info(f"Word prediction: {self.word_prediction_enabled}")
        self.audio_library_path = Path("~/audio-library").expanduser()

        # Speaker recognition scheduling (from config.yaml)
        ws_config = _config["server"]
        self.speaker_recognition_interval_secs = ws_config.get("speakerRecognitionIntervalSecs", 10)
        self.speaker_recognition_max_duration_secs = ws_config.get("speakerRecognitionMaxDurationSecs", 1200)


class ClientSession:
    def __init__(self, websocket, server):
        self.websocket = websocket
        self.server = server
        self.session_id = None
        self.market = None
        self.markets: list[dict] = []  # multi-market: all markets in this session
        self.keyword_to_market: dict[str, int] = {}  # phrase → market index
        self.speaker_to_markets: dict[str, list[int]] = {}  # entity → market indices
        self.audio_only = False
        self.voice_profile = None
        self.keyword_index = None
        self.keyword_indexes: list[dict] = []  # per-market indexes

        self.transcript = defaultdict(list)  # {speaker_id: [token_dicts]}
        self.transcript_lock = asyncio.Lock()

        self.punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')
        self.last_proc_time = [0.0]

        self.speaker_task = None
        self.speaker_recognition_session = None

        # Simple audio buffer — receives PCM from WebSocket binary messages
        self.audio_inbox = bytearray()
        self.audio_inbox_event = asyncio.Event()

        self.audio_inbox_lock = threading.Lock()

        self.audio_task = None
        # self.frame_task = None  # CLIP disabled

        self.orderbook_tracker = None
        self.orderbook_task = None

        self.predictor: Optional[WordPredictor] = None

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
        ms = msg.get("markets")
        if ms and isinstance(ms, list) and len(ms) > 0:
            self.markets = ms
        elif msg.get("market"):
            self.markets = [msg["market"]]
        else:
            self.markets = [{}]
        self.market = self.markets[0]  # backward compat: first market is default
        self.audio_only = msg.get("audioOnly", False)
        self.voice_profile = msg.get("voiceProfile")
        self.clip_profile = msg.get("clipProfile")
        self.session_id = self.market.get("slug", f"session-{int(time.time())}")

        run_uuid = msg.get("runUUID", "-")
        set_run_uuid(run_uuid)

        logger.info(
            f"[{self.session_id}] Client identified: {self.market.get('title', self.session_id)} (audioOnly={self.audio_only}, voiceProfile={self.voice_profile}, clipProfile={self.clip_profile})"
        )

        # Build per-market keyword indexes + merged index for signal detection
        self.keyword_indexes = [
            build_keyword_index(m.get("keywords", {})) for m in self.markets
        ]
        # Merged index (backward compat — SignalDetector queries one flat index)
        self.keyword_index = {}
        for idx, kw_idx in enumerate(self.keyword_indexes):
            for last_word, entries in kw_idx.items():
                self.keyword_index.setdefault(last_word, []).extend(entries)
            for phrase in self.markets[idx].get("keywords", {}):
                k = phrase.lower()
                self.keyword_to_market.setdefault(k, []).append(idx)
        # Build speaker-to-market mapping
        for idx, m in enumerate(self.markets):
            for entity in (m.get("speakerEntities") or []):
                ent_lower = entity.lower()
                self.speaker_to_markets.setdefault(ent_lower, []).append(idx)
        logger.info(
            f"[{self.session_id}] Keyword index: {len(self.keyword_index)} last-words across {len(self.markets)} market(s)"
        )

        # Save debug index
        debug_dir = Path(__file__).parent / "debug"
        debug_dir.mkdir(exist_ok=True)
        (debug_dir / f"indexedKeywordsByLastWord-{self.session_id}.json").write_text(
            json.dumps(self.keyword_index, indent=2, default=str)
        )

        if self.server.config.word_prediction_enabled:
            keywords = self.market.get("keywords", {})
            if keywords:
                self.predictor = WordPredictor(
                    target_words=list(keywords.keys()),
                    horizon_sec=60,
                    context_window_sec=120,
                    update_interval_sec=5,
                    min_context_utterances=3,
                    llm_enabled=False,
                )
                logger.info(
                    f"[{self.session_id}] WordPredictor initialized with {len(keywords)} target words"
                )

        # if not self.audio_only and self.clip_profile is not None:  # CLIP disabled
        #     self.frame_processor = FrameProcessor(self)
        #     self.frame_task = asyncio.create_task(self.frame_processor.run())
        # else:
        #     if not self.audio_only:
        #         logger.info(
        #             f"[{self.session_id}] clipProfile is null — skipping frame classification for this session"
        #         )
        #     else:
        #         logger.info(
        #             f"[{self.session_id}] Audio-only mode — skipping frame classification"
        #         )
        logger.info(f"[{self.session_id}] Frame classification disabled (CLIP commented out)")

        # Start the background tasks
        self.trade_processor = TradeProcessor(self)
        self.audio_processor = AudioProcessor(
            self,
            on_tokens_callback=self.trade_processor.process_tokens,
            word_predictor=self.predictor,
        )
        self.audio_task = asyncio.create_task(self.audio_processor.run())

        if self.predictor:
            await self.predictor.start()

        # Union all speaker entities across markets
        all_entities = list(dict.fromkeys(
            e for m in self.markets for e in (m.get("speakerEntities") or [])
        ))
        if all_entities:
            logger.info(f"[{self.session_id}] Target speaker entities: {all_entities}")
            entities = all_entities
            # Generic entities (reporters, panelists, etc.) are identified via
            # Bedrock transcript inference and don't need the full 10s cadence.
            # Use a 30s interval to reduce LLM costs.
            interval = self.server.config.speaker_recognition_interval_secs
            if "reporters" in entities:
                interval = max(interval, 30)
            self.speaker_recognition_session = SpeakerRecognitionSession(
                self, entities,
                speaker_identifier=self.server.speaker_identifier,
                interval_secs=interval,
                max_duration_secs=self.server.config.speaker_recognition_max_duration_secs,
            )
            logger.info(f"[{self.session_id}] Speaker recognition session created (interval={self.speaker_recognition_session.policy.interval_secs}s, max_duration={self.speaker_recognition_session.policy.max_duration_secs}s)")
            from pylib.speaker_policy import SpeakerRecognitionLoop
            loop = SpeakerRecognitionLoop(
                self.speaker_recognition_session.policy,
                self.speaker_recognition_session.run_identity_inference,
            )
            self.speaker_task = asyncio.create_task(loop.run())
        else:
            logger.info(f"[{self.session_id}] No speakerEntities defined — skipping speaker recognition")

        tickers = list(dict.fromkeys(
            t for m in self.markets for t in m.get("keywords", {}).values()
        ))  # dedupe across all markets
        if tickers:
            # MVE collection tickers (KXMVE*) don't carry their own orderbooks —
            # the liquidity lives on leg markets listed in custom_strike.
            # Build mapping and expand subscription to include leg tickers.
            mve_to_legs: dict[str, list[str]] = {}
            for ticker in tickers:
                if "KXMVE" in ticker:
                    market_info = self.server.kalshi.get_market(ticker)
                    if market_info:
                        cs = market_info.get("custom_strike", {})
                        associated = cs.get("Associated Markets", "")
                        if associated:
                            legs = [t.strip() for t in associated.split(",") if t.strip()]
                            mve_to_legs[ticker] = legs
                            logger.info(
                                f"[{self.session_id}] MVE {ticker} → {len(legs)} leg markets"
                            )
            all_tickers = list(
                dict.fromkeys(tickers + [leg for legs in mve_to_legs.values() for leg in legs])
            )
            logger.info(
                f"[{self.session_id}] Orderbook tracker: {len(tickers)} markets + "
                f"{len(all_tickers) - len(tickers)} leg tickers = {len(all_tickers)} total"
            )
            self.orderbook_tracker = OrderbookTracker(
                tickers=all_tickers,
                kalshi=self.server.kalshi,
                environment=self.server.config.kalshi_environment,
                mve_to_legs=mve_to_legs,
            )
            self.orderbook_task = asyncio.create_task(self.orderbook_tracker.run())
            await self.orderbook_tracker.wait_ready(timeout=15.0)
        else:
            self.orderbook_tracker = None
            self.orderbook_task = None

        logger.info(
            f"[{self.session_id}] Session ready — receiving audio over WebSocket"
        )

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

            # Save debug frame (only when env var is set)
            if os.environ.get("DEBUG_SAVE_FRAMES"):
                debug_dir = Path(__file__).parent / "debug"
                debug_dir.mkdir(exist_ok=True)
                if self.session_id:
                    (debug_dir / f"frame-{self.session_id}.jpg").write_bytes(frame_data)
        else:
            # Audio PCM data
            with self.audio_inbox_lock:
                self.audio_inbox.extend(message)
            # Capping - keep 30 seconds max
            max_bytes = 16000 * 2 * AUDIO_INBOX_CAP_SECS
            if len(self.audio_inbox) > max_bytes:
                dropped_bytes = len(self.audio_inbox) - max_bytes
                del self.audio_inbox[:dropped_bytes]
                logger.debug(
                    f"[{self.session_id}] Dropped {dropped_bytes} bytes from WebSocket inbox (30s cap)"
                )


    def cleanup(self):
        if self.audio_task:
            self.audio_task.cancel()
        # if self.frame_task:  # CLIP disabled
        #     self.frame_task.cancel()
        if self.speaker_task:
            self.speaker_task.cancel()
        if self.predictor:
            asyncio.create_task(self.predictor.stop())
        if self.orderbook_tracker:
            self.orderbook_tracker.stop()
        if self.orderbook_task:
            self.orderbook_task.cancel()


class TradingServer:
    def __init__(self, config):
        self.config = config
        self.active_sessions = []  # track for graceful shutdown

        # Shared resources (initially None, loaded asynchronously)
        # self.frame_classifier = None  # CLIP disabled
        self.speaker_identifier = None
        # self.clip_executor = ThreadPoolExecutor(max_workers=1)  # CLIP disabled

        # Init Kalshi client
        self.kalshi = KalshiClient(
            key_id=os.environ["KALSHI_KEY_ID"],
            private_key_path=os.environ["KALSHI_PRIVATE_KEY_PATH"],
            environment=config.env,
        )

    async def handle_client(self, websocket):
        session = ClientSession(websocket, self)
        self.active_sessions.append(session)
        try:
            await session.run()
        finally:
            self.active_sessions.remove(session)

    async def start(self):
        logger.info(f"WebSocket server listening on port {self.config.port}")
        self.stop_event = asyncio.Event()

        # Register signal handlers for graceful shutdown
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig, lambda s=sig: asyncio.create_task(self.shutdown(s))
            )

        # Initialize resources before accepting connections
        await self.initialize_resources()

        # Notify that the server has started
        hostname = os.uname().nodename
        msg = f"🚀 Kalshi server started on {hostname}\nEnv: {self.config.env}\nPort: {self.config.port}"
        asyncio.get_running_loop().run_in_executor(None, send_telegram, msg, "info")

        async with websockets.serve(
            self.handle_client,
            None,  # None binds to all available IPv4 and IPv6 interfaces
            self.config.port,
            ping_interval=None,
            max_size=None,
        ):
            await self.stop_event.wait()

    async def shutdown(self, sig):
        """Graceful shutdown: cleanup all active sessions (saves WAVs + uploads to S3)."""
        logger.info(
            f"Received {signal.Signals(sig).name}, shutting down {len(self.active_sessions)} active session(s)..."
        )
        for session in list(self.active_sessions):
            session.cleanup()
        # Give cleanup tasks time to finish (WAV close + S3 upload)
        await asyncio.sleep(2)
        logger.info("Shutdown complete.")
        self.stop_event.set()

    async def initialize_resources(self):
        """Asynchronously load heavy models/resources."""
        try:
            logger.info("Starting background resource initialization...")
            loop = asyncio.get_running_loop()

            # # Load CLIP in executor to avoid blocking the event loop  # CLIP disabled
            # self.frame_classifier = await loop.run_in_executor(
            #     self.clip_executor,
            #     lambda: FrameClassifier(
            #         device=self.config.device,
            #         content_profile=self.config.content_profile,
            #     ),
            # )

            # Load SpeakerIdentifier (TitaNet) for audio-based speaker recognition
            import time
            start_time = time.time()
            self.speaker_identifier = SpeakerIdentifier(
                audio_library_path=self.config.audio_library_path,
                device=self.config.device
            )
            await self.speaker_identifier.initialize()
            load_time = time.time() - start_time
            logger.info(f"SpeakerIdentifier initialized in {load_time:.2f} seconds.")

            logger.info("Background resource initialization complete.")
        except Exception as e:
            logger.exception(f"Error during resource initialization: {e}")


async def main():
    _lock_fd = acquire_singleton_lock()

    parser = argparse.ArgumentParser(
        description="Remote transcription & trading server"
    )
    parser.add_argument("--port", type=int, default=_config["server"]["wsPort"], help="WebSocket listen port")
    parser.add_argument(
        "--env",
        type=str,
        default=os.environ.get("KALSHI_ENV", "demo"),
        choices=["prod", "demo"],
    )
    parser.add_argument(
        "--device",
        type=str,
        default=os.environ.get("DEVICE", "cpu"),
        choices=["cpu", "cuda"],
    )
    parser.add_argument("--buy-count", type=int, default=_config["trading"]["defaultBuyCount"])
    parser.add_argument("--buy-max-cost", type=int, default=_config["trading"]["defaultBuyMaxCost"], help="Max dollars to spend per market order")
    parser.add_argument("--last-words-count", type=int, default=_config["trading"]["defaultLastWordsCount"])
    parser.add_argument(
        "--content-profile",
        type=str,
        default=_config["clip"]["defaultProfile"],
        help="CLIP content profile (default: basketball)",
    )

    args = parser.parse_args()

    config = Config(args)
    server = TradingServer(config)
    await server.start()


if __name__ == "__main__":
    asyncio.run(main())
