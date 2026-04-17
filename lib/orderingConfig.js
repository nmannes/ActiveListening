// lib/orderingConfig.js
//
// Configures order amounts for markets based on title/slug patterns.
// Rules are evaluated top-to-bottom; first match wins.
// If no rule matches, defaultOrderAmount is used.

const ORDER_RULES = [
  {
    name: "announcers",
    match: (market) => market.slug.startsWith("kxnhlmention-") || market.slug.startsWith("kxnbamention-") || market.slug.startsWith("kxmlbmention-"),
    orderAmount: 100,
  },


  {
    name: "survivor",
    match: (market) => market.title.toLowerCase().includes("during survivor ep"),
    orderAmount: 1,
  },


];

const DEFAULT_ORDER_AMOUNT = 20;

/**
 * Returns the order amount for a market based on its title and slug.
 * Evaluates ORDER_RULES top-to-bottom; first match wins.
 * @param {string} title - Market title (lowercase).
 * @param {string} slug - Market slug.
 * @returns {number}
 */
function getOrderAmount(market) {
  for (const rule of ORDER_RULES) {
    if (rule.match(market)) {
      return rule.orderAmount;
    }
  }
  return DEFAULT_ORDER_AMOUNT;
}

module.exports = { getOrderAmount, ORDER_RULES, DEFAULT_ORDER_AMOUNT };
