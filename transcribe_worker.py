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

    while True:
        try:
            # Block until we get `step_bytes` of new audio
            chunk = stdin.read(step_bytes)
            if not chunk:
                return  # EOF

            audio_buffer += chunk

            # Keep only the last 3.0 seconds
            if len(audio_buffer) > window_bytes:
                audio_buffer = audio_buffer[-window_bytes:]

            # Only transcribe if we have a full buffer (or mostly full to start)
            if len(audio_buffer) >= step_bytes:
                # Convert 16-bit signed LE PCM to float32 numpy array
                samples = np.frombuffer(audio_buffer, dtype=np.int16).astype(np.float32) / 32768.0

                # Transcribe
                # We use condition_on_previous_text=False to force it to treat the window independently
                segments, _info = model.transcribe(
                    samples, 
                    beam_size=1, 
                    language="en", 
                    vad_filter=False, 
                    condition_on_previous_text=False,
                    initial_prompt=None
                )
                text = " ".join(seg.text.strip() for seg in segments).strip()

                # Send partial/window result as JSON line
                sys.stdout.write(json.dumps({"text": text}) + "\n")
                sys.stdout.flush()

        except Exception as e:
            sys.stderr.write(f"[transcribe_worker] Error: {e}\n")
            sys.stderr.flush()
            # Send empty so JS doesn't hang
            sys.stdout.write(json.dumps({"text": ""}) + "\n")
            sys.stdout.flush()



if __name__ == "__main__":
    main()
