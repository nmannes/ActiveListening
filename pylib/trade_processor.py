import asyncio
import json
import logging
import time
import websockets
from collections import defaultdict
from pylib.keyword_matching import find_keyword_match, remove_market_from_index, remove_from_index
from pylib.ordering_config import get_dollar_amount
from pylib.telegram import send_telegram

logger = logging.getLogger("remote_server")
transcript_logger = logging.getLogger("transcript")


class TradeProcessor:
    def __init__(self, session):
        self.session = session
        self.speaker_buffers = defaultdict(list)
        self.trading_speakers = set()
        # Default to all-trading if not specified?
        # User said "A subset of the speakers may be ones that we care about",
        # suggesting we start with none or explicit set.
        # Let's keep it empty by default.
        self.logger = logger

    def set_trading_speakers(self, speaker_ids: list[str]):
        self.trading_speakers = set(str(s) for s in speaker_ids)
        logger.info(
            f"[{self.session.session_id}][TRADE] Whitelist updated: {self.trading_speakers}"
        )

    def add_trading_speaker(self, speaker_id: str):
        self.trading_speakers.add(str(speaker_id))
        logger.info(
            f"[{self.session.session_id}][TRADE] Added to whitelist: {speaker_id}"
        )

    async def process_tokens(self, tokens: list[dict], speaker_id: str = None):
        """
        Processes incoming tokens from a specific speaker.
        tokens: list of {'text': str, 'start': float}
        """
        if not tokens:
            return

        speaker_id = str(speaker_id) if speaker_id is not None else "unknown"

        # Sort incoming tokens by timestamp to handle potentially out-of-order delivery
        sorted_tokens = sorted(tokens, key=lambda x: x.get("start", 0))

        # 1. Update per-speaker transcript
        async with self.session.transcript_lock:
            speaker_transcript = self.session.transcript[speaker_id]
            new_tokens_added = []
            for token_dict in sorted_tokens:
                text = token_dict.get("text", "").strip()
                if not text:
                    continue

                # Deduplicate adjacent in this speaker's transcript
                if speaker_transcript and speaker_transcript[-1]["text"] == text:
                    continue
                if new_tokens_added and new_tokens_added[-1]["text"] == text:
                    continue

                speaker_transcript.append(token_dict)
                new_tokens_added.append(token_dict)

        # 2. Update per-speaker buffer and Match
        speaker_buffer = self.speaker_buffers[speaker_id]

        # We always want to detect keywords for notifications, even if NOT trading
        for t in new_tokens_added:
            word = t["text"]
            speaker_buffer.append(word)

            matched = find_keyword_match(
                self.session.keyword_index, speaker_buffer, word
            )
            if matched:
                logger.info(
                    f"[{self.session.session_id}][SIGNAL] Detected for speaker {speaker_id}: \"{matched['key']}\""
                )
                
                # Send Telegram notification regardless of trading status
                market_title = self.session.market.get("title", matched["key"])
                msg = "\n".join([
                    f"🔔 [SIGNAL] {market_title}",
                    f"Keyword: \"{matched['key']}\"",
                    f"Speaker: {speaker_id}",
                    f"Ticker: {matched['value']}",
                    f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
                    f"Source: {self.session.market.get('mediaStreamURL', '')}",
                    f"Trading: {self.session.server.config.trade_for_real}",
                ])

                asyncio.get_running_loop().run_in_executor(
                    None, send_telegram, msg, "debug"
                )

                if speaker_id not in self.trading_speakers:
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id} because not a trading speaker"
                    )
                    continue

                if self.session.server.config.trade_for_real:

                    dollar_amount = get_dollar_amount(self.session.market, matched["key"])
                    if dollar_amount <= 0:
                        logger.info(
                            f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, {matched['key']}, because dollarAmount is {dollar_amount}"
                        )
                        continue
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Placing market order for {speaker_id}: \"{matched['key']}\" (up to ${dollar_amount})"
                    )
                    order_result = await self.place_order(matched, dollar_amount=dollar_amount)
                    remove_market_from_index(
                        self.session.keyword_index, matched["value"]
                    )
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Order result: {order_result}"
                    )
                    # Send Telegram notification for trade result
                    if order_result is None:
                        logger.error(
                            f"[{self.session.session_id}][TRADE] Order failed, no result returned for {matched['key']}"
                        )
                    else:
                        order = order_result
                        msg = "\n".join([
                            f"🚀 [TRADE] {self.session.market.get('title', matched['value'])}",
                            f"Ticker: {matched['value']}",
                            f"Word: {matched['key']}",
                            f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
                            f"Source: {self.session.market.get('mediaStreamURL', '')}",
                            f"Status: {order.status}",
                            f"Taker fill cost: ${round(order.taker_fill_cost_dollars,2)}",
                        ])
                        msg_debug_level = "debug"
                        if order.status is "filled":
                            msg_debug_level = "info"

                        asyncio.get_running_loop().run_in_executor(None, send_telegram, msg, msg_debug_level)

                # Notify client
                try:
                    await self.session.websocket.send(
                        json.dumps(
                            {
                                "type": "signal",
                                "keyword": matched["key"],
                                "ticker": matched["value"],
                                "start": t.get("start"),
                            }
                        )
                    )
                except Exception as e:
                    logger.error(
                        f"[{self.session.session_id}] Error notifying client of signal: {e}"
                    )

        if new_tokens_added:
            new_text = " ".join(t["text"] for t in new_tokens_added)
            async with self.session.transcript_lock:
                recent = " ".join(
                    t["text"]
                    for t in speaker_transcript[
                        -self.session.server.config.last_words_count :
                    ]
                )

            logger.info(
                f"[{self.session.session_id}][{speaker_id}] Transcript: {new_text} (Last {self.session.server.config.last_words_count}: {recent})"
            )
            transcript_logger.info(
                f"[{self.session.session_id}][{speaker_id}] {new_text}"
            )

            try:
                await self.session.websocket.send(
                    json.dumps(
                        {
                            "type": "transcript",
                            "text": new_text,
                            "speaker_id": speaker_id,
                        }
                    )
                )
            except websockets.exceptions.ConnectionClosed:
                pass

    async def place_order(self, matched, dollar_amount=None):
        order_result = None
        try:
            keyword_configs = self.session.market.get("keywordConfigs", {})
            word_config = keyword_configs.get(matched["key"], {})

            dollar_amount = (
                word_config.get("dollarAmount")
                or dollar_amount
                or self.session.market.get("dollarAmount")
                or self.session.server.config.buy_max_cost
            )

            t0_trade = time.time()
            order_result = self.session.server.kalshi.place_market_order(
                ticker=matched["value"],
                dollar_amount=dollar_amount,
            )
            t1_trade = time.time()
            logger.info(
                f"[{self.session.session_id}][TRADE] Successfully placed market order for {matched['value']} (took {t1_trade - t0_trade:.4f}s)"
            )
            logger.info(
                f"[{self.session.session_id}][TRADE] Order result: {order_result}"
            )

        except Exception:
            logger.exception(
                f"[{self.session.session_id}][TRADE] Error placing order"
            )
            msg = "\n".join([
                f"❌ [ORDER ERROR] {self.session.market.get('title', matched['value'])}",
                f"Ticker: {matched['value']}",
                f"Word: {matched['key']}",
                f"Dollar amount: ${dollar_amount}",
                f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
                f"Source: {self.session.market.get('mediaStreamURL', '')}",
            ])
            asyncio.get_running_loop().run_in_executor(
                None, send_telegram, msg, "error"
            )

        return order_result


class DiarizedTradeProcessor(TradeProcessor):
    async def process_tokens(self, tokens: list[dict], speaker_id: str = None):
        if speaker_id:
            logger.info(
                f"[{self.session.session_id}][DIARIZED] Processing {len(tokens)} tokens from speaker: {speaker_id}"
            )
        await super().process_tokens(tokens, speaker_id=speaker_id)
