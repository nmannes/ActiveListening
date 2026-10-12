import os
import sys
import io
import atexit
import logging
import requests
from dotenv import load_dotenv
import threading
from pathlib import Path

logger = logging.getLogger("remote_server")


def setup_env():
    # Find the --env flag like in the JS library
    env = "prod"
    for i, arg in enumerate(sys.argv):
        if arg == "--env" and i + 1 < len(sys.argv):
            env = sys.argv[i + 1]
        elif arg.startswith("--env="):
            env = arg.split("=")[1]

    # Load .env.[env]
    env_path = Path(__file__).parent.parent / f".env.{env}"
    load_dotenv(dotenv_path=env_path)


# Initialize environment
setup_env()

# Batching state for debug channel
_debug_buffer = []
_buffer_lock = threading.Lock()
_BATCH_SIZE = 10


def get_bot(channel="info"):
    is_debug = channel == "debug" or channel is True
    is_voice = channel == "voice"
    if is_voice:
        token = os.environ.get("TELEGRAM_KEY_VOICE_IDS", os.environ.get("TELEGRAM_KEY"))
    elif is_debug:
        token = os.environ.get("TELEGRAM_KEY_DEBUG")
    else:
        token = os.environ.get("TELEGRAM_KEY")
    chat_id = os.environ.get("TELEGRAM_MY_ID")

    if not token:
        print(
            f"Warning: Telegram token for {'debug' if is_debug else 'info'} channel not found."
        )

    return token, chat_id


def get_bot_info(channel="info"):
    token, _ = get_bot(channel)
    response = requests.get(f"https://api.telegram.org/bot{token}/getMe")
    return response.json()


def get_updates(channel="info"):
    token, _ = get_bot(channel)
    response = requests.get(f"https://api.telegram.org/bot{token}/getUpdates")
    return response.json()


def send_telegram(message, channel="info"):
    is_debug = channel == "debug" or channel is True

    if is_debug:
        with _buffer_lock:
            _debug_buffer.append(message)
            if len(_debug_buffer) < _BATCH_SIZE:
                return {"ok": True, "msg": "Buffered"}

            # Batch is full, send it
            batched_message = "\n".join(_debug_buffer)
            _debug_buffer.clear()
            message = batched_message

    token, chat_id = get_bot(channel)
    if not token or not chat_id:
        logger.error(f"[telegram] Missing token or chat_id for '{channel}' channel — message not sent: {message[:100]}")
        return {"ok": False, "description": "Missing token or chat_id"}

    try:
        response = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": message},
            timeout=10,
        )
        result = response.json()
        if not result.get("ok"):
            logger.error(f"[telegram] API error ({channel}): {result.get('description', 'unknown')} — message: {message[:100]}")
        return result
    except requests.RequestException as e:
        logger.error(f"[telegram] Request failed ({channel}): {e} — message: {message[:100]}")
        return {"ok": False, "description": str(e)}


def flush_telegram(channel="debug"):
    is_debug = channel == "debug" or channel is True
    if not is_debug:
        return {"ok": True, "msg": "No buffer for this channel"}

    with _buffer_lock:
        if not _debug_buffer:
            return {"ok": True, "msg": "Buffer empty"}

        message = "\n".join(_debug_buffer)
        _debug_buffer.clear()

    token, chat_id = get_bot(channel)
    response = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": message},
    )
    return response.json()


# Register flush on exit
atexit.register(flush_telegram, "debug")


def send_telegram_photo(photo, caption=None, channel="info"):
    token, chat_id = get_bot(channel)
    if not token or not chat_id:
        logger.error(f"[telegram] Missing token or chat_id for '{channel}' channel — photo not sent: {photo[:80]}")
        return {"ok": False, "description": "Missing token or chat_id"}

    url = f"https://api.telegram.org/bot{token}/sendPhoto"
    if caption:
        caption = caption[:1024]

    try:
        if photo.startswith("http"):
            data = {"chat_id": chat_id, "photo": photo, "caption": caption}
            response = requests.post(url, json=data, timeout=30)
        else:
            data = {"chat_id": chat_id, "caption": caption}
            with open(photo, "rb") as f:
                files = {"photo": f}
                response = requests.post(url, data=data, files=files, timeout=60)
        result = response.json()
        if not result.get("ok"):
            logger.error(f"[telegram] sendPhoto API error ({channel}): {result.get('description', 'unknown')} — photo: {photo[:80]}")
        return result
    except requests.RequestException as e:
        logger.error(f"[telegram] sendPhoto request failed ({channel}): {e} — photo: {photo[:80]}")
        return {"ok": False, "description": str(e)}
    except Exception:
        logger.exception(f"[telegram] sendPhoto unexpected error — photo: {photo[:80]}")
        return {"ok": False, "description": "unexpected error"}


def build_inline_keyboard(buttons):
    """
    Build an inline keyboard markup dict for Telegram.

    buttons is a list of rows: each row is a list of (text, callback_data) tuples.
    Example:
        build_inline_keyboard([
            [("Approve", "approve:0"), ("Reject", "reject:0")],
            [("Best per source", "auto_best")],
        ])
    """
    inline_keyboard = []
    for row in buttons:
        inline_keyboard.append([
            {"text": text, "callback_data": data}
            for text, data in row
        ])
    return {"inline_keyboard": inline_keyboard}


