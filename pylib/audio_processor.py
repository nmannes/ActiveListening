import asyncio
import json
import logging
import os
import time
import websockets
import numpy as np
from pathlib import Path

logger = logging.getLogger("remote_server")
transcript_logger = logging.getLogger("transcript")

class AudioProcessor:
    def __init__(self, session, on_tokens_callback=None):
        self.session = session
        self.on_tokens_callback = on_tokens_callback
        
        # Deepgram specific configuration
        self.api_key = os.environ.get("DEEPGRAM_API_KEY")
        # URL parameters: Linear16, 16kHz, diarization enabled, nova-2 model
        self.dg_url = (
            "wss://api.deepgram.com/v1/listen?"
            "encoding=linear16&"
            "sample_rate=16000&"
            "channels=1&"
            "diarize=true&"
            "model=nova-2&"
            "smart_format=true"
        )

        # Performance counters
        self.total_bytes_sent = 0
        self.total_results_received = 0
        self.last_stats_time = time.time()

    async def run(self):
        self.session.transcript.clear()
        
        if not self.api_key:
            logger.error(f"[{self.session.session_id}] DEEPGRAM_API_KEY not found in environment!")
            return

        logger.info(
            f"[{self.session.session_id}] Audio processing loop starting. URL: {self.dg_url}"
        )

        headers = {
            "Authorization": f"Token {self.api_key}"
        }

        try:
            logger.info(f"[{self.session.session_id}] Attempting Deepgram connection...")
            # Use additional_headers for newer websockets version compat
            async with websockets.connect(self.dg_url, additional_headers=headers) as dg_ws:
                logger.info(f"[{self.session.session_id}] Deepgram WebSocket connected successfully")

                # Spawn sender and receiver tasks
                send_task = asyncio.create_task(self.send_audio(dg_ws))
                receive_task = asyncio.create_task(self.receive_results(dg_ws))
                telemetry_task = asyncio.create_task(self.telemetry_loop())

                try:
                    await asyncio.gather(send_task, receive_task, telemetry_task)
                except asyncio.CancelledError:
                    logger.info(f"[{self.session.session_id}] Deepgram tasks cancelled")
                except Exception as e:
                    logger.error(f"[{self.session.session_id}] Deepgram processing error: {e}")
                    raise
                finally:
                    # Clean shutdown
                    send_task.cancel()
                    receive_task.cancel()
                    telemetry_task.cancel()
                    
        except Exception as e:
            logger.exception(f"[{self.session.session_id}] Deepgram connection/runtime error: {e}")

    async def send_audio(self, dg_ws):
        """Stream PCM audio data from session inbox to Deepgram."""
        logger.info(f"[{self.session.session_id}] Audio sender task started")
        try:
            while True:
                await asyncio.sleep(0.01)

                with self.session.audio_inbox_lock:
                    if not self.session.audio_inbox:
                        continue
                    
                    pcm_data = bytes(self.session.audio_inbox)
                    self.session.audio_inbox.clear()

                chunk_size = len(pcm_data)
                self.total_bytes_sent += chunk_size
                
                # Periodically log throughput (every 10s)
                now = time.time()
                if now - self.last_stats_time > 10:
                    kb_sent = self.total_bytes_sent / 1024
                    logger.info(f"[{self.session.session_id}][STATS] Sent {kb_sent:.2f} KB total")
                    self.last_stats_time = now

                await dg_ws.send(pcm_data)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[{self.session.session_id}] Deepgram WebSocket closed (sender)")
        except Exception as e:
            logger.error(f"[{self.session.session_id}] Error in send_audio: {e}")

    async def receive_results(self, dg_ws):
        """Handle transcripts and metrics returned by Deepgram."""
        logger.info(f"[{self.session.session_id}] Results receiver task started")
        
        # Ensure deepgram_responses directory exists
        resp_dir = Path(__file__).parent.parent / "deepgram_responses"
        resp_dir.mkdir(exist_ok=True)
        
        try:
            async for message in dg_ws:
                # Save raw response to file (non-blocking)
                ts = time.time_ns()
                filename = resp_dir / f"dg_{ts}.json"
                
                # Inline lambda or helper to write file
                def _write():
                    with open(filename, "w") as f:
                        f.write(message)
                
                asyncio.get_running_loop().run_in_executor(None, _write)
                
                data = json.loads(message)
                msg_type = data.get("type")
                
                if msg_type == "Results":
                    is_final = data.get("is_final", False)
                    # We process final results for highest accuracy
                    if not is_final:
                        continue
                        
                    self.total_results_received += 1
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if not alternatives:
                        continue
                        
                    alt = alternatives[0]
                    words = alt.get("words", [])
                    if not words:
                        continue
                        
                    # Format tokens for TradeProcessor
                    formatted_tokens = [
                        {
                            "text": w["word"].lower(),
                            "start": w["start"],
                            "end": w["end"],
                        }
                        for w in words
                    ]
                    
                    # Extract speaker from first word if diarized
                    speaker_id = str(words[0].get("speaker", "0"))
                    
                    if self.on_tokens_callback:
                        asyncio.create_task(self.on_tokens_callback(formatted_tokens, speaker_id=speaker_id))

                    # Log transcript segment
                    transcript_text = alt.get("transcript", "").strip()
                    if transcript_text:
                        logger.info(f"[{self.session.session_id}][DG][{speaker_id}] {transcript_text}")
                
                elif msg_type == "Metadata":
                    logger.info(f"[{self.session.session_id}][DG] Metadata received: {json.dumps(data)}")
                elif msg_type == "UtteranceEnd":
                    logger.debug(f"[{self.session.session_id}][DG] Utterance end detected")
                else:
                    logger.debug(f"[{self.session.session_id}][DG] Unknown message type: {msg_type}")

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[{self.session.session_id}] Deepgram WebSocket closed (receiver)")
        except Exception as e:
            logger.error(f"[{self.session.session_id}] Error in receive_results: {e}")

    async def telemetry_loop(self):
        """Report buffer status and latency metrics to client."""
        logger.info(f"[{self.session.session_id}] Telemetry loop started")
        while True:
            await asyncio.sleep(5)
            try:
                with self.session.audio_inbox_lock:
                    size_bytes = len(self.session.audio_inbox)
                    inbox_ms = int(size_bytes / (16000 * 2) * 1000)

                logger.info(f"[{self.session.session_id}][TELEMETRY] Audio inbox: {size_bytes} bytes ({inbox_ms}ms)")

                await self.session.websocket.send(
                    json.dumps(
                        {
                            "type": "telemetry",
                            "buffer_ms": inbox_ms,
                            "dg_stream": "active"
                        }
                    )
                )
            except Exception as e:
                logger.error(f"[{self.session.session_id}] Telemetry error: {e}")
                break
