import asyncio
import json
import logging
import time
from pylib.keyword_matching import remove_market_from_index
from pylib.ordering_config import get_dollar_amount
from pylib.telegram import send_telegram

logger = logging.getLogger("remote_server")


class SignalHandler:
    """Trading gates, order placement, and notification dispatch."""

    def __init__(self, session):
        self.session = session
        self.trading_speakers: set[str] = set()

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
            return

        word_confidence = token.get("confidence", 0)
        if word_confidence < self.session.server.config.min_confidence:
            logger.info(
                f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, \"{match['key']}\", because confidence {word_confidence:.3f} < {self.session.server.config.min_confidence}"
            )
            msg = f"[{self.session.session_id}][TRADE] Skipping trade for {speaker_id}, \"{match['key']}\", confidence {word_confidence:.3f} < {self.session.server.config.min_confidence}"
            asyncio.get_running_loop().run_in_executor(
                None, send_telegram, msg, "debug"
            )
            return

        self._execute_trade(match, dollar_amount)

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

    def _execute_trade(self, match: dict, dollar_amount: float):
        logger.info(
            f"[{self.session.session_id}][TRADE] Placing market order for \"{match['key']}\" (up to ${dollar_amount})"
        )
        order_result = self._place_order(match, dollar_amount)
        if order_result is None:
            logger.error(
                f"[{self.session.session_id}][TRADE] Order failed, no result returned for {match['key']}"
            )
            return

        remove_market_from_index(self.session.keyword_index, match["value"])
        logger.info(
            f"[{self.session.session_id}][TRADE] Order result: {order_result}"
        )
        msg = "\n".join([
            f"\U0001f680 [TRADE] {self.session.market.get('title', match['value'])}",
            f"Ticker: {match['value']}",
            f"Word: {match['key']}",
            f"Channel: {self.session.market.get('mediaSourceCommonName', 'Unknown')}",
            f"Source: {self.session.market.get('mediaStreamURL', '')}",
            f"Status: {order_result.status}",
            f"Taker fill cost: ${order_result.taker_fill_cost_dollars}",
        ])
        level = "info" if order_result.status == "filled" else "debug"
        asyncio.get_running_loop().run_in_executor(
            None, send_telegram, msg, level
        )

    def _place_order(self, match: dict, dollar_amount: float):
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