def send_telegram_audio(audio_path, caption=None, reply_markup=None, channel="info"):
    """Send an audio file via Telegram sendAudio endpoint."""
    token, chat_id = get_bot(channel)
    if not token or not chat_id:
        logger.error(f"[telegram] Missing token or chat_id for '{channel}' channel — audio not sent: {audio_path}")
        return {"ok": False, "description": "Missing token or chat_id"}

    url = f"https://api.telegram.org/bot{token}/sendAudio"

    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)

    try:
        with open(audio_path, "rb") as f:
            files = {"audio": f}
            response = requests.post(url, data=data, files=files, timeout=30)
        result = response.json()
        if not result.get("ok"):
            logger.error(f"[telegram] sendAudio API error ({channel}): {result.get('description', 'unknown')} — path: {audio_path}")
        return result
    except requests.RequestException as e:
        logger.error(f"[telegram] sendAudio request failed ({channel}): {e} — path: {audio_path}")
        return {"ok": False, "description": str(e)}
    except Exception:
        logger.exception(f"[telegram] sendAudio unexpected error — path: {audio_path}")
        return {"ok": False, "description": "unexpected error"}


def _short(value, limit=80):
    """Bytes-safe short description for log lines (path or raw payload)."""
    if isinstance(value, (bytes, bytearray)):
        return f"<{len(value)} bytes>"
    return str(value)[:limit]


def send_telegram_voice(voice_path, caption=None, reply_markup=None, channel="info"):
    """Send a voice message (OGG OPUS) via Telegram sendVoice.

    `voice_path` may be a filesystem path or raw OGG bytes — the live
    speaker-ask flow encodes with ffmpeg to stdout and sends from memory.
    """
    token, chat_id = get_bot(channel)
    if not token or not chat_id:
        logger.error(f"[telegram] Missing token or chat_id for '{channel}' channel — voice not sent: {_short(voice_path)}")
        return {"ok": False, "description": "Missing token or chat_id"}

    url = f"https://api.telegram.org/bot{token}/sendVoice"

    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption[:1024]
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)

    try:
        if isinstance(voice_path, (bytes, bytearray)):
            files = {"voice": ("speaker.ogg", io.BytesIO(bytes(voice_path)), "audio/ogg")}
            response = requests.post(url, data=data, files=files, timeout=60)
        else:
            with open(voice_path, "rb") as f:
                files = {"voice": f}
                response = requests.post(url, data=data, files=files, timeout=60)
        result = response.json()
        if not result.get("ok"):
            logger.error(f"[telegram] sendVoice API error ({channel}): {result.get('description', 'unknown')} — path: {_short(voice_path)}")
        return result
    except requests.RequestException as e:
        logger.error(f"[telegram] sendVoice request failed ({channel}): {e} — path: {_short(voice_path)}")
        return {"ok": False, "description": str(e)}
    except Exception:
        logger.exception(f"[telegram] sendVoice unexpected error — path: {_short(voice_path)}")
        return {"ok": False, "description": "unexpected error"}


def send_telegram_animation(animation, caption=None, reply_markup=None, channel="info"):
    """Send an animation (GIF) via Telegram sendAnimation.

    `animation` may be a filesystem path or raw bytes — the live speaker-ask
    flow receives GIF bytes over the WebSocket and sends them straight from
    memory (no temp files).
    """
    token, chat_id = get_bot(channel)
    if not token or not chat_id:
        logger.error(f"[telegram] Missing token or chat_id for '{channel}' channel — animation not sent")
        return {"ok": False, "description": "Missing token or chat_id"}

    url = f"https://api.telegram.org/bot{token}/sendAnimation"

    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption[:1024]
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)

    try:
        if isinstance(animation, (bytes, bytearray)):
            files = {"animation": ("speaker.gif", io.BytesIO(bytes(animation)), "image/gif")}
            response = requests.post(url, data=data, files=files, timeout=60)
        else:
            with open(animation, "rb") as f:
                files = {"animation": f}
                response = requests.post(url, data=data, files=files, timeout=60)
        result = response.json()
        if not result.get("ok"):
            logger.error(f"[telegram] sendAnimation API error ({channel}): {result.get('description', 'unknown')}")
        return result
    except requests.RequestException as e:
        logger.error(f"[telegram] sendAnimation request failed ({channel}): {e}")
        return {"ok": False, "description": str(e)}
    except Exception:
        logger.exception("[telegram] sendAnimation unexpected error")
        return {"ok": False, "description": "unexpected error"}


def answer_callback_query(callback_query_id, text=None, channel="info"):
    """Acknowledge a callback query, optionally showing a toast/alert."""
    token, _ = get_bot(channel)
    url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
    data = {"callback_query_id": callback_query_id}
    if text:
        data["text"] = text
    return requests.post(url, json=data).json()


def edit_message_caption(chat_id, message_id, caption, reply_markup=None, channel="info"):
    """Edit the caption of a message that was already sent. Used to update
    confidence scores after a sample is approved and scores are recomputed."""
    token, _ = get_bot(channel)
    url = f"https://api.telegram.org/bot{token}/editMessageCaption"
    data = {
        "chat_id": chat_id,
        "message_id": message_id,
        "caption": caption,
    }
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)
    return requests.post(url, json=data).json()


def poll_telegram_callbacks(timeout=30, channel="info"):
    """
    Poll for pending callback queries. Returns list of dicts with keys:
      callback_id, data, chat_id, message_id
    """
    token, _ = get_bot(channel)
    url = f"https://api.telegram.org/bot{token}/getUpdates"
    response = requests.post(url, json={"timeout": timeout, "allowed_updates": ["callback_query"]})
    result = response.json()

    callbacks = []
    if result.get("ok"):
        for update in result.get("result", []):
            cq = update.get("callback_query")
            if cq:
                callbacks.append({
                    "callback_id": cq["id"],
                    "data": cq.get("data", ""),
                    "chat_id": cq["message"]["chat"]["id"],
                    "message_id": cq["message"]["message_id"],
                    "update_id": update["update_id"],
                })
    return callbacks


import json

if __name__ == "__main__":
    print("Telegram library loaded. Actual send calls disabled in __main__.")
