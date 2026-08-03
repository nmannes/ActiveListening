import json
import logging
import websockets
from pylib.signal_detector import SignalDetector
from pylib.signal_handler import SignalHandler

logger = logging.getLogger("remote_server")


class TradeProcessor:
    def __init__(self, session):
        self.session = session
        self.detector = SignalDetector()
        self.handler = SignalHandler(session)
        self.logger = logger

    def set_trading_speakers(self, speaker_ids: list[str], market_indices: list[int] = None):
        self.handler.set_trading_speakers(speaker_ids, market_indices=market_indices)

    def add_trading_speaker(self, speaker_id: str, market_indices: list[int] = None) -> bool:
        """Add a speaker to the trading whitelist. Returns True if newly added, False if already present."""
        return self.handler.add_trading_speaker(speaker_id, market_indices=market_indices)

    async def process_tokens(self, tokens: list[dict], speaker_id: str = None):
        if not tokens:
            return

        speaker_id = str(speaker_id) if speaker_id else "unknown"

        new_tokens = await self._update_transcript(speaker_id, tokens)
        if not new_tokens:
            return

        for token in new_tokens:
            match = self.detector.feed_token(speaker_id, token, self.session.keyword_index)
            if match:
                logger.info(
                    f"[{self.session.session_id}][TRADE] Signal matched: \"{match['key']}\" ({match['value']}) by speaker {speaker_id}"
                )
                await self.handler.handle_signal(match, speaker_id, token)

        await self._emit_transcript(speaker_id, new_tokens)

    async def _update_transcript(self, speaker_id: str, tokens: list[dict]) -> list[dict]:
        sorted_tokens = sorted(tokens, key=lambda x: x.get("start", 0))
        async with self.session.transcript_lock:
            speaker_transcript = self.session.transcript[speaker_id]
            new_tokens = []
            for token_dict in sorted_tokens:
                text = token_dict.get("text", "").strip()
                if not text:
                    continue
                if speaker_transcript and speaker_transcript[-1]["text"] == text:
                    continue
                if new_tokens and new_tokens[-1]["text"] == text:
                    continue
                speaker_transcript.append(token_dict)
                new_tokens.append(token_dict)
        return new_tokens

    async def _emit_transcript(self, speaker_id: str, new_tokens: list[dict]):
        new_text = " ".join(t["text"] for t in new_tokens)
        try:
            await self.session.websocket.send(
                json.dumps({
                    "type": "transcript",
                    "text": new_text,
                    "speaker_id": speaker_id,
                })
            )
        except websockets.exceptions.ConnectionClosed:
            pass
