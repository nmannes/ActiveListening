import json
import logging
import time
import re
from typing import List, Dict, Any, Optional

import websockets
from websockets.server import WebSocketServerProtocol

from pylib.kalshi_client import KalshiClient
from pylib.keyword_matching import find_keyword_match, remove_market_from_index

logger = logging.getLogger("remote_server")
transcript_logger = logging.getLogger("transcript")

class TokenProcessor:
    def __init__(
        self, 
        session_id: str, 
        websocket: WebSocketServerProtocol, 
        keyword_index: Dict[str, Any], 
        market: Dict[str, Any], 
        kalshi: KalshiClient, 
        trade_for_real: bool, 
        buy_count: int, 
        last_words_count: int
    ):
        self.session_id = session_id
        self.websocket = websocket
        self.keyword_index = keyword_index
        self.market = market
        self.kalshi = kalshi
        self.trade_for_real = trade_for_real
        self.buy_count = buy_count
        self.last_words_count = last_words_count
        self.transcript: List[str] = []
        self.punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')

    async def process_tokens(self, tokens: List[str], is_content_visible: bool) -> None:
        if not tokens:
            return

        new_tokens_added: List[str] = []
        for token in tokens:
            if not token:
                continue

            # Deduplicate adjacent
            if self.transcript and self.transcript[-1] == token:
                continue
            if new_tokens_added and new_tokens_added[-1] == token:
                continue

            self.transcript.append(token)
            new_tokens_added.append(token)
            if len(self.transcript) > 10000:
                self.transcript.pop(0)

            matched = find_keyword_match(self.keyword_index, self.transcript, token)
            if not matched:
                continue

            logger.info(f"[{self.session_id}][SIGNAL] Detected: \"{matched['key']}\"")

            if not is_content_visible:
                logger.info(f"[{self.session_id}][TRADE] Skipping trade because desired content not on screen")
                continue

            if self.trade_for_real:
                order_result = None
                try:
                    keyword_configs = self.market.get("keywordConfigs", {})
                    word_config = keyword_configs.get(matched["key"], {})
                    
                    purchase_price = int(word_config.get("purchasePrice", self.market.get("purchasePrice", 90)))
                    purchase_count = int(word_config.get("purchaseCount", self.market.get("purchaseCount", self.buy_count)))
                    
                    t0_trade = time.time()
                    order_result = self.kalshi.place_fill_or_kill_order(
                        yes_price=purchase_price,
                        ticker=matched["value"],
                        count=purchase_count,
                    )
                    t1_trade = time.time()
                    logger.info(f"[{self.session_id}][TRADE] Successfully placed order for {matched['value']} (took {t1_trade - t0_trade:.4f}s)")
                    logger.info(f"[{self.session_id}][TRADE] Order result: {order_result}")
                except Exception as e:
                    logger.error(f"[{self.session_id}][TRADE] Error placing order. error: {e}, result: {order_result}")
            else:
                logger.info(f"[{self.session_id}][TRADE] Not trading for real but \"{matched['key']}\" detected")

            remove_market_from_index(self.keyword_index, matched["value"])

            # Notify client
            try:
                await self.websocket.send(
                    json.dumps({
                        "type": "signal",
                        "keyword": matched["key"],
                        "ticker": matched["value"],
                    })
                )
            except websockets.exceptions.ConnectionClosed:
                pass

        if new_tokens_added:
            recent = " ".join(self.transcript[-self.last_words_count :])
            logger.info(f"[{self.session_id}] Transcript: {' '.join(new_tokens_added)} (Last {self.last_words_count}: {recent})")
            transcript_logger.info(f"[{self.session_id}] {' '.join(new_tokens_added)}")
            try:
                await self.websocket.send(
                    json.dumps({
                        "type": "transcript",
                        "text": " ".join(new_tokens_added),
                    })
                )
            except websockets.exceptions.ConnectionClosed:
                pass
