# pylib/ordering_config.py
#
# Configures dollar amounts for market orders based on title/slug patterns.
# Rules are evaluated top-to-bottom; first match wins.
# If no rule matches, DEFAULT_DOLLAR_AMOUNT is used.
# Evaluated at runtime (trade time), not at scheduling time.

ORDER_RULES: list[dict] = [
    # Example rule:
    # {"match": lambda m: "earnings" in (m.get("title") or "").lower(), "dollarAmount": 5},
]

DEFAULT_DOLLAR_AMOUNT = 1


def get_dollar_amount(market: dict) -> int:
    """Returns the dollar amount to spend on a market order.

    Evaluates ORDER_RULES top-to-bottom; first match wins.
    """
    for rule in ORDER_RULES:
        if rule["match"](market):
            return rule["dollarAmount"]
    return DEFAULT_DOLLAR_AMOUNT
