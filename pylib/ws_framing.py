"""ws_framing.py — client→server binary frame layouts.

Audio is the fallback type, so the magic-prefixed types must be checked
before it: a GIF reply fed to Deepgram as PCM would corrupt the transcription
stream.  Stdlib-only so the classification is unit-testable in CI without
importing the full server.
"""

FRAME_MAGIC = b"\x01\xff\xd8"          # 0x01 + JPEG SOI
GIF_MAGIC = b"\x02GIF1"                # 0x02 + "GIF1" + u32 req_id (big-endian)


def classify_binary(message: bytes) -> str:
    """Classify a client binary message: 'frame' | 'gif' | 'audio'."""
    if len(message) > 3 and message[:3] == FRAME_MAGIC:
        return "frame"
    if len(message) > 9 and message[:5] == GIF_MAGIC:
        return "gif"
    return "audio"


def parse_gif_message(message: bytes):
    """Parse a GIF reply: (req_id, gif_bytes), or (None, b'') when malformed."""
    if len(message) < 10 or message[:5] != GIF_MAGIC:
        return None, b""
    req_id = int.from_bytes(message[5:9], "big")
    return req_id, message[9:]
