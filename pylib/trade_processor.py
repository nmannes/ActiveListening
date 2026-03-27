import websockets
from collections import defaultdict
from pylib.keyword_matching import find_keyword_match, remove_market_from_index
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
        logger.info(f"[{self.session.session_id}][TRADE] Whitelist updated: {self.trading_speakers}")

    def add_trading_speaker(self, speaker_id: str):
        self.trading_speakers.add(str(speaker_id))
        logger.info(f"[{self.session.session_id}][TRADE] Added to whitelist: {speaker_id}")

    async def process_tokens(self, tokens: list[str], speaker_id: str = None):
        if not tokens:
            return

        speaker_id = str(speaker_id) if speaker_id is not None else "unknown"
        
        # 1. Update global transcript (interleaved)
        new_tokens_added = []
        for token in tokens:
            if not token:
                continue

            # Deduplicate adjacent in global transcript
            if self.session.transcript and self.session.transcript[-1] == token:
                continue
            if new_tokens_added and new_tokens_added[-1] == token:
                continue

            self.session.transcript.append(token)
            new_tokens_added.append(token)
            if len(self.session.transcript) > 10000:
                self.session.transcript.pop(0)

        # 2. Update per-speaker buffer
        speaker_buffer = self.speaker_buffers[speaker_id]
        
        # 3. Match and Trade
        # We only match keywords if the speaker is in the trading_speakers set.
        # If trading_speakers is empty, we don't trade on anyone (conservative).
        
        for token in tokens:
            # We add to speaker buffer one by one as we process them for matching
            speaker_buffer.append(token)
            if len(speaker_buffer) > 100:

            if speaker_id in self.trading_speakers:
                matched = find_keyword_match(self.session.keyword_index, speaker_buffer, token)
                if matched:
                    logger.info(f"[{self.session.session_id}][SIGNAL] Detected for speaker {speaker_id}: \"{matched['key']}\"")

                    if not self.session.is_content_visible:
                        logger.info(f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id} because desired content not on screen")
                        continue

                    if self.session.server.config.trade_for_real:
                        await self.place_order(matched)
                    else:
                        logger.info(f"[{self.session.session_id}][TRADE] Not trading for real but \"{matched['key']}\" detected for {speaker_id}")

                    remove_market_from_index(self.session.keyword_index, matched["value"])

                    # Notify client
                    try:
                        await self.session.websocket.send(
                            json.dumps(
                                {
                                    "type": "signal",
                                    "keyword": matched["key"],
                                    "ticker": matched["value"],
                                    "speaker_id": speaker_id,
                                }
                            )
                        )
                    except websockets.exceptions.ConnectionClosed:
                        pass

        if new_tokens_added:
            recent = " ".join(self.session.transcript[-self.session.server.config.last_words_count :])
            logger.info(f"[{self.session.session_id}][{speaker_id}] Transcript: {' '.join(new_tokens_added)} (Last {self.session.server.config.last_words_count}: {recent})")
            transcript_logger.info(f"[{self.session.session_id}][{speaker_id}] {' '.join(new_tokens_added)}")
            try:
                await self.session.websocket.send(
                    json.dumps(
                        {
                            "type": "transcript",
                            "text": " ".join(new_tokens_added),
                            "speaker_id": speaker_id,
                        }
                    )
                )
            except websockets.exceptions.ConnectionClosed:
                pass

    async def place_order(self, matched):
        order_result = None
        try:
            # Check if there are specific word configurations
            keyword_configs = self.session.market.get("keywordConfigs", {})
            word_config = keyword_configs.get(matched["key"], {})
            
            purchase_price = int(word_config.get("purchasePrice", self.session.market.get("purchasePrice", 90)))
            purchase_count = int(word_config.get("purchaseCount", self.session.market.get("purchaseCount", self.session.server.config.buy_count)))
            
            t0_trade = time.time()
            order_result = self.session.server.kalshi.place_fill_or_kill_order(
                yes_price=purchase_price,
                ticker=matched["value"],
                count=purchase_count,
            )
            t1_trade = time.time()
            logger.info(f"[{self.session.session_id}][TRADE] Successfully placed order for {matched['value']} (took {t1_trade - t0_trade:.4f}s)")
            logger.info(f"[{self.session.session_id}][TRADE] Order result: {order_result}")

            # Send Telegram notification
            msg = (
                f"🚀 [TRADE] {self.session.market.get('title', matched['value'])}\n"
                f"Ticker: {matched['value']}\n"
                f"Result: {order_result}"
            )
            asyncio.get_running_loop().run_in_executor(None, send_telegram, msg, "info")
            
        except Exception as e:
            logger.error(f"[{self.session.session_id}][TRADE] Error placing order. error: {e}, result: {order_result}")

class DiarizedTradeProcessor(TradeProcessor):
    async def process_tokens(self, tokens: list[dict], speaker_id: str = None):
        if speaker_id:
            logger.info(f"[{self.session.session_id}][DIARIZED] Processing {len(tokens)} tokens from speaker: {speaker_id}")
        await super().process_tokens(tokens, speaker_id=speaker_id)
