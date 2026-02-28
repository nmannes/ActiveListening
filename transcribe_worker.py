#!/usr/bin/env python3
"""
Persistent transcription worker using faster-whisper.

Protocol (WebSocket):
  Node -> Python:  Binary PCM frames (16-bit signed LE, 16kHz, mono)
  Python -> Node:  '{"text": "..."}' per transcription result (text message)

The worker starts a WebSocket server on the given --port, prints "READY <port>"
to stdout, and then waits for a single client connection from server.js.
"""

import sys
import json
import numpy as np
from faster_whisper import WhisperModel
import argparse
import asyncio
import websockets
import time
from concurrent.futures import ThreadPoolExecutor


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="base.en")
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--port", type=int, default=8089)
    args = parser.parse_args()

    model_size = args.model
    device = args.device
    port = args.port
    compute_type = "float16" if device == "cuda" else "int8"

    sys.stderr.write(f"[transcribe_worker] Loading model '{model_size}' on {device} ({compute_type})...\n")
    sys.stderr.flush()

    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    sys.stderr.write(f"[transcribe_worker] Model loaded.\n")
    sys.stderr.flush()

    # Thread pool for running CPU-bound transcription without blocking the event loop
    executor = ThreadPoolExecutor(max_workers=1)

    # Sliding window config
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2
    WINDOW_SECS = 3.0
    STEP_SECS = 0.3

    window_bytes = int(WINDOW_SECS * SAMPLE_RATE * BYTES_PER_SAMPLE)
    step_bytes = int(STEP_SECS * SAMPLE_RATE * BYTES_PER_SAMPLE)

    def transcribe_sync(samples):
        """Run transcription synchronously — called from executor thread."""
        segments, _info = model.transcribe(
            samples,
            beam_size=1,
            language="en",
            vad_filter=False,
            condition_on_previous_text=False,
            initial_prompt=None
        )
        return " ".join(seg.text.strip() for seg in segments).strip()

    async def handle_client(websocket):
        sys.stderr.write(f"[transcribe_worker] Client connected.\n")
        sys.stderr.flush()

        audio_buffer = b""
        incoming = b""
        loop = asyncio.get_event_loop()

        async for message in websocket:
            # Only accept binary messages (PCM audio)
            if isinstance(message, str):
                continue

            incoming += message

            # Process in step_bytes-sized chunks
            while len(incoming) >= step_bytes:
                process_chunk = incoming[:step_bytes]
                incoming = incoming[step_bytes:]

                audio_buffer += process_chunk

                # Keep only the last WINDOW_SECS seconds
                if len(audio_buffer) > window_bytes:
                    audio_buffer = audio_buffer[-window_bytes:]

                # Ensure even number of bytes for int16 parsing
                safe_length = len(audio_buffer) - (len(audio_buffer) % 2)
                if safe_length == 0:
                    continue

                # Convert 16-bit signed LE PCM to float32 numpy array
                samples = np.frombuffer(audio_buffer[:safe_length], dtype=np.int16).astype(np.float32) / 32768.0

                # Silence check: Whisper hallucinates on pure silence
                rms = np.sqrt(np.mean(samples**2))
                if rms < 0.005:
                    await websocket.send('{"text": ""}')
                    continue

                # Transcribe in thread pool so we don't block the event loop
                t0 = time.time()
                text = await loop.run_in_executor(executor, transcribe_sync, samples)
                t1 = time.time()

                if t1 - t0 > 0.3:
                    sys.stderr.write(f"[transcribe_worker] WARNING: transcribe took {t1 - t0:.2f}s (>0.3s window)\n")
                    sys.stderr.flush()

                await websocket.send(json.dumps({"text": text}))

        sys.stderr.write(f"[transcribe_worker] Client disconnected.\n")
        sys.stderr.flush()

    async def serve():
        async with websockets.serve(handle_client, "127.0.0.1", port, ping_interval=None):
            # Signal readiness to server.js
            sys.stdout.write(f"READY {port}\n")
            sys.stdout.flush()
            sys.stderr.write(f"[transcribe_worker] WebSocket server listening on ws://127.0.0.1:{port}\n")
            sys.stderr.flush()
            await asyncio.Future()  # run forever

    asyncio.run(serve())


if __name__ == "__main__":
    main()
