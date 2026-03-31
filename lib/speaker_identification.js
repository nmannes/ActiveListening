const nlp = require('compromise');

/**
 * Extracts named entities (potential speakers or organizations) from a market title.
 * @param {string} title - The market event title from Kalshi
 * @returns {string[]} - Array of identified entities
 */
function getSpeakerEntities(title) {
  if (!title) return [];

  // Custom extraction for common Kalshi patterns
  const customEntities = [];

  if (/^Announcers at\s+/i.test(title)) {
    customEntities.push("announcer");
  }

  // Remove common Kalshi prefixes for further entity extraction
  let cleanTitle = title
    .replace(/^Will\s+/i, '')
    .replace(/^Announcers at\s+/i, '')
    .trim();

  const doc = nlp(cleanTitle);

  // Extract People
  let people = doc.people().out('array');

  // 1. Regex for Title Case names at the start (e.g., "Elon Musk", "Joe Biden")
  // Matches 2+ Title Case words at the beginning
  const nameMatch = cleanTitle.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (nameMatch) {
    customEntities.push(nameMatch[1]);
  }

  // 2. Custom for "The Fed"
  if (/The Fed/i.test(cleanTitle)) {
    customEntities.push("The Fed");
  }

  // Combine and deduplicate
  const entities = Array.from(new Set([...people, ...customEntities]))
    .map(e => e.trim())
    .filter(e => {
      // Basic filtering to avoid single letters or very generic noise
      return e.length > 1 && !['The'].includes(e);
    });

  return entities;
}

module.exports = {
  getSpeakerEntities
};
