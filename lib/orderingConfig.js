// lib/orderingConfig.js
//
// Configures order amounts for markets based on title/slug patterns.
// Rules are evaluated top-to-bottom; first match wins.
// If no rule matches, defaultOrderAmount is used.

const ORDER_RULES = [
  {
    name: "announcers",
    match: (title, slug) => title.includes("professional basketball game") || title.includes("professional baseball game"),
    orderAmount: 100,
  },


];

const DEFAULT_ORDER_AMOUNT = 1;

/**
 * Returns the order amount for a market based on its title and slug.
 * Evaluates ORDER_RULES top-to-bottom; first match wins.
 * @param {string} title - Market title (lowercase).
 * @param {string} slug - Market slug.
 * @returns {number}
 */
function getOrderAmount(title, slug) {
  const titleLower = (title || "").toLowerCase();
  const slugLower = (slug || "").toLowerCase();

  for (const rule of ORDER_RULES) {
    if (rule.match(titleLower, slugLower)) {
      return rule.orderAmount;
    }
  }
  return DEFAULT_ORDER_AMOUNT;
}

module.exports = { getOrderAmount, ORDER_RULES, DEFAULT_ORDER_AMOUNT };
