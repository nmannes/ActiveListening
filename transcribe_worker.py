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

    while True:
        try:
            # Read the header line (text): "AUDIO <num_bytes>\n"
            header = b""
            while True:
                byte = stdin.read(1)
                if not byte:
                    # EOF — parent closed stdin, exit gracefully
                    return
                if byte == b"\n":
                    break
                header += byte

            header_str = header.decode("utf-8").strip()
            if not header_str.startswith("AUDIO "):
                sys.stderr.write(f"[transcribe_worker] Unknown header: {header_str}\n")
                sys.stderr.flush()
                continue

            num_bytes = int(header_str.split(" ", 1)[1])

            # Read exactly num_bytes of raw PCM data
            pcm_data = b""
            remaining = num_bytes
            while remaining > 0:
                chunk = stdin.read(remaining)
                if not chunk:
                    return  # EOF
                pcm_data += chunk
                remaining -= len(chunk)

            # Convert 16-bit signed LE PCM to float32 numpy array
            samples = np.frombuffer(pcm_data, dtype=np.int16).astype(np.float32) / 32768.0

            # Transcribe
            segments, _info = model.transcribe(samples, beam_size=1, language="en", vad_filter=False)
            text = " ".join(seg.text.strip() for seg in segments).strip()

            # Send result as JSON line
            result = json.dumps({"text": text})
            sys.stdout.write(result + "\n")
            sys.stdout.flush()

        except Exception as e:
            sys.stderr.write(f"[transcribe_worker] Error: {e}\n")
            sys.stderr.flush()
            # Send empty result so Node doesn't hang waiting
            sys.stdout.write(json.dumps({"text": ""}) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
