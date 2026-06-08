import asyncio
import json
import logging
import os
import time
import base64
from pathlib import Path
from pylib.telegram import send_telegram_photo

logger = logging.getLogger("remote_server")


class FrameProcessor:
    def __init__(self, session):
        self.session = session

    async def run(self):
        sid = self.session.session_id
        frame_path = Path(__file__).parent.parent / "debug" / f"frame-{sid}.jpg"
        last_mtime = 0
        consecutive_results = 0
        last_result_state = None

        while True:
            await asyncio.sleep(2)
            try:
                if not frame_path.exists():
                    continue
                mtime = frame_path.stat().st_mtime
                if mtime == last_mtime:
                    continue
                last_mtime = mtime
                data = frame_path.read_bytes()
                if len(data) < 3 or data[0] != 0xFF or data[1] != 0xD8:
                    continue
                if self.session.server.frame_classifier is None:
                    # Still loading in background
                    continue

                result = await asyncio.get_running_loop().run_in_executor(
                    self.session.server.clip_executor,
                    self.session.server.frame_classifier.classify,
                    data,
                    self.session.clip_profile,
                )

                current_result = result["is_desired_content_visible"]
                if last_result_state == current_result:
                    consecutive_results += 1
                else:
                    last_result_state = current_result
                    consecutive_results = 1

                if (
                    consecutive_results >= 3
                    and self.session.is_content_visible != current_result
                ):
                    logger.info(
                        f"[{sid}][clip] State flip: content_visible changed to {current_result} after {consecutive_results} consecutive matches"
                    )
                    self.session.is_content_visible = current_result

                logger.info(
                    f"[{sid}][clip] raw_visible={current_result} "
                    f"(streak={consecutive_results}) "
                    f"active_state={self.session.is_content_visible} "
                    f"profile={result['content_profile']} "
                    f"conf={result['confidence']:.2f} "
                    f"({result['elapsed_ms']}ms)"
                )

                # Save frame and result for debugging (only when env var is set)
                if os.environ.get("DEBUG_SAVE_FRAMES"):
                    frames_dir = Path(__file__).parent.parent / "debug" / "frames"
                    frames_dir.mkdir(exist_ok=True, parents=True)

                    # Use a timestamp to keep them ordered
                    ts = int(time.time() * 1000)
                    prefix = f"{sid}_{ts}"

                    (frames_dir / f"{prefix}.jpg").write_bytes(data)
                    (frames_dir / f"{prefix}.json").write_text(json.dumps(result, indent=2))

                # Send to Telegram debug channel (only when frame was saved to disk)
                if os.environ.get("DEBUG_SAVE_FRAMES"):
                    caption = (
                        f"[{sid}][{result['content_profile']}] "
                        f"visible={current_result} "
                        f"conf={result['confidence']:.2f} "
                        f"({result['elapsed_ms']}ms)"
                    )
                    asyncio.get_running_loop().run_in_executor(
                        None,
                        send_telegram_photo,
                        str(frames_dir / f"{prefix}.jpg"),
                        caption,
                        "debug",
                    )

                # Send to client with image data for debugging
                img_b64 = base64.b64encode(data).decode("utf-8")
                await self.session.websocket.send(
                    json.dumps(
                        {
                            "type": "frame_classification",
                            "image": f"data:image/jpeg;base64,{img_b64}",
                            **result,
                        }
                    )
                )
            except Exception as e:
                # Handle connection closed error and others
                if "ConnectionClosed" in str(type(e)):
                    break
                logger.error(f"[{sid}][clip] classification error: {e}")
