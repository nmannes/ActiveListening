import asyncio
import json
import logging
import time
import websockets
from collections import defaultdict
from pylib.keyword_matching import find_keyword_match, remove_market_from_index, remove_from_index
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
                msg = (
                    f"🔔 [SIGNAL] {market_title}\n"
                    f"Keyword: \"{matched['key']}\"\n"
                    f"Speaker: {speaker_id}\n"
                    f"Ticker: {matched['value']}\n"
                    f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}\n"
                    f"Trading: {self.session.server.config.trade_for_real}"
                )

                asyncio.get_running_loop().run_in_executor(
                    None, send_telegram, msg, "debug"
                )

                if speaker_id not in self.trading_speakers:
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id} because not a trading speaker"
                    )
                    continue

                if not self.session.is_content_visible:
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id} because desired content not on screen"
                    )
                    continue

                if self.session.server.config.trade_for_real:

                    order_amount = self.session.market.get("orderAmount", 0)
                    if order_amount <= 0:
                        logger.info(
                            f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, {matched['key']}, because orderAmount is {order_amount}"
                        )
                        continue
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Placing order for {speaker_id}: \"{matched['key']}\" (orderAmount={order_amount})"
                    )
                    order_result = await self.place_order(matched, order_amount=order_amount)
                    remove_market_from_index(
                        self.session.keyword_index, matched["value"]
                    )
                    logger.info(
                        f"[{self.session.session_id}][TRADE] Order result: {order_result}"
                    )
                    # Send Telegram notification for trade result
                    msg = (
                        f"🚀 [TRADE] {self.session.market.get('title', matched['value'])}\n"
                        f"Ticker: {matched['value']}\n"
                        f"Word: {matched['key']}\n"
                        f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}\n"
                        f"Result: {order_result}"
                    )
                    asyncio.get_running_loop().run_in_executor(None, send_telegram, msg, "info")

                # Notify client
                try:
                    await self.session.websocket.send(
                        json.dumps(
                            {
                                "type": "signal",
                                "keyword": matched["key"],
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

    async def place_order(self, matched, order_amount=None):
        order_result = None
        try:
            # Check if there are specific word configurations
            keyword_configs = self.session.market.get("keywordConfigs", {})
            word_config = keyword_configs.get(matched["key"], {})

            purchase_price = int(
                word_config.get(
                    "purchasePrice", self.session.market.get("purchasePrice", 90)
                )
            )
            purchase_count = int(
                word_config.get(
                    "purchaseCount",
                    order_amount
                    if order_amount is not None
                    else self.session.market.get(
                        "purchaseCount", self.session.server.config.buy_count
                    ),
                )
            )

            t0_trade = time.time()
            order_result = self.session.server.kalshi.place_fill_or_kill_order(
                yes_price=purchase_price,
                ticker=matched["value"],
                count=purchase_count,
            )
            t1_trade = time.time()
            logger.info(
                f"[{self.session.session_id}][TRADE] Successfully placed order for {matched['value']} (took {t1_trade - t0_trade:.4f}s)"
            )
            logger.info(
                f"[{self.session.session_id}][TRADE] Order result: {order_result}"
            )

        except Exception as e:
            logger.error(
                f"[{self.session.session_id}][TRADE] Error placing order. error: {e}, result: {order_result}"
            )


class DiarizedTradeProcessor(TradeProcessor):
    async def process_tokens(self, tokens: list[dict], speaker_id: str = None):
        if speaker_id:
            logger.info(
                f"[{self.session.session_id}][DIARIZED] Processing {len(tokens)} tokens from speaker: {speaker_id}"
            )
        await super().process_tokens(tokens, speaker_id=speaker_id)
