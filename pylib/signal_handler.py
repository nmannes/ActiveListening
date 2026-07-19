import asyncio
import json
import logging
import os
import tempfile
import time
import wave
from pylib.keyword_matching import remove_market_from_index
from pylib.ordering_config import get_dollar_amount
from pylib.telegram import send_telegram, send_telegram_audio

logger = logging.getLogger("remote_server")


def _send_audio_clip(audio_bytes: bytes, word: str, start: float, end: float):
    """Write PCM bytes to a temp WAV and send via Telegram. Runs in executor thread."""
    fd, path = tempfile.mkstemp(suffix=".wav")
    try:
        with os.fdopen(fd, "wb") as f:
            wf = wave.open(f)
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(audio_bytes)
            wf.close()
        caption = f"{word} ({start:.1f}s-{end:.1f}s)"
        send_telegram_audio(path, caption=caption, channel="info")
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


class SignalHandler:
    """Trading gates, order placement, and notification dispatch."""

    def __init__(self, session):
        self.session = session
        self.trading_speakers: set[str] = set()
        self.session_cost_total: float = 0.0

    def set_trading_speakers(self, speaker_ids: list[str]):
        self.trading_speakers = set(str(s) for s in speaker_ids)
        logger.info(
            f"[{self.session.session_id}][TRADE] Whitelist updated: {self.trading_speakers}"
        )

    def add_trading_speaker(self, speaker_id: str) -> bool:
        """Add a speaker to the trading whitelist. Returns True if newly added, False if already present."""
        sid = str(speaker_id)
        is_new = sid not in self.trading_speakers
        self.trading_speakers.add(sid)
        return is_new

    async def handle_signal(self, match: dict, speaker_id: str, token: dict):
        self._send_signal_telegram(match, speaker_id)
        await self._notify_client(match, token)

        if speaker_id not in self.trading_speakers:
            logger.info(
                f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id} because not a trading speaker"
            )
            return

        if not self.session.server.config.trade_for_real:
            return

        dollar_amount = get_dollar_amount(self.session.market, match["key"])
        if dollar_amount <= 0:
            logger.info(
                f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, {match['key']}, because dollarAmount is {dollar_amount}"
            )
            msg = f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" — dollarAmount is {dollar_amount}"
            asyncio.get_running_loop().run_in_executor(
                None, send_telegram, msg, "debug"
            )
            return

        word_confidence = match.get("min_confidence", token.get("confidence", 0))
        if word_confidence < self.session.server.config.min_confidence:
            logger.info(
                f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, \"{match['key']}\", because confidence {word_confidence:.3f} < {self.session.server.config.min_confidence}"
            )
            msg = f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, \"{match['key']}\", confidence {word_confidence:.3f} < {self.session.server.config.min_confidence}"
            asyncio.get_running_loop().run_in_executor(
                None, send_telegram, msg, "debug"
            )
            return

        best_ask = None
        tracker = getattr(self.session, "orderbook_tracker", None)
        if tracker is not None:
            best_ask = tracker.get_best_yes_ask(match["value"])
            min_price = self.session.server.config.min_yes_ask_price
            if best_ask is not None and best_ask <= min_price:
                logger.info(
                    f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" ({match['value']}) — best YES ask ${best_ask:.2f} <= ${min_price:.2f} (market likely resolved)"
                )
                msg = f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" ({match['value']}) — best YES ask ${best_ask:.2f} <= ${min_price:.2f} (market likely resolved)"
                asyncio.get_running_loop().run_in_executor(
                    None, send_telegram, msg, "debug"
                )
                return
            if tracker.appears_resolved_no(match["value"]):
                best_bid = tracker.get_best_yes_bid(match["value"])
                bid_str = f"${best_bid:.2f}" if best_bid is not None else "None"
                logger.info(
                    f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" ({match['value']}) — market appears resolved NO (best YES bid: {bid_str})"
                )
                msg = f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" ({match['value']}) — market appears resolved NO (best YES bid: {bid_str})"
                asyncio.get_running_loop().run_in_executor(
                    None, send_telegram, msg, "debug"
                )
                return

        self._execute_trade(match, dollar_amount, word_confidence, token.get("start"), token.get("end"), best_ask)

    def _send_signal_telegram(self, match: dict, speaker_id: str):
        market_title = self.session.market.get("title", match["key"])
        msg = "\n".join([
            f"\U0001f514 [SIGNAL] {market_title}",
            f"Keyword: \"{match['key']}\"",
            f"Speaker: {speaker_id}",
            f"Ticker: {match['value']}",
            f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
            f"Source: {self.session.market.get('mediaStreamURL', '')}",
            f"Trading: {self.session.server.config.trade_for_real}",
        ])
        asyncio.get_running_loop().run_in_executor(
            None, send_telegram, msg, "debug"
        )

    async def _notify_client(self, match: dict, token: dict):
        try:
            await self.session.websocket.send(
                json.dumps({
                    "type": "signal",
                    "keyword": match["key"],
                    "ticker": match["value"],
                    "start": token.get("start"),
                })
            )
        except Exception as e:
            logger.error(
                f"[{self.session.session_id}] Error notifying client of signal: {e}"
            )

    def _execute_trade(self, match: dict, dollar_amount: float, confidence: float, start: float | None, end: float | None, best_ask: float | None = None):
        limit_price = (min(0.99, best_ask + 0.05) if best_ask is not None and best_ask > 0 else 0.99)
        logger.info(
            f"[{self.session.session_id}][TRADE] Placing market order for \"{match['key']}\" (up to ${dollar_amount}, limit {limit_price:.2f})"
        )
        msg = f"[{self.session.session_id}][TRADE] Placing market order for \"{match['key']}\" (up to ${dollar_amount}, limit {limit_price:.2f})"
        asyncio.get_running_loop().run_in_executor(
            None, send_telegram, msg, "debug"
        )
        max_session_loss = self.session.server.config.max_session_loss
        if self.session_cost_total + dollar_amount > max_session_loss:
            logger.info(
                f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" — "
                f"session cost ${self.session_cost_total:.2f} + ${dollar_amount:.2f} "
                f"would exceed max_session_loss ${max_session_loss:.2f}"
            )
            msg = (
                f"[{self.session.session_id}][TRADE] Skipping \"{match['key']}\" — "
                f"session cap reached (${self.session_cost_total:.2f} spent of ${max_session_loss:.2f})"
            )
            asyncio.get_running_loop().run_in_executor(
                None, send_telegram, msg, "debug"
            )
            return

        order_result = self._place_order(match, dollar_amount, best_ask)
        if order_result is None:
            logger.error(
                f"[{self.session.session_id}][TRADE] Order failed, no result returned for {match['key']}"
            )
            return

        self.session_cost_total += order_result.taker_fill_cost_dollars
        remove_market_from_index(self.session.keyword_index, match["value"])
        logger.info(
            f"[{self.session.session_id}][TRADE] Order result: {order_result}"
        )
        msg = "\n".join([
            f"\U0001f680 [TRADE] {self.session.market.get('title', match['value'])}",
            f"Ticker: {match['value']}",
            f"Word: {match['key']}",
            f"Confidence: {confidence:.3f}",
            f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
            f"Source: {self.session.market.get('mediaStreamURL', '')}",
            f"Status: {order_result.status}",
            f"Taker fill cost: ${order_result.taker_fill_cost_dollars}",
            f"Session total: ${self.session_cost_total:.2f} / ${self.session.server.config.max_session_loss:.0f}",
        ])
        level = "info" if order_result.status == "filled" else "debug"
        asyncio.get_running_loop().run_in_executor(
            None, send_telegram, msg, level
        )

        if start is not None and end is not None:
            self._extract_and_send_audio(start, end, match["key"])

    def _extract_and_send_audio(self, start: float, end: float, word: str):
        """Slice PAD_SECS around the detected word from the PCM buffer and send via Telegram."""
        PAD_SECS = 5
        bytes_per_sec = 16000 * 2
        audio_processor = getattr(self.session, "audio_processor", None)
        if audio_processor is None:
            return
        pcm_buffer = audio_processor._pcm_buffer
        buf_len = len(pcm_buffer)

        clip_start = max(0, start - PAD_SECS)
        clip_end = min(end + PAD_SECS, buf_len / bytes_per_sec)
        start_byte = (int(clip_start * bytes_per_sec) // 2) * 2
        end_byte = (int(clip_end * bytes_per_sec) // 2) * 2

        if end_byte <= start_byte:
            return

        audio_bytes = bytes(pcm_buffer[start_byte:end_byte])
        asyncio.get_running_loop().run_in_executor(
            None, _send_audio_clip, audio_bytes, word, clip_start, clip_end
        )

    def _place_order(self, match: dict, dollar_amount: float, best_ask: float | None = None):
        try:
            keyword_configs = self.session.market.get("keywordConfigs", {})
            word_config = keyword_configs.get(match["key"], {})
            dollar_amount = (
                word_config.get("dollarAmount")
                or dollar_amount
                or self.session.market.get("dollarAmount")
                or self.session.server.config.buy_max_cost
            )
            t0 = time.time()
            order_result = self.session.server.kalshi.place_market_order(
                ticker=match["value"],
                dollar_amount=dollar_amount,
                best_ask_dollars=best_ask,
            )
            t1 = time.time()
            logger.info(
                f"[{self.session.session_id}][TRADE] Successfully placed market order for {match['value']} (took {t1 - t0:.4f}s)"
            )
            logger.info(
                f"[{self.session.session_id}][TRADE] Order result: {order_result}"
            )
            return order_result
        except Exception:
            logger.exception(
                f"[{self.session.session_id}][TRADE] Error placing order"
            )
            msg = "\n".join([
                f"❌ [ORDER ERROR] {self.session.market.get('title', match['value'])}",
                f"Ticker: {match['value']}",
                f"Word: {match['key']}",
                f"Dollar amount: ${dollar_amount}",
                f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
                f"Source: {self.session.market.get('mediaStreamURL', '')}",
            ])
            asyncio.get_running_loop().run_in_executor(
                None, send_telegram, msg, "error"
            )
            return None
