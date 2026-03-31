import asyncio
import threading
from server import ClientSession

async def test_lock():
    session = ClientSession(None, None)
    with session.audio_inbox_lock:
        session.audio_inbox.extend(b"test")
    print("Lock verified successfully!")

if __name__ == "__main__":
    asyncio.run(test_lock())
