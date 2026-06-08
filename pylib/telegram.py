import os
import sys
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
    token = (
        os.environ.get("TELEGRAM_KEY_DEBUG")
        if is_debug
        else os.environ.get("TELEGRAM_KEY")
    )
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
    url = f"https://api.telegram.org/bot{token}/sendPhoto"

    if photo.startswith("http"):
        data = {"chat_id": chat_id, "photo": photo, "caption": caption}
        response = requests.post(url, json=data)
    else:
        data = {"chat_id": chat_id, "caption": caption}
        with open(photo, "rb") as f:
            files = {"photo": f}
            response = requests.post(url, data=data, files=files)

    return response.json()


def build_inline_keyboard(buttons):
    """
    Build an inline keyboard markup dict for Telegram.

    buttons is a list of rows: each row is a list of (text, callback_data) tuples.
    Example:
        build_inline_keyboard([
            [("Approve", "approve:0"), ("Reject", "reject:0")],
            [("Auto-approve all", "auto_all")],
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
    url = f"https://api.telegram.org/bot{token}/sendAudio"

    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)

    with open(audio_path, "rb") as f:
        files = {"audio": f}
        response = requests.post(url, data=data, files=files)

    return response.json()


def send_telegram_voice(voice_path, caption=None, reply_markup=None, channel="info"):
    """Send a voice message (OGG OPUS) via Telegram sendVoice endpoint."""
    token, chat_id = get_bot(channel)
    url = f"https://api.telegram.org/bot{token}/sendVoice"

    data = {"chat_id": chat_id}
    if caption:
        data["caption"] = caption
    if reply_markup:
        data["reply_markup"] = json.dumps(reply_markup)

    with open(voice_path, "rb") as f:
        files = {"voice": f}
        response = requests.post(url, data=data, files=files)

    return response.json()


def answer_callback_query(callback_query_id, text=None, channel="info"):
    """Acknowledge a callback query, optionally showing a toast/alert."""
    token, _ = get_bot(channel)
    url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
    data = {"callback_query_id": callback_query_id}
    if text:
        data["text"] = text
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
    # Run a test similar to the JS main block
    print("Testing Python Telegram Library...")
    # Using the same test image as JS
    result = send_telegram_photo(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png",
        "Test image from Python",
    )
    print(json.dumps(result, indent=2))
