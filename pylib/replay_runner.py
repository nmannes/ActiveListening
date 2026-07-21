"""
replay_runner.py — Simulate full runs offline against saved recording data.

Feeds Deepgram responses + PCM audio through SpeakerRecognitionLoop on a
virtual clock so both audio-based and transcript-based identification can
be verified without a live broadcast.

Usage:
    from pylib.replay_runner import ReplayRunner, ReplaySession

    runner = ReplayRunner(recording_dir, market, speaker_identifier=si)
    result = await runner.run()
    print(result.profile_labels)
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import wave
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Optional

from pylib.keyword_matching import build_keyword_index

logger = logging.getLogger("replay")


# ── Result types ────────────────────────────────────────────────────────────


@dataclass
class Firing:
    """State captured at one loop-iteration firing."""
    elapsed_secs: float
    profile_labels: dict          # snapshot of speaker_id → label
    total_words: int              # transcript word count at this point
    wav_sizes: dict[str, int]     # speaker_id → WAV file bytes


@dataclass
class TradeSignal:
    """One keyword match captured during replay."""
    elapsed_secs: float          # virtual time when keyword was spoken
    keyword: str                 # matched phrase, e.g. "cherry blossom"
    ticker: str                  # e.g. "CHERRY-YES"
    speaker_id: str              # which speaker said it
    word_confidence: float       # min confidence across phrase words
    speaker_whitelisted: bool    # was the speaker in trading_speakers?
    would_trade: bool            # True if all gates passed
    blocked_by: str              # "" if would_trade, else gate name
    # P&L fields (populated by BacktestSignalHandler; None in RecordingSignalHandler)
    firing_index: int = -1       # which identification firing was active
    fill_price: float | None = None
    dollar_amount: float | None = None
    contracts: float | None = None
    pnl: float | None = None
    resolution: str | None = None


@dataclass
class ReplayResult:
    """Full result of a replay run."""
    profile_labels: dict = field(default_factory=dict)
    trading_speakers: set = field(default_factory=set)
    firings: list[Firing] = field(default_factory=list)
    signals: list[TradeSignal] = field(default_factory=list)


# ── Mock session (shared with replay_session.py) ────────────────────────────


class MockWebsocket:
    """No-op websocket for replay mode."""
    async def send(self, data):
        pass


class MockConfig:
    def __init__(self):
        self.trade_for_real = False
        self.buy_count = 1
        self.buy_max_cost = 5
        self.last_words_count = 7
        self.min_confidence = 0.8
        self.max_session_loss = 100.0


class MockServer:
    def __init__(self, speaker_identifier=None):
        self.config = MockConfig()
        self.kalshi = None
        self.speaker_identifier = speaker_identifier


class ReplaySession:
    """Mocks a ClientSession with enough state for TradeProcessor
    and SpeakerRecognitionSession to work."""

    def __init__(self, session_id: str, market: dict = None,
                 speaker_identifier=None):
        self.session_id = session_id
        self.transcript = defaultdict(list)
        self.transcript_lock = asyncio.Lock()
        self.market = market or {}
        self.keyword_index = build_keyword_index(
            self.market.get("keywords", {})
        )
        self.server = MockServer(speaker_identifier=speaker_identifier)
        self.websocket = MockWebsocket()
        self.punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')


# ── Signal recording ────────────────────────────────────────────────────────


class RecordingSignalHandler:
    """Replaces SignalHandler during replay — records signals instead of trading.

    Evaluates the same gates as the real SignalHandler.handle_signal()
    but never sends Telegram messages or places orders.

    Mirrors the real SignalHandler's trading_speakers interface so
    TradeProcessor.add_trading_speaker() and the identification pipeline
    work without modification.
    """

    def __init__(self, trade_processor, virtual_time: list[float]):
        self._tp = trade_processor
        self._virtual_time = virtual_time
        self.signals: list[TradeSignal] = []
        self.trading_speakers: set[str] = set()
        self.current_firing_index: int = 0  # set by ReplayRunner before each firing

    def set_trading_speakers(self, speaker_ids: list[str]):
        self.trading_speakers = set(str(s) for s in speaker_ids)

    def add_trading_speaker(self, speaker_id: str) -> bool:
        sid = str(speaker_id)
        if sid in self.trading_speakers:
            return False
        self.trading_speakers.add(sid)
        return True

    async def handle_signal(self, match: dict, speaker_id: str, token: dict):
        ticker = match["value"]
        keyword = match["key"]
        confidence = match.get("min_confidence", token.get("confidence", 0))
        config = self._tp.session.server.config
        whitelisted = speaker_id in self.trading_speakers

        signal = TradeSignal(
            elapsed_secs=self._virtual_time[0],
            keyword=keyword,
            ticker=ticker,
            speaker_id=speaker_id,
            word_confidence=round(confidence, 3),
            speaker_whitelisted=whitelisted,
            would_trade=False,
            blocked_by="",
            firing_index=self.current_firing_index,
        )

        # Evaluate gates in the same order as SignalHandler.handle_signal()
        if not whitelisted:
            signal.blocked_by = "speaker_not_whitelisted"
        elif not config.trade_for_real:
            signal.blocked_by = "trade_for_real_disabled"
            signal.would_trade = True  # all real gates passed
        elif confidence < config.min_confidence:
            signal.blocked_by = "low_confidence"
        else:
            signal.would_trade = True

        self.signals.append(signal)

        # Still notify client via websocket so the UI sees the signal
        try:
            await self._tp.session.websocket.send(json.dumps({
                "type": "signal",
                "keyword": keyword,
                "ticker": ticker,
                "speaker_id": speaker_id,
                "start": token.get("start", 0),
            }))
        except Exception:
            pass


# ── Replay runner ───────────────────────────────────────────────────────────


class ReplayRunner:
    """Orchestrates a time-synced replay of a recording directory.

    Feeds tokens in timestamp order while a SpeakerRecognitionLoop fires
    identification on a fixed interval of virtual time.

    If *audio_library_path* is provided, a real SpeakerIdentifier is
    constructed and initialized so the audio-based identification path
    (TitaNet embeddings) is taken.  Without it, only the transcript-based
    Bedrock path is available.
    """

    def __init__(
        self,
        recording_dir: Path,
        market: dict,
        *,
        audio_library_path: Path | None = None,
        device: str = "cpu",
        interval_secs: int = 10,
        max_duration_secs: int = 1200,
        bedrock_region: str = "us-east-1",
        bedrock_model_id: str = "us.amazon.nova-lite-v1:0",
        handler_factory: callable = None,
    ):
        self.recording_dir = Path(recording_dir)
        self.market = market
        self.audio_library_path = audio_library_path
        self.device = device
        self.interval_secs = interval_secs
        self.max_duration_secs = max_duration_secs
        self.bedrock_region = bedrock_region
        self.bedrock_model_id = bedrock_model_id
        self.handler_factory = handler_factory  # None → default RecordingSignalHandler

    # ── public API ──────────────────────────────────────────────────────

    async def run(self) -> ReplayResult:
        """Run the full replay and return structured results."""
        dg_dir = self.recording_dir / "deepgram_responses"
        if not dg_dir.exists():
            raise FileNotFoundError(f"deepgram_responses not found: {dg_dir}")

        # 0. Build and initialize SpeakerIdentifier if audio library path given
        speaker_identifier = None
        if self.audio_library_path:
            from pylib.speaker_identifier import SpeakerIdentifier
            speaker_identifier = SpeakerIdentifier(
                audio_library_path=self.audio_library_path,
                device=self.device,
            )
            await speaker_identifier.initialize()
            logger.info("SpeakerIdentifier initialized with %d references",
                        len(speaker_identifier.references))

        # 1. Load all tokens chronologically
        all_tokens = self._load_tokens(dg_dir)
        logger.info("Loaded %d tokens across %d speakers",
                     len(all_tokens),
                     len(set(t[1] for t in all_tokens)))

        # 2. Load PCM buffer if full.wav exists
        pcm_buffer = self._load_pcm()

        # 3. Shared virtual clock (must exist before recorder + scheduling)
        virtual_time = [0.0]

        # 4. Build session + recognition session
        session = ReplaySession(
            self.recording_dir.name,
            self.market,
            speaker_identifier=speaker_identifier,
        )

        from pylib.trade_processor import TradeProcessor
        trade_processor = TradeProcessor(session)
        session.trade_processor = trade_processor

        # Replace handler with recorder that captures TradeSignals
        if self.handler_factory is not None:
            recorder = self.handler_factory(trade_processor, virtual_time)
        else:
            recorder = RecordingSignalHandler(trade_processor, virtual_time)
        trade_processor.handler = recorder

        from pylib.speaker_recognition import SpeakerRecognitionSession
        rec_session = SpeakerRecognitionSession(
            session,
            self.market.get("speakerEntities", []),
            speaker_identifier=speaker_identifier,
            interval_secs=self.interval_secs,
            max_duration_secs=self.max_duration_secs,
        )
        rec_session.transcript_recognizer.region_name = self.bedrock_region
        rec_session.transcript_recognizer.model_id = self.bedrock_model_id

        # 5. Set up WAV directory and writer state
        audio_dir = None
        audio_path = None
        speaker_wav_files: dict[str, wave.Wave_write] = {}
        if pcm_buffer:
            audio_dir = TemporaryDirectory(prefix="replay_audio_")
            audio_path = Path(audio_dir.name)
            session.audio_processor = _FakeAudioProcessor(audio_path)
            rec_session._speaker_file_sizes = {}

        # 6. Set up scheduling: fire identification every interval_secs of virtual time
        result = ReplayResult()
        next_fire = self.interval_secs
        firing_index = [0]  # mutable counter so _capture_firing can bump it

        from pylib.speaker_policy import InferencePolicy
        policy = InferencePolicy(
            interval_secs=self.interval_secs,
            max_duration_secs=self.max_duration_secs,
        )

        async def fire_if_due():
            """Fire identification if virtual time has crossed the next scheduled point."""
            nonlocal next_fire
            while virtual_time[0] >= next_fire and not policy.is_duration_exceeded(next_fire):
                virtual_time[0] = next_fire  # pin virtual time to the firing instant
                await _capture_firing()
                next_fire += self.interval_secs

        async def _capture_firing():
            """Run identification and record state at this firing."""
            nonlocal firing_index
            firing_index[0] += 1
            # Stamp handler with current firing index so signals get tagged
            if hasattr(trade_processor.handler, 'current_firing_index'):
                trade_processor.handler.current_firing_index = firing_index[0]
            await rec_session.run_identity_inference()
            total_words = sum(
                len(tokens) for tokens in session.transcript.values()
            )
            wav_sizes = {}
            if audio_path:
                for wf_path in audio_path.glob("speaker_*.wav"):
                    sid = wf_path.stem.replace("speaker_", "")
                    wav_sizes[sid] = wf_path.stat().st_size
            result.firings.append(Firing(
                elapsed_secs=virtual_time[0],
                profile_labels=dict(rec_session.profile_labels),
                total_words=total_words,
                wav_sizes=wav_sizes,
            ))

        # 7. Feed tokens in timestamp order, firing identification before each
        #    batch so signals in that batch see the latest identification state.
        batch: list[tuple] = []  # (speaker_id, token)
        batch_start_ts = 0.0
        for ts, sid, token in all_tokens:
            if batch and ts > batch_start_ts + 0.5:  # new time batch
                # Advance virtual time to end of current batch, fire any due
                # identifications, THEN feed the batch so signals see updated state
                last_ts = max(t["end"] for _, t in batch)
                virtual_time[0] = max(virtual_time[0], last_ts)
                await fire_if_due()
                await self._feed_batch(trade_processor, session, batch)
                if pcm_buffer:
                    self._write_speaker_slices(
                        pcm_buffer, speaker_wav_files, audio_path, batch
                    )
                batch = []
                batch_start_ts = ts

            batch.append((sid, token))
            if len(batch) == 1:  # first token of new batch
                batch_start_ts = ts

        # Flush final batch: fire due identifications first, then feed
        if batch:
            last_ts = max(t["end"] for _, t in batch)
            virtual_time[0] = max(virtual_time[0], last_ts)
            await fire_if_due()
            await self._feed_batch(trade_processor, session, batch)
            if pcm_buffer:
                self._write_speaker_slices(
                    pcm_buffer, speaker_wav_files, audio_path, batch
                )

        # 8. Fire any remaining scheduled firings up to max_duration_secs
        while next_fire <= self.max_duration_secs:
            virtual_time[0] = next_fire
            await _capture_firing()
            next_fire += self.interval_secs

        # 9. Collect final state
        result.profile_labels = dict(rec_session.profile_labels)
        result.trading_speakers = recorder.trading_speakers.copy()
        result.signals = recorder.signals
        # Close WAV files
        for wf in speaker_wav_files.values():
            wf.close()
        if audio_dir:
            audio_dir.cleanup()

        return result

    # ── internal helpers ────────────────────────────────────────────────

    @staticmethod
    def _load_tokens(dg_dir: Path) -> list[tuple[float, str, dict]]:
        """Extract all tokens from dg_*.json, return sorted by timestamp."""
        tokens: list[tuple[float, str, dict]] = []
        for file_path in sorted(dg_dir.glob("dg_*.json")):
            with open(file_path) as f:
                data = json.load(f)
            if data.get("type") != "Results":
                continue
            if not data.get("is_final", False):
                continue
            channel = data.get("channel", {})
            alternatives = channel.get("alternatives", [])
            if not alternatives:
                continue
            words = alternatives[0].get("words", [])
            if not words:
                continue
            speaker_id = str(words[0].get("speaker", "0"))
            for w in words:
                token = {
                    "text": w["word"].lower(),
                    "start": w["start"],
                    "end": w["end"],
                    "confidence": round(w.get("confidence", 0), 3),
                }
                tokens.append((w["start"], speaker_id, token))
        tokens.sort(key=lambda x: x[0])
        return tokens

    def _load_pcm(self) -> bytearray | None:
        """Load full.wav PCM data if available."""
        wav_path = self.recording_dir / "audio" / "full.wav"
        if not wav_path.exists():
            return None
        with wave.open(str(wav_path), "rb") as wf:
            if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
                logger.warning("full.wav has unexpected format, skipping audio path")
                return None
            return bytearray(wf.readframes(wf.getnframes()))

    @staticmethod
    async def _feed_batch(trade_processor,
                          session: ReplaySession,
                          batch: list[tuple[str, dict]]):
        """Route tokens through TradeProcessor.process_tokens() so keyword
        matching and signal detection fire, AND append to session.transcript."""
        by_speaker: dict[str, list[dict]] = defaultdict(list)
        for sid, token in batch:
            by_speaker[sid].append(token)
        for sid, tokens in by_speaker.items():
            # process_tokens handles dedup, signal detection, and transcript
            await trade_processor.process_tokens(tokens, speaker_id=sid)

    @staticmethod
    def _write_speaker_slices(
        pcm_buffer: bytearray,
        wav_files: dict[str, wave.Wave_write],
        audio_dir: Path,
        batch: list[tuple[str, dict]],
    ):
        """Slice PCM at utterance boundaries and write per-speaker WAVs.

        Mirrors AudioProcessor._write_speaker_audio."""
        bytes_per_sec = 16000 * 2
        buf_len = len(pcm_buffer)

        # Group tokens by speaker and find min/max times
        by_speaker: dict[str, list[dict]] = defaultdict(list)
        for sid, token in batch:
            by_speaker[sid].append(token)

        for sid, tokens in by_speaker.items():
            start_time = tokens[0]["start"]
            end_time = tokens[-1]["end"]
            start_byte = (int(start_time * bytes_per_sec) // 2) * 2
            end_byte = (int(end_time * bytes_per_sec) // 2) * 2
            if start_byte >= buf_len:
                continue
            end_byte = min(end_byte, buf_len)
            if end_byte <= start_byte:
                continue

            audio_slice = bytes(pcm_buffer[start_byte:end_byte])

            if sid not in wav_files:
                path = audio_dir / f"speaker_{sid}.wav"
                wf = wave.open(str(path), "wb")
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wav_files[sid] = wf
                logger.info("Opened speaker WAV: %s", path)

            wav_files[sid].writeframes(audio_slice)


class _FakeAudioProcessor:
    """Minimal stand-in so SpeakerRecognitionSession can find WAV files."""
    def __init__(self, audio_dir: Path):
        self._audio_dir = audio_dir
