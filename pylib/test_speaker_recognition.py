import asyncio
import numpy as np
import librosa
from pylib.speaker_recognition import SpeakerRecognizer
import logging
import sys

# Configure logging to see output
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

async def test_speaker_recognition():
    recognizer = SpeakerRecognizer(device="cpu")
    
    # Load references
    recognizer.load_reference("jeff")
    recognizer.load_reference("rubio")
    
    print("\n--- Testing 'jeff' samples ---")
    audio_jeff, _ = librosa.load("audio-samples/jeff.wav", sr=16000)
    # Take a 1.5s chunk (matching CHUNK_SECS in server.py)
    chunk_size = int(1.5 * 16000 * 2) # bytes
    # Convert audio to PCM bytes for verify_speaker
    pcm_jeff = (audio_jeff[16000:16000+24000] * 32768).astype(np.int16).tobytes()
    
    sim_jeff_jeff = await recognizer.verify_speaker(pcm_jeff, "jeff")
    sim_jeff_rubio = await recognizer.verify_speaker(pcm_jeff, "rubio")
    
    print(f"Jeff sample vs Jeff profile: {sim_jeff_jeff:.4f}")
    print(f"Jeff sample vs Rubio profile: {sim_jeff_rubio:.4f}")
    
    print("\n--- Testing 'rubio' samples ---")
    audio_rubio, _ = librosa.load("audio-samples/rubio.wav", sr=16000)
    pcm_rubio = (audio_rubio[16000:16000+24000] * 32768).astype(np.int16).tobytes()
    
    sim_rubio_jeff = await recognizer.verify_speaker(pcm_rubio, "jeff")
    sim_rubio_rubio = await recognizer.verify_speaker(pcm_rubio, "rubio")
    
    print(f"Rubio sample vs Jeff profile: {sim_rubio_jeff:.4f}")
    print(f"Rubio sample vs Rubio profile: {sim_rubio_rubio:.4f}")

    if sim_jeff_jeff > sim_jeff_rubio and sim_rubio_rubio > sim_rubio_jeff:
        print("\nSUCCESS: Speaker recognition correctly distinguished between Jeff and Rubio!")
    else:
        print("\nFAILURE: Speaker recognition failed to distinguish correctly.")

if __name__ == "__main__":
    asyncio.run(test_speaker_recognition())
