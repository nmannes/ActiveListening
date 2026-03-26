import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Optional, Dict, Any

import websockets
from websockets.server import WebSocketServerProtocol
from concurrent.futures import ThreadPoolExecutor

from pylib.clip import FrameClassifier
from pylib.session_context import SessionContext
from pylib.telegram import send_telegram_photo

logger = logging.getLogger("remote_server")

class FrameProcessor:
    def __init__(
        self, 
        sid: str, 
        websocket: WebSocketServerProtocol, 
        clip_executor: ThreadPoolExecutor, 
        frame_classifier: FrameClassifier, 
        ctx: SessionContext,
        telegram_channel: str = 'info'
    ):
        self.sid = sid
        self.websocket = websocket
        self.clip_executor = clip_executor
        self.frame_classifier = frame_classifier
        self.ctx = ctx
        self.telegram_channel = telegram_channel
        self.frame_path = Path(__file__).parent.parent / "debug" / f"frame-{sid}.jpg"

    async def run(self) -> None:
        last_mtime = 0.0
        consecutive_results = 0
        last_result_state = None
        
        while True:
            await asyncio.sleep(2)
            try:
                if not self.frame_path.exists():
                    continue
                mtime = self.frame_path.stat().st_mtime
                if mtime == last_mtime:
                    continue
                last_mtime = mtime
                data = self.frame_path.read_bytes()
                if len(data) < 3 or data[0] != 0xFF or data[1] != 0xD8:
                    continue
                    
                result = await asyncio.get_running_loop().run_in_executor(
                    self.clip_executor, self.frame_classifier.classify, data
                )
                
                current_result = result["is_desired_content_visible"]
                if last_result_state == current_result:
                    consecutive_results += 1
                else:
                    last_result_state = current_result
                    consecutive_results = 1

                if consecutive_results >= 3 and self.ctx.is_content_visible != current_result:
                    logger.info(f"[{self.sid}][clip] State flip: content_visible changed to {current_result} after {consecutive_results} consecutive matches")
                    self.ctx.is_content_visible = current_result

                logger.info(f"[{self.sid}][clip] raw_visible={current_result} (streak={consecutive_results}) active_state={self.ctx.is_content_visible} conf={result['confidence']:.2f}")

                # Save debug frame
                frames_dir = Path(__file__).parent.parent / "debug" / "frames"
                frames_dir.mkdir(exist_ok=True, parents=True)
                ts = int(time.time() * 1000)
                frame_file = frames_dir / f"{self.sid}_{ts}.jpg"
                frame_file.write_bytes(data)
                (frames_dir / f"{self.sid}_{ts}.json").write_text(json.dumps(result, indent=2))

                # Send to Telegram
                caption = f"[{self.sid}] Content Visible: {current_result}\nConfidence: {result['confidence']:.2f}"
                send_telegram_photo(str(frame_file), caption=caption, channel=self.telegram_channel)

                await self.websocket.send(json.dumps({"type": "frame_classification", **result}))
            except websockets.exceptions.ConnectionClosed:
                break
            except Exception as e:
                logger.error(f"[{self.sid}][clip] classification error: {e}")
