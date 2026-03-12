import json
import finnhub
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv(".env.prod")

API_KEY = os.environ.get("FINNHUB_API_KEY", "")


finnhub_client = finnhub.Client(api_key=API_KEY)

try:
    today = datetime.now()
    from_date = today.strftime("%Y-%m-%d")
    to_date = (today + timedelta(days=7)).strftime("%Y-%m-%d")

    print(f"Fetching from {from_date} to {to_date}...")
    response = finnhub_client.earnings_call_live(_from=from_date, to=to_date)
    print(json.dumps(response, indent=2))
except Exception as e:
    print("Failed to fetch or parse earnings call data:", e)
