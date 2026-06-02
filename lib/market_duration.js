const { DURATION_RULES, DEFAULT_DURATION_MINUTES } = require("./constants");

function getDuration(market, match) {
  for (const rule of DURATION_RULES) {
    if (rule.check(market, match)) {
      return typeof rule.duration === "function"
        ? rule.duration(market, match)
        : rule.duration;
    }
  }
  return DEFAULT_DURATION_MINUTES;
}

module.exports = { getDuration };
