# pylib/ordering_config.py
#
# Configures order amounts for markets based on title/slug patterns.
# Rules are evaluated top-to-bottom; first match wins.
# If no rule matches, DEFAULT_ORDER_AMOUNT is used.
# Evaluated at runtime (trade time), not at scheduling time.

ORDER_RULES: list[dict] = [
    # Example rule:
    # {"match": lambda m: "earnings" in (m.get("title") or "").lower(), "orderAmount": 5},
]

DEFAULT_ORDER_AMOUNT = 1


def get_order_amount(market: dict) -> int:
    """Returns the order amount for a market based on its title and slug.

    Evaluates ORDER_RULES top-to-bottom; first match wins.
    """
    for rule in ORDER_RULES:
        if rule["match"](market):
            return rule["orderAmount"]
    return DEFAULT_ORDER_AMOUNT
