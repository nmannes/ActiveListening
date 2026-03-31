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
    .replace(/^What will\s+/i, '')
    .replace(/^Will\s+/i, '')
    .replace(/^Announcers at\s+/i, '')
    .trim();

  const doc = nlp(cleanTitle);

  // Extract People and filter them right away for places/orgs
  const people = doc.people().out('array').filter(p => {
    const pDoc = nlp(p);
    return !pDoc.has('#Place') && !pDoc.has('#Organization');
  });

  // 1. Regex for Title Case names at the start (e.g., "Elon Musk", "Joe Biden")
  // Matches 2+ Title Case words at the beginning
  const nameMatch = cleanTitle.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (nameMatch) {
    const candidate = nameMatch[1];
    const candDoc = nlp(candidate);
    // Only add if it's not clearly a place or organization, and not already in people list
    if (!candDoc.has('#Place') && !candDoc.has('#Organization')) {
      if (!people.some(p => p.toLowerCase().includes(candidate.toLowerCase()))) {
        customEntities.push(candidate);
      }
    }
  }

  // 2. Custom for "The Fed"
  if (/The Fed/i.test(cleanTitle)) {
    customEntities.push("The Fed");
  }

  if (/\bcontestants?\b/i.test(cleanTitle)) {
    customEntities.push("contestants");
  }

  // Combine and deduplicate
  let entities = Array.from(new Set([...people, ...customEntities]))
    .map(e => e.trim())
    .filter(e => {
      const eDoc = nlp(e);
      const isPlace = eDoc.has('#Place');
      const isDate = eDoc.has('#Date');
      const isOrg = eDoc.has('#Organization') && e !== "The Fed";

      // Filter out common Kalshi event patterns that mis-tag as people or orgs
      const isEventArtifact = / (Game|Match|Conference|Press|Speech|Discussion|Interview|Show|Episode|Ep|Video|Professional|College|Basketball|Baseball|Basketball Game|Baseball Game)$/i.test(e) ||
        /^(Professional|College|NASA|Artemis)/i.test(e);

      const isPlaceOrTeam = / (Professional Basketball|Professional Baseball|College Basketball)$/i.test(e);

      return e.length > 2 &&
        !['The', 'Will', 'April', 'March', 'Next', 'MS'].includes(e) &&
        !isPlace &&
        !isDate &&
        !isOrg &&
        !isEventArtifact &&
        !isPlaceOrTeam;
    });

  // If it's an announcer market, don't let team names leak in
  if (title.toLowerCase().startsWith("announcers at")) {
    return ["announcer"];
  }

  // 3. Organization Fallback (if no people or specific roles found)
  if (entities.length === 0) {
    const orgs = doc.organizations().out('array').filter(o => {
      return o.length > 1 &&
        !/^(Game|Professional|College|Tournament|Conference|Next|April|March|Press|Announcement)$/i.test(o) &&
        !['Kalshi'].includes(o);
    });

    const manualOrgs = [];
    if (/\bNASA\b/i.test(cleanTitle)) manualOrgs.push("NASA");
    if (/\bEA\b/i.test(cleanTitle)) manualOrgs.push("EA");
    if (/\bNike\b/i.test(cleanTitle)) manualOrgs.push("Nike");
    if (/\bDelta\b/i.test(cleanTitle)) manualOrgs.push("Delta");
    if (/Supreme Court/i.test(cleanTitle)) manualOrgs.push("Supreme Court");

    const fallbacks = Array.from(new Set([...orgs, ...manualOrgs]))
      .filter(f => !/say during/i.test(f)); // Clean up potential mis-tags

    entities.push(...fallbacks);
  }

  // remove any entity that has 'press conference' in it
  entities = entities.filter(e => !/press conference/i.test(e));

  // Remove entities that are strict substrings of another entity in the list
  entities = entities.filter(e1 => {
    return !entities.some(e2 => e1 !== e2 && e2.toLowerCase().includes(e1.toLowerCase()));
  });

  return entities;
}

module.exports = {
  getSpeakerEntities
};
