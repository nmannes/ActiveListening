import asyncio
import websockets
import json
import wave
import time

async def stream_audio():
    async with websockets.connect('ws://localhost:8090') as websocket:
        # Send hello
        await websocket.send(json.dumps({
            "type": "hello",
            "market": {
                "title": "Test Streaming Model",
                "slug": "test-stream",
                "keywords": {"test": "TICKER", "transcription": "TICKER"}
            },
            "audioOnly": True
        }))
        
        # Stream audio
        with wave.open('test_audio.wav', 'rb') as wf:
            print(f"Sample width: {wf.getsampwidth()}, Rate: {wf.getframerate()}, Channels: {wf.getnchannels()}")
            chunk_size = 16000 * 2 // 10 # 0.1s of audio = 3200 bytes
            
            # Start a receiver task
            async def receive():
                try:
                    while True:
                        msg = await websocket.recv()
                        print(f"SERVER: {msg}")
                except Exception as e:
                    print(f"Recv error: {e}")
            
            asyncio.create_task(receive())
                        
            while True:
                data = wf.readframes(1600) # 1600 frames = 3200 bytes
                if not data:
                    break
                await websocket.send(data)
                await asyncio.sleep(0.1)
                
            print("Finished streaming audio.")
            await asyncio.sleep(5)

asyncio.run(stream_audio())
