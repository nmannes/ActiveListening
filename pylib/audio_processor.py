import asyncio
import json
import logging
import time
import numpy as np
import websockets
from pathlib import Path

logger = logging.getLogger("remote_server")
transcript_logger = logging.getLogger("transcript")

class AudioProcessor:
    def __init__(self, session, on_tokens_callback=None):
        self.session = session
        self.on_tokens_callback = on_tokens_callback
        self.audio_buffer = b""
        self.speech_buffer = b""
        self.preroll_buffer = b""
        self.in_speech = False
        self.last_speech_time = 0
        self.speech_start_time = 0
        self.last_transcription_time = 0
        self.committed_tokens = []
        
        # VAD-based transcription parameters (Optimized for Real-Time)
        self.VAD_WINDOW_SECS = 0.1
        self.VAD_WINDOW_BYTES = int(self.VAD_WINDOW_SECS * 16000 * 2)
        self.SILENCE_TIMEOUT_SECS = 0.1  # Aggressive: transcribe after 100ms pause
        self.MAX_SEGMENT_SECS = 1.5      # Aggressive: force transcription after 1.5s
        self.PREROLL_SECS = 0.6          # Retain preroll padding
        self.PREROLL_BYTES = int(self.PREROLL_SECS * 16000 * 2)
        self.MIN_STREAM_INTERVAL_SECS = 0.1

    async def run(self):
        self.session.transcript.clear()
        self.committed_tokens.clear()
        
        logger.info(
            f"[{self.session.session_id}] Audio processing loop started (Device: {self.session.server.transcriber.device}, voiceProfile: {self.session.voice_profile})"
        )

        telemetry_task = asyncio.create_task(self.telemetry_loop())

        try:
            while True:
                await asyncio.sleep(0.01)

                with self.session.audio_inbox_lock:
                    if not self.session.audio_inbox:
                        continue
                    
                    # Capping inbox to prevent runaway buildup (increased to 30s)
                    max_inbox_bytes = 16000 * 2 * 30
                    if len(self.session.audio_inbox) > max_inbox_bytes:
                        del self.session.audio_inbox[:len(self.session.audio_inbox) - max_inbox_bytes]
                    
                    pcm_data = bytes(self.session.audio_inbox)
                    self.session.audio_inbox.clear()

                self.audio_buffer += pcm_data

                # Process VAD in windows
                while len(self.audio_buffer) >= self.VAD_WINDOW_BYTES:
                    chunk = self.audio_buffer[:self.VAD_WINDOW_BYTES]
                    self.audio_buffer = self.audio_buffer[self.VAD_WINDOW_BYTES:]
                    
                    samples = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
                    
                    t0_vad = time.time()
                    is_speech = await asyncio.get_running_loop().run_in_executor(
                        self.session.server.vad_executor, self.session.server.vad.is_speech, samples
                    )
                    t1_vad = time.time()
                    
                    now = time.time()
                    if t1_vad - t0_vad > 0.1:
                        logger.debug(f"[{self.session.session_id}] VAD took {t1_vad - t0_vad:.3f}s")

                    if is_speech:
                        await self.handle_speech_onset(chunk, now)
                    else:
                        await self.handle_speech_offset(chunk, now)

                    # Force transcription if a very long segment is active
                    if self.in_speech and (now - self.speech_start_time) >= self.MAX_SEGMENT_SECS:
                        await self.force_intermediate_transcription(now)

        except asyncio.CancelledError:
            logger.info(f"[{self.session.session_id}] Audio processing loop cancelled")
        except Exception as e:
            logger.exception(f"[{self.session.session_id}] Unexpected error in AudioProcessor: {e}")
        finally:
            telemetry_task.cancel()

    async def handle_speech_onset(self, chunk, now):
        if not self.in_speech:
            logger.info(f"[{self.session.session_id}] Speech onset detected")
            self.in_speech = True
            self.speech_start_time = now
            self.last_transcription_time = now
            self.committed_tokens.clear()
            # Start with a bit of pre-roll
            self.speech_buffer = self.preroll_buffer + chunk
        else:
            self.speech_buffer += chunk
        self.last_speech_time = now

        if now - self.last_transcription_time >= self.MIN_STREAM_INTERVAL_SECS:
            t0_audio = now
            text = await self.session.server.transcriber.transcribe_raw(self.speech_buffer)
            self.session.last_proc_time[0] = time.time() - t0_audio
            self.last_transcription_time = time.time()
            await self.emit_new_tokens(text)

    async def handle_speech_offset(self, chunk, now):
        if self.in_speech:
            self.speech_buffer += chunk
            # Check for silence timeout or max duration
            duration = now - self.speech_start_time
            silence_duration = now - self.last_speech_time
            
            if silence_duration >= self.SILENCE_TIMEOUT_SECS or duration >= self.MAX_SEGMENT_SECS:
                logger.info(f"[{self.session.session_id}] Speech offset detected (duration: {duration:.2f}s)")
                
                t0_audio = now
                text = await self.session.server.transcriber.transcribe_raw(self.speech_buffer)
                self.session.last_proc_time[0] = time.time() - t0_audio
                
                # If voice profile is active, verify speaker on the speech segment
                if self.session.voice_profile:
                    if await self.verify_speaker(now):
                        await self.emit_new_tokens(text, speaker_id=self.session.voice_profile)
                else:
                    await self.emit_new_tokens(text)
                
                self.speech_buffer = b""
                self.in_speech = False
                self.preroll_buffer = chunk
                self.committed_tokens.clear()
        else:
            # Keep a bit of pre-roll in the buffer
            self.preroll_buffer += chunk
            if len(self.preroll_buffer) > self.PREROLL_BYTES:
                self.preroll_buffer = self.preroll_buffer[-self.PREROLL_BYTES:]

    async def verify_speaker(self, now):
        t0_speaker = time.time()
        similarity = await self.session.server.speaker_recognizer.verify_speaker(
            self.speech_buffer, self.session.voice_profile
        )
        t1_speaker = time.time()
        logger.info(
            f"[{self.session.session_id}][SPEAKER] Profile '{self.session.voice_profile}' similarity: {similarity:.4f} (took {t1_speaker - t0_speaker:.4f}s)"
        )

        # Notify client of speaker match result
        try:
            await self.session.websocket.send(
                json.dumps(
                    {
                        "type": "speaker_match",
                        "profile": self.session.voice_profile,
                        "similarity": similarity,
                    }
                )
            )
        except websockets.exceptions.ConnectionClosed:
            pass

        if similarity < 0.8:
            logger.info(
                f"[{self.session.session_id}][SPEAKER] Skipping trade: speaker similarity {similarity:.4f} below threshold 0.8"
            )
            self.speech_buffer = b""
            self.in_speech = False
            self.preroll_buffer = b"" # Reset as we shouldn't continue from here easily
            self.committed_tokens.clear()
            return False
        return True

    async def force_intermediate_transcription(self, now):
        logger.info(f"[{self.session.session_id}] Segment limit reached, forcing intermediate transcription")
        t0_audio = now
        text = await self.session.server.transcriber.transcribe_raw(self.speech_buffer)
        self.session.last_proc_time[0] = time.time() - t0_audio
        await self.emit_new_tokens(text)

        # For continuation, keep the last bit of audio as preroll
        self.preroll_buffer = self.speech_buffer[-self.PREROLL_BYTES:] if len(self.speech_buffer) > self.PREROLL_BYTES else self.speech_buffer
        self.speech_buffer = b""
        self.in_speech = False
        self.committed_tokens.clear()

    async def emit_new_tokens(self, text, speaker_id=None):
        raw_tokens = [self.session.punct_re.sub("", w).lower() for w in text.split() if self.session.punct_re.sub("", w).lower()]
        match_idx = 0
        for i in range(min(len(self.committed_tokens), len(raw_tokens))):
            if self.committed_tokens[i] == raw_tokens[i]:
                match_idx = i + 1
            else:
                break
        emit_start = max(match_idx, len(self.committed_tokens))
        new_tokens = raw_tokens[emit_start:]
        
        if new_tokens:
            self.committed_tokens.extend(new_tokens)
            if self.on_tokens_callback:
                asyncio.create_task(self.on_tokens_callback(new_tokens, speaker_id=speaker_id))


    async def telemetry_loop(self):
        while True:
            await asyncio.sleep(5)
            try:
                # Audio buffer backlog in ms
                # This needs to access audio_buffer from the outer scope, but it's now an instance var
                with self.session.audio_inbox_lock:
                    inbox_ms = int(len(self.session.audio_inbox) / (16000 * 2) * 1000)
                buffer_ms = int(len(self.audio_buffer) / (16000 * 2) * 1000)

                await self.session.websocket.send(
                    json.dumps(
                        {
                            "type": "telemetry",
                            "buffer_ms": inbox_ms + buffer_ms,
                            "last_proc_ms": int(self.session.last_proc_time[0] * 1000),
                        }
                    )
                )
            except Exception:
                break
