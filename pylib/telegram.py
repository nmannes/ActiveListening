import os
import sys
import requests
from dotenv import load_dotenv
from pathlib import Path


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
    token, chat_id = get_bot(channel)
    response = requests.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat_id, "text": message},
    )
    return response.json()


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


if __name__ == "__main__":
    import json

    # Run a test similar to the JS main block
    print("Testing Python Telegram Library...")
    # Using the same test image as JS
    result = send_telegram_photo(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png",
        "Test image from Python",
    )
    print(json.dumps(result, indent=2))
