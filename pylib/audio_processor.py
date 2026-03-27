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
            "interim_results=true&"
            "punctuate=true&"
            "model=nova-2-general&"
            "no_delay=true"
        )

    async def run(self):
        self.session.transcript.clear()
        
        if not self.api_key:
            logger.error(f"[{self.session.session_id}] DEEPGRAM_API_KEY not found in environment!")
            return

        logger.info(
            f"[{self.session.session_id}] Audio processing loop started via Deepgram (speaker validation: {self.session.voice_profile})"
        )

        headers = {
            "Authorization": f"Token {self.api_key}"
        }

        try:
            async with websockets.connect(self.dg_url, extra_headers=headers) as dg_ws:
                logger.info(f"[{self.session.session_id}] Deepgram WebSocket connected")

                # Spawn sender and receiver tasks
                send_task = asyncio.create_task(self.send_audio(dg_ws))
                receive_task = asyncio.create_task(self.receive_results(dg_ws))
                telemetry_task = asyncio.create_task(self.telemetry_loop())

                try:
                    await asyncio.gather(send_task, receive_task, telemetry_task)
                except asyncio.CancelledError:
                    logger.info(f"[{self.session.session_id}] Deepgram tasks cancelled")
                finally:
                    # Clean shutdown
                    send_task.cancel()
                    receive_task.cancel()
                    telemetry_task.cancel()
                    
        except Exception as e:
            logger.exception(f"[{self.session.session_id}] Deepgram connection error: {e}")

    async def send_audio(self, dg_ws):
        """Stream PCM audio data from session inbox to Deepgram."""
        try:
            while True:
                await asyncio.sleep(0.01)

                with self.session.audio_inbox_lock:
                    if not self.session.audio_inbox:
                        continue
                    
                    pcm_data = bytes(self.session.audio_inbox)
                    self.session.audio_inbox.clear()

                await dg_ws.send(pcm_data)
        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[{self.session.session_id}] Deepgram WebSocket closed (sender)")
        except Exception as e:
            logger.error(f"[{self.session.session_id}] Error in send_audio: {e}")

    async def receive_results(self, dg_ws):
        """Handle transcripts and metrics returned by Deepgram."""
        try:
            async for message in dg_ws:
                data = json.loads(message)
                
                if data.get("type") == "Results":
                    is_final = data.get("is_final", False)
                    # We process final results for highest accuracy, but could use interim for lower latency
                    if not is_final:
                        continue
                        
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
                            "start": w["start"]
                        }
                        for w in words
                    ]
                    
                    # Extract speaker from first word if diarized
                    # Deepgram speaker labels are integers (0, 1, 2...)
                    speaker_id = str(words[0].get("speaker", "0"))
                    
                    if self.on_tokens_callback:
                        # Use call_soon or similar if blocking, but process_tokens is async
                        # We use create_task to ensure we don't block the receiver loop
                        asyncio.create_task(self.on_tokens_callback(formatted_tokens, speaker_id=speaker_id))

                    # Log transcript segment
                    transcript_text = alt.get("transcript", "").strip()
                    if transcript_text:
                        logger.info(f"[{self.session.session_id}][DG][{speaker_id}] {transcript_text}")

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[{self.session.session_id}] Deepgram WebSocket closed (receiver)")
        except Exception as e:
            logger.error(f"[{self.session.session_id}] Error in receive_results: {e}")

    async def telemetry_loop(self):
        """Report buffer status and latency metrics to client."""
        while True:
            await asyncio.sleep(5)
            try:
                with self.session.audio_inbox_lock:
                    inbox_ms = int(len(self.session.audio_inbox) / (16000 * 2) * 1000)

                await self.session.websocket.send(
                    json.dumps(
                        {
                            "type": "telemetry",
                            "buffer_ms": inbox_ms,
                            "dg_stream": "active"
                        }
                    )
                )
            except Exception:
                break
