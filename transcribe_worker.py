#!/usr/bin/env python3
"""
Persistent transcription worker using faster-whisper (GPU-accelerated).

Protocol (stdin/stdout):
  Node -> Python:  "AUDIO <num_bytes>\n" followed by <num_bytes> raw PCM bytes
                   (16-bit signed LE, 16kHz, mono)
  Python -> Node:  '{"text": "..."}\n' per transcription result

Env vars:
  WHISPER_MODEL  - model size (default: "base.en")
  WHISPER_DEVICE - "cuda" or "cpu" (default: "cuda")
"""

import sys
import os
import json
import numpy as np
from faster_whisper import WhisperModel
import argparse
import threading
import queue
import time # Added for time.time()

# Load environment variables from .env file
def main():

    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=str, default="base.en")
    parser.add_argument("--device", type=str, default="cpu")

    args = parser.parse_args()

    model_size = args.model
    device = args.device
    
    compute_type = "float16" if device == "cuda" else "int8"

    sys.stderr.write(f"[transcribe_worker] Loading model '{model_size}' on {device} ({compute_type})...\n")
    sys.stderr.flush()

    model = WhisperModel(model_size, device=device, compute_type=compute_type)

    sys.stderr.write(f"[transcribe_worker] Model loaded.\n")
    sys.stderr.flush()

    # Signal readiness to the parent process
    sys.stdout.write("READY\n")
    sys.stdout.flush()

    stdin = sys.stdin.buffer  # binary mode

    # Sliding window streaming config
    SAMPLE_RATE = 16000
    BYTES_PER_SAMPLE = 2
    WINDOW_SECS = 3.0           # 3-second rolling buffer
    STEP_SECS = 0.3             # process every 300ms of new audio
    
    window_bytes = int(WINDOW_SECS * SAMPLE_RATE * BYTES_PER_SAMPLE)
    step_bytes   = int(STEP_SECS * SAMPLE_RATE * BYTES_PER_SAMPLE)

    audio_buffer = b""
    q = queue.Queue()

    def reader_thread():
        # Continuously read from stdin in small chunks and push to queue
        while True:
            chunk = sys.stdin.buffer.read(4096)
            if not chunk:
                q.put(None) # EOF sentinel
                break
            q.put(chunk)

    t = threading.Thread(target=reader_thread, daemon=True)
    t.start()

    incoming = b""

    while True:
        try:
            # Accumulate exactly `step_bytes` safely from the queue
            while len(incoming) < step_bytes:
                try:
                    # Block briefly to wait for audio
                    chunk = q.get(timeout=0.5)
                    if chunk is None:
                        return # EOF
                    incoming += chunk
                except queue.Empty:
                    # No audio arrived in 0.5s, just break out to avoid infinite hang 
                    # and process whatever we have (or just wait on next iteration)
                    pass
                
            if not incoming:
                continue

            # Take exactly `step_bytes` from incoming
            process_chunk = incoming[:step_bytes]
            incoming = incoming[step_bytes:]
            
            audio_buffer += process_chunk

            # Keep only the last 3.0 seconds
            if len(audio_buffer) > window_bytes:
                audio_buffer = audio_buffer[-window_bytes:]

            # Ensure we have an even number of bytes for int16 parsing
            safe_length = len(audio_buffer) - (len(audio_buffer) % 2)
            if safe_length == 0:
                continue

            # Convert 16-bit signed LE PCM to float32 numpy array
            samples = np.frombuffer(audio_buffer[:safe_length], dtype=np.int16).astype(np.float32) / 32768.0

            # VAD / Silence Check: Whisper hallucinates or hangs on absolute silence
            rms = np.sqrt(np.mean(samples**2))
            if rms < 0.005:
                # Send empty result to unblock any JS listeners waiting for 1:1 chunk responses
                try:
                    print('{"text": ""}', flush=True)
                except:
                    pass
                continue

            # Transcribe
            # We use condition_on_previous_text=False to force it to treat the window independently
            t0 = time.time()
            segments, _info = model.transcribe(
                samples, 
                beam_size=1, 
                language="en", 
                vad_filter=False, 
                condition_on_previous_text=False,
                initial_prompt=None
            )
            t1 = time.time()
            text = " ".join(seg.text.strip() for seg in segments).strip()

            if t1 - t0 > 0.3:
                sys.stderr.write(f"[transcribe_worker] WARNING: transcribe took {t1 - t0:.2f}s (falling behind >0.3s window!)\n")
                sys.stderr.flush()

            # Send partial/window result as JSON line
            print(json.dumps({"text": text}), flush=True)

        except BrokenPipeError:
            # Node.js closed the pipe, exit cleanly
            sys.stderr.write("[transcribe_worker] BrokenPipeError: Node.js closed the pipe. Exiting.\n")
            break
        except Exception as e:
            sys.stderr.write(f"[transcribe_worker] Error: {e}\n")
            sys.stderr.flush()
            # Send empty so JS doesn't hang
            try:
                print(json.dumps({"text": ""}), flush=True)
            except:
                pass



if __name__ == "__main__":
    main()
