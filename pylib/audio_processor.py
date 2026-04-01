import asyncio
import json
import logging
import os
import time
from datetime import datetime
import wave
import websockets
import numpy as np
from pathlib import Path
from pylib.telegram import send_telegram

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

        # Audio recording
        self._pcm_buffer = bytearray()       # all PCM sent, for slicing by timestamp
        self._speaker_wav_files = {}         # {speaker_id: wave.Wave_write}
        self._recordings_dir = None
        self._audio_dir = None
        self._dg_dir = None
        self._wav_file = None

        # Performance counters
        self.total_bytes_sent = 0
        self.total_results_received = 0
        self.last_stats_time = time.time()

    async def run(self):
        async with self.session.transcript_lock:
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

        # Set up recording directories
        timestamp_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        self._recordings_dir = Path(__file__).parent.parent / "recordings" / f"{self.session.session_id}_{timestamp_str}"
        self._recordings_dir.mkdir(parents=True, exist_ok=True)
        self._audio_dir = self._recordings_dir / "audio"
        self._audio_dir.mkdir(parents=True, exist_ok=True)
        self._dg_dir = self._recordings_dir / "deepgram_responses"
        self._dg_dir.mkdir(parents=True, exist_ok=True)
        
        # Full raw audio WAV
        wav_path = self._audio_dir / "full.wav"
        self._wav_file = wave.open(str(wav_path), "wb")
        self._wav_file.setnchannels(1)
        self._wav_file.setsampwidth(2)  # 16-bit
        self._wav_file.setframerate(16000)
        self._pcm_buffer.clear()
        logger.info(f"[{self.session.session_id}] Recording audio to {self._recordings_dir}")

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
        finally:
            if self._wav_file:
                self._wav_file.close()
            for sid, wf in self._speaker_wav_files.items():
                wf.close()
            
            # Save transcript alongside recordings
            if self._audio_dir:
                transcript_path = self._audio_dir / "transcript.json"
                transcript_data = dict(self.session.transcript)
                with open(transcript_path, "w") as f:
                    json.dump(transcript_data, f, indent=2)

            logger.info(f"[{self.session.session_id}] Audio recordings saved to {self._recordings_dir}")

            # Upload to S3 in background
            asyncio.get_running_loop().run_in_executor(None, self._upload_to_s3)

    async def send_audio(self, dg_ws):
        """Stream PCM audio data from session inbox to Deepgram."""
        logger.info(f"[{self.session.session_id}][AUDIO_SENDER] Task started")
        try:
            while True:
                await asyncio.sleep(0.01)

                with self.session.audio_inbox_lock:
                    if not self.session.audio_inbox:
                        continue
                    
                    pcm_data = bytes(self.session.audio_inbox)
                    self.session.audio_inbox.clear()

                # Chunking: send in 32KB pieces (approx 1s of audio) 
                # to avoid massive WebSocket frames and allow event loop to breathe
                chunk_len = 32000
                for i in range(0, len(pcm_data), chunk_len):
                    chunk = pcm_data[i : i + chunk_len]
                    
                    self.total_bytes_sent += len(chunk)
                    self._pcm_buffer.extend(chunk)
                    
                    # Record audio to WAV file
                    if self._wav_file:
                        self._wav_file.writeframes(chunk)

                    # Send to Deepgram with a timeout to prevent permanent hangs
                    try:
                        await asyncio.wait_for(dg_ws.send(chunk), timeout=2.0)
                    except asyncio.TimeoutError:
                        logger.error(f"[{self.session.session_id}][AUDIO_SENDER] Timeout sending {len(chunk)} bytes to Deepgram")
                        raise
                    except Exception as e:
                        logger.error(f"[{self.session.session_id}][AUDIO_SENDER] Error sending to Deepgram: {e}")
                        raise

                # Periodically log throughput (every 10s)
                now = time.time()
                if now - self.last_stats_time > 10:
                    kb_sent = self.total_bytes_sent / 1024
                    logger.info(f"[{self.session.session_id}][STATS] Sent {kb_sent:.2f} KB total")
                    self.last_stats_time = now

        except websockets.exceptions.ConnectionClosed:
            logger.info(f"[{self.session.session_id}][AUDIO_SENDER] Deepgram WebSocket closed")
        except asyncio.CancelledError:
            logger.info(f"[{self.session.session_id}][AUDIO_SENDER] Task cancelled")
        except Exception as e:
            logger.error(f"[{self.session.session_id}][AUDIO_SENDER] Fatal error: {e}")
            raise

    async def receive_results(self, dg_ws):
        """Handle transcripts and metrics returned by Deepgram."""
        logger.info(f"[{self.session.session_id}] Results receiver task started")
        
        # Ensure deepgram_responses directory exists
        resp_dir = self._dg_dir
        if resp_dir is None:
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
                    
                    # Extract per-speaker audio from PCM buffer
                    self._write_speaker_audio(speaker_id, words[0]["start"], words[-1]["end"])

                    if self.on_tokens_callback:
                        await self.on_tokens_callback(formatted_tokens, speaker_id=speaker_id)

                    # Log transcript segment
                    transcript_text = alt.get("transcript", "").strip()
                    if transcript_text:
                        logger.info(f"[{self.session.session_id}][DG][{speaker_id}] {transcript_text}")
                        msg_text = f"[{self.session.session_id}][DG][{speaker_id}] {transcript_text}"
                        asyncio.get_running_loop().run_in_executor(
                            None,
                            send_telegram,
                            msg_text,
                            "debug"
                        )
                        
                
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

    def _write_speaker_audio(self, speaker_id, start_time, end_time):
        """Extract audio slice from PCM buffer and append to speaker's WAV file."""
        # 16kHz * 2 bytes per sample = 32000 bytes per second
        bytes_per_sec = 16000 * 2
        start_byte = int(start_time * bytes_per_sec)
        end_byte = int(end_time * bytes_per_sec)

        buf_len = len(self._pcm_buffer)
        if start_byte >= buf_len:
            return  # audio not in buffer yet
        end_byte = min(end_byte, buf_len)
        if end_byte <= start_byte:
            return

        audio_slice = bytes(self._pcm_buffer[start_byte:end_byte])

        # Lazily open per-speaker WAV file
        if speaker_id not in self._speaker_wav_files:
            path = self._audio_dir / f"speaker_{speaker_id}.wav"
            wf = wave.open(str(path), "wb")
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            self._speaker_wav_files[speaker_id] = wf
            logger.info(f"[{self.session.session_id}] Opened speaker WAV: {path}")

        self._speaker_wav_files[speaker_id].writeframes(audio_slice)

    def _upload_to_s3(self):
        """Upload the recordings directory to S3."""
        # 16000 Hz * 2 bytes/sample * 60 seconds = 1920000 bytes
        if len(self._pcm_buffer) < 1920000:
            logger.info(f"[{self.session.session_id}] Less than 1 minute of audio ({len(self._pcm_buffer)} bytes), skipping S3 upload & deleting local files")
            if self._recordings_dir and self._recordings_dir.exists():
                import shutil
                shutil.rmtree(self._recordings_dir, ignore_errors=True)
            return

        bucket = os.environ.get("S3_BUCKET", "recordings-846345203908-us-east-1-an")
        if not self._recordings_dir or not self._recordings_dir.exists():
            return

        try:
            import boto3
            s3 = boto3.client("s3")
            prefix = self._recordings_dir.name  # e.g. session-id_1711640123

            for sub_dir in ["audio", "deepgram_responses"]:
                dir_path = self._recordings_dir / sub_dir
                if dir_path.exists():
                    for file_path in dir_path.iterdir():
                        if file_path.is_file():
                            s3_key = f"{prefix}/{sub_dir}/{file_path.name}"
                            logger.info(f"[{self.session.session_id}] Uploading {file_path.name} to s3://{bucket}/{s3_key}")
                            s3.upload_file(str(file_path), bucket, s3_key)

            logger.info(f"[{self.session.session_id}] S3 upload complete: s3://{bucket}/{prefix}/")
        except Exception as e:
            logger.error(f"[{self.session.session_id}] S3 upload failed: {e}")

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
