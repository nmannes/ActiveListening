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

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
MY_ID = os.environ.get("TELEGRAM_MY_ID")
BASE_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

def get_bot_info():
    response = requests.get(f"{BASE_URL}/getMe")
    return response.json()

def get_updates():
    response = requests.get(f"{BASE_URL}/getUpdates")
    return response.json()

def send_telegram(message):
    response = requests.post(f"{BASE_URL}/sendMessage", json={
        "chat_id": MY_ID,
        "text": message
    })
    return response.json()

def send_telegram_photo(photo, caption=None):
    url = f"{BASE_URL}/sendPhoto"
    
    if photo.startswith("http"):
        data = {
            "chat_id": MY_ID,
            "photo": photo,
            "caption": caption
        }
        response = requests.post(url, json=data)
    else:
        data = {
            "chat_id": MY_ID,
            "caption": caption
        }
        with open(photo, "rb") as f:
            files = {"photo": f}
            response = requests.post(url, data=data, files=files)
            
    return response.json()

if __name__ == "__main__":
    import json
    # Run a test similar to the JS main block
    print("Testing Python Telegram Library...")
    # Using the same test image as JS
    result = send_telegram_photo("https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/512px-Telegram_logo.svg.png", "Test image from Python")
    print(json.dumps(result, indent=2))
