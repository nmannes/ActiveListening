import asyncio
import os
import sys
import wave
import numpy as np

# Add parent dir to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from pylib.nemo_transcriber import NemoTranscriber
from pylib.log_config import setup_logging
setup_logging()

async def main():
    if len(sys.argv) < 2:
        print("Usage: python3 pylib/test_nemo_transcriber.py <wav_file>")
        return

    wav_path = sys.argv[1]
    if not os.path.exists(wav_path):
        print(f"File not found: {wav_path}")
        return

    device = "cuda" if os.environ.get("DEVICE") == "cuda" else "cpu"
    print(f"Initializing NemoTranscriber on {device}...")
    transcriber = NemoTranscriber(device=device)

    print(f"Reading {wav_path}...")
    with wave.open(wav_path, "rb") as wf:
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2 or wf.getframerate() != 16000:
            print("Error: Audio must be 16kHz, mono, 16-bit PCM.")
            # Actually, let's just use it if it's there but warn
            if wf.getframerate() != 16000:
                 print(f"WARNING: Sample rate is {wf.getframerate()}, NeMo expects 16000.")
        
        pcm_data = wf.readframes(wf.getnframes())

    print("Transcribing...")
    t0 = asyncio.get_event_loop().time()
    text = await transcriber.transcribe_raw(pcm_data)
    t1 = asyncio.get_event_loop().time()

    print(f"\n--- Result ({t1 - t0:.2f}s) ---")
    print(text)
    print("----------------------------")

if __name__ == "__main__":
    asyncio.run(main())
