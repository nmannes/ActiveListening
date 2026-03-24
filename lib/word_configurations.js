// lib/word_configurations.js
const logger = require("./logger");

/**
 * Word Configuration Rules
 * 
 * Key: The original word from the market you want to configure.
 * Value: Object with the following optional properties:
 *  - substitute (Array<String>): Replaces the original word with these words.
 *  - purchaseCount (Number): Overrides the global purchase count for this specific word(s).
 *  - purchasePrice (Number): Overrides the global purchase price for this specific word(s).
 */
const WORD_RULES = {
  "draft": {
    substitute: ["draft pick"]
  },
  "walk on": {
    purchaseCount: 1
  }
};

/**
 * Modifies the market object based on WORD_RULES.
 * Allows substituting words (e.g. "draft" -> ["draft pick"])
 * and configuring specific buy amounts for them.
 */
function applyWordConfigurations(market) {
  if (!market || !market.keywords) return market;

  const newKeywords = {};
  const keywordConfigs = market.keywordConfigs || {};
  let modificationsApplied = 0;

  for (const [originalWord, ticker] of Object.entries(market.keywords)) {
    const wordStr = originalWord.toLowerCase();

    if (WORD_RULES[wordStr]) {
      const rule = WORD_RULES[wordStr];

      // Handle substitution
      if (rule.substitute && Array.isArray(rule.substitute)) {
        for (const sub of rule.substitute) {
          const subLower = sub.toLowerCase();
          newKeywords[subLower] = ticker;

          if (rule.purchaseCount !== undefined || rule.purchasePrice !== undefined) {
            keywordConfigs[subLower] = keywordConfigs[subLower] || {};
            if (rule.purchaseCount !== undefined) keywordConfigs[subLower].purchaseCount = rule.purchaseCount;
            if (rule.purchasePrice !== undefined) keywordConfigs[subLower].purchasePrice = rule.purchasePrice;
          }
        }
        modificationsApplied++;
      } else {
        // No substitution, just add config to the existing word
        newKeywords[wordStr] = ticker;

        if (rule.purchaseCount !== undefined || rule.purchasePrice !== undefined) {
          keywordConfigs[wordStr] = keywordConfigs[wordStr] || {};
          if (rule.purchaseCount !== undefined) keywordConfigs[wordStr].purchaseCount = rule.purchaseCount;
          if (rule.purchasePrice !== undefined) keywordConfigs[wordStr].purchasePrice = rule.purchasePrice;
          modificationsApplied++;
        }
      }
    } else {
      // Keep original unmodified
      newKeywords[wordStr] = ticker;
    }
  }

  if (modificationsApplied > 0) {
    logger.debug(`Applied ${modificationsApplied} word configurations.`);
  }

  market.keywords = newKeywords;
  if (Object.keys(keywordConfigs).length > 0) {
    market.keywordConfigs = keywordConfigs;
  }

  return market;
}

module.exports = { applyWordConfigurations, WORD_RULES };
