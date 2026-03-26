import asyncio
import json
import logging
import time
import re
from typing import List, Dict, Any, Optional, Callable, Awaitable

import numpy as np
import websockets
from websockets.server import WebSocketServerProtocol
from concurrent.futures import ThreadPoolExecutor

from pylib.transcriber import Transcriber
from pylib.vad import VoiceActivityDetector
from pylib.speaker_recognition import SpeakerRecognizer
from pylib.token_processor import TokenProcessor

logger = logging.getLogger("remote_server")

class AudioProcessor:
    def __init__(
        self, 
        session_id: str, 
        websocket: WebSocketServerProtocol, 
        transcriber: Transcriber, 
        vad: VoiceActivityDetector, 
        vad_executor: ThreadPoolExecutor, 
        speaker_recognizer: SpeakerRecognizer, 
        voice_profile: Optional[str], 
        token_processor: TokenProcessor, 
        get_content_visible_cb: Callable[[], bool]
    ):
        self.session_id = session_id
        self.websocket = websocket
        self.transcriber = transcriber
        self.vad = vad
        self.vad_executor = vad_executor
        self.speaker_recognizer = speaker_recognizer
        self.voice_profile = voice_profile
        self.token_processor = token_processor
        self.get_content_visible_cb = get_content_visible_cb
        
        self.last_proc_time = [0.0]
        self.punct_re = re.compile(r'[!"#$%&\'()*+,\-./:;<=>?@\[\]^_`{|}~]')
        
        # Audio processing constants
        self.VAD_WINDOW_SECS = 0.1
        self.VAD_WINDOW_BYTES = int(self.VAD_WINDOW_SECS * 16000 * 2)
        self.SILENCE_TIMEOUT_SECS = 0.1
        self.MAX_SEGMENT_SECS = 1.5
        self.PREROLL_SECS = 0.6
        self.PREROLL_BYTES = int(self.PREROLL_SECS * 16000 * 2)
        self.MIN_STREAM_INTERVAL_SECS = 0.1

    async def telemetry_loop(self, audio_inbox: bytearray, audio_inbox_lock: Any, audio_buffer: bytes) -> None:
        while True:
            await asyncio.sleep(5)
            try:
                with audio_inbox_lock:
                    inbox_ms = int(len(audio_inbox) / (16000 * 2) * 1000)
                buffer_ms = int(len(audio_buffer) / (16000 * 2) * 1000)

                await self.websocket.send(
                    json.dumps({
                        "type": "telemetry",
                        "buffer_ms": inbox_ms + buffer_ms,
                        "last_proc_ms": int(self.last_proc_time[0] * 1000),
                    })
                )
            except Exception:
                break

    async def run(self, audio_inbox: bytearray, audio_inbox_lock: Any) -> None:
        logger.info(f"[{self.session_id}] Audio processing loop started (Device: {self.transcriber.device}, voiceProfile: {self.voice_profile})")
        
        committed_tokens: List[str] = []
        audio_buffer = b""
        speech_buffer = b""
        preroll_buffer = b""
        in_speech = False
        last_speech_time = 0.0
        speech_start_time = 0.0
        last_transcription_time = 0.0

        telemetry_task = asyncio.create_task(self.telemetry_loop(audio_inbox, audio_inbox_lock, audio_buffer))

        try:
            while True:
                await asyncio.sleep(0.01)

                with audio_inbox_lock:
                    if not audio_inbox:
                        continue
                    
                    max_inbox_bytes = 16000 * 2 * 30
                    if len(audio_inbox) > max_inbox_bytes:
                        del audio_inbox[:len(audio_inbox) - max_inbox_bytes]
                    
                    pcm_data = bytes(audio_inbox)
                    audio_inbox.clear()

                audio_buffer += pcm_data

                while len(audio_buffer) >= self.VAD_WINDOW_BYTES:
                    chunk = audio_buffer[:self.VAD_WINDOW_BYTES]
                    audio_buffer = audio_buffer[self.VAD_WINDOW_BYTES:]
                    
                    samples = np.frombuffer(chunk, dtype=np.int16).astype(np.float32) / 32768.0
                    
                    t0_vad = time.time()
                    is_speech = await asyncio.get_running_loop().run_in_executor(
                        self.vad_executor, self.vad.is_speech, samples
                    )
                    t1_vad = time.time()
                    
                    now = time.time()
                    if t1_vad - t0_vad > 0.1:
                        logger.debug(f"[{self.session_id}] VAD took {t1_vad - t0_vad:.3f}s")

                    if is_speech:
                        if not in_speech:
                            logger.info(f"[{self.session_id}] Speech onset detected")
                            in_speech = True
                            speech_start_time = now
                            last_transcription_time = now
                            committed_tokens.clear()
                            speech_buffer = preroll_buffer + chunk
                        else:
                            speech_buffer += chunk
                        last_speech_time = now

                        if now - last_transcription_time >= self.MIN_STREAM_INTERVAL_SECS:
                            t0_audio = now
                            text = await self.transcriber.transcribe_raw(speech_buffer)
                            self.last_proc_time[0] = time.time() - t0_audio
                            last_transcription_time = time.time()
                            
                            new_t = self._extract_new_tokens(text, committed_tokens)
                            if new_t:
                                committed_tokens.extend(new_t)
                                await self.token_processor.process_tokens(new_t, self.get_content_visible_cb())
                    else:
                        if in_speech:
                            speech_buffer += chunk
                            duration = now - speech_start_time
                            silence_duration = now - last_speech_time
                            
                            if silence_duration >= self.SILENCE_TIMEOUT_SECS or duration >= self.MAX_SEGMENT_SECS:
                                logger.info(f"[{self.session_id}] Speech offset detected (duration: {duration:.2f}s)")
                                
                                t0_audio = now
                                text = await self.transcriber.transcribe_raw(speech_buffer)
                                self.last_proc_time[0] = time.time() - t0_audio
                                
                                if self.voice_profile:
                                    if not await self._verify_speaker(speech_buffer):
                                        speech_buffer = b""
                                        in_speech = False
                                        preroll_buffer = chunk
                                        committed_tokens.clear()
                                        continue

                                new_t = self._extract_new_tokens(text, committed_tokens)
                                if new_t:
                                    committed_tokens.extend(new_t)
                                    await self.token_processor.process_tokens(new_t, self.get_content_visible_cb())
                                
                                speech_buffer = b""
                                in_speech = False
                                preroll_buffer = chunk
                                committed_tokens.clear()
                        else:
                            preroll_buffer += chunk
                            if len(preroll_buffer) > self.PREROLL_BYTES:
                                preroll_buffer = preroll_buffer[-self.PREROLL_BYTES:]

                    if in_speech and (now - speech_start_time) >= self.MAX_SEGMENT_SECS:
                        logger.info(f"[{self.session_id}] Segment limit reached, forcing intermediate transcription")
                        t0_audio = now
                        text = await self.transcriber.transcribe_raw(speech_buffer)
                        self.last_proc_time[0] = time.time() - t0_audio
                        
                        new_t = self._extract_new_tokens(text, committed_tokens)
                        if new_t:
                            committed_tokens.extend(new_t)
                            await self.token_processor.process_tokens(new_t, self.get_content_visible_cb())

                        preroll_buffer = speech_buffer[-self.PREROLL_BYTES:] if len(speech_buffer) > self.PREROLL_BYTES else speech_buffer
                        speech_buffer = b""
                        in_speech = False
                        committed_tokens.clear()

        except asyncio.CancelledError:
            logger.info(f"[{self.session_id}] Audio processing loop cancelled")
        except Exception as e:
            logger.exception(f"[{self.session_id}] Unexpected error in AudioProcessor: {e}")
        finally:
            telemetry_task.cancel()

    def _extract_new_tokens(self, text: str, committed_tokens: List[str]) -> List[str]:
        raw_tokens = [self.punct_re.sub("", w).lower() for w in text.split() if self.punct_re.sub("", w).lower()]
        match_idx = 0
        for i in range(min(len(committed_tokens), len(raw_tokens))):
            if committed_tokens[i] == raw_tokens[i]:
                match_idx = i + 1
            else:
                break
        emit_start = max(match_idx, len(committed_tokens))
        return raw_tokens[emit_start:]

    async def _verify_speaker(self, speech_buffer: bytes) -> bool:
        t0_speaker = time.time()
        similarity = await self.speaker_recognizer.verify_speaker(speech_buffer, self.voice_profile)
        t1_speaker = time.time()
        logger.info(f"[{self.session_id}][SPEAKER] Profile '{self.voice_profile}' similarity: {similarity:.4f} (took {t1_speaker - t0_speaker:.4f}s)")

        try:
            await self.websocket.send(json.dumps({
                "type": "speaker_match",
                "profile": self.voice_profile,
                "similarity": similarity,
            }))
        except websockets.exceptions.ConnectionClosed:
            pass

        if similarity < 0.8:
            logger.info(f"[{self.session_id}][SPEAKER] Skipping trade: speaker similarity {similarity:.4f} below threshold 0.8")
            return False
        return True
