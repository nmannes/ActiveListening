# pylib/ordering_config.py
#
# Configures dollar amounts for market orders based on title/slug patterns.
# Rules are evaluated top-to-bottom; first match wins.
# If no rule matches, DEFAULT_DOLLAR_AMOUNT is used.
# Evaluated at runtime (trade time), not at scheduling time.


ORDER_RULES: list[dict] = [
    {
        "match": lambda m: (m.get("slug") or "").startswith(
            ("kxwcmention", "kxmlbmention", "kxwnbamention")
        ),
        "dollarAmount": 100,
    },
]

DEFAULT_DOLLAR_AMOUNT = 1

# Keywords that are net-negative due to phonetic ambiguity or excessive
# false positives. Blocking these saves ~$148 in losses vs ~$20 in forgone wins.
BLOCKED_KEYWORDS: set[str] = {
    # Single-syllable, phonetically ambiguous — too many false positives
    "oil",
    "sweep",
    # Multi-word phrase too hard for Deepgram to transcribe correctly
    "red card",
    # Rare name, easy to mishear across accents
    "gianni",
    "infantino",
    "epstein",
    # Too common — said constantly, rarely in qualifying context
    "trump",
    "election",
    "record",
    "afford",           # 1W/9L — "afore", "a form", "affirmed"
    "invest",           # 0W/2L — "in vest", "in best"
    "nuclear",          # 0W/1L — "new clear", "nucleus"
    "ballroom",         # 0W/2L — announcers don't say this
    "powerade",         # 0W/2L — "power aid", "powered"
    "visa",             # 3W/1L but negative P&L — credit card vs immigration confusion
    "qatar",
    "soccer"
}


def is_keyword_blocked(keyword: str) -> bool:
    return keyword.lower() in BLOCKED_KEYWORDS


def get_dollar_amount(market: dict, keyword: str = None) -> int:
    """Returns the dollar amount to spend on a market order.

    Evaluates ORDER_RULES top-to-bottom; first match wins.
    If keyword is blocked, returns 0 to skip the trade.
    """
    if keyword and is_keyword_blocked(keyword):
        return 0
    for rule in ORDER_RULES:
        if rule["match"](market):
            return rule["dollarAmount"]
    return DEFAULT_DOLLAR_AMOUNT
