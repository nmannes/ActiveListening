const nlp = require("compromise");

/**
 * Extracts named entities (potential speakers or organizations) from a market title.
 * @param {string} title - The market event title from Kalshi
 * @returns {string[]} - Array of identified entities
 */
function getSpeakerEntities(title) {
  if (!title) return [];

  console.log(`[SpeakerID] Extracting entities from: "${title}"`);

  // Custom extraction for common Kalshi patterns
  const customEntities = [];

  if (/^Announcers at\s+/i.test(title)) {
    customEntities.push("announcer");
  }

  // Remove common Kalshi prefixes for further entity extraction
  let cleanTitle = title
    .replace(/^What will\s+/i, "")
    .replace(/^Will\s+/i, "")
    .replace(/^Announcers at\s+/i, "")
    .replace(/during.+/i, "")
    .trim();

  console.log(`[SpeakerID] Cleaned title for NLP: "${cleanTitle}"`);

  const doc = nlp(cleanTitle);

  // Extract People and filter them right away for places/orgs
  const people = doc
    .people()
    .out("array")
    .filter((p) => {
      const pDoc = nlp(p);
      return !pDoc.has("#Place") && !pDoc.has("#Organization");
    });

  if (people.length > 0) {
    console.log(`[SpeakerID] NLP found people: ${people.join(", ")}`);
  }

  // 1. Regex for Title Case names at the start (e.g., "Elon Musk", "Joe Biden")
  // Matches 2+ Title Case words at the beginning
  const nameMatch = cleanTitle.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (nameMatch) {
    const candidate = nameMatch[1];
    const candDoc = nlp(candidate);
    // Only add if it's not clearly a place or organization, and not already in people list
    if (!candDoc.has("#Place") && !candDoc.has("#Organization")) {
      if (
        !people.some((p) => p.toLowerCase().includes(candidate.toLowerCase()))
      ) {
        customEntities.push(candidate);
        console.log(`[SpeakerID] Regex matched candidate: ${candidate}`);
      }
    }
  }

  // 2. Custom Mappings
  const customPeople = [
    { regex: /The Fed/i, entity: "The Fed" },
    { regex: /\bMamdani\b/i, entity: "Zohran Mamdani" },
    { regex: /\bPowell\b/i, entity: "Jerome Powell" },
    { regex: /\bcontestants?\b/i, entity: "contestant" },
    { regex: /\bVance\b/i, entity: "JD Vance" },
    { regex: /\bpanelists?\b/i, entity: "panelist" },
    { regex: /\bTrump?\b/i, entity: "Donald Trump" },
    { regex: /\bMelania\b/i, entity: "Melania Trump" },
    { regex: /\bthe announcers say\b/i, entity: "announcer" },
    { regex: /\bRFK say\b/i, entity: "Robert F. Kennedy Jr." },

  ];

  customPeople.forEach(({ regex, entity }) => {
    if (regex.test(cleanTitle)) {
      customEntities.push(entity);
    }
  });

  // Combine and deduplicate
  let entities = Array.from(new Set([...people, ...customEntities]))
    .map((e) => e.trim())
    .filter((e) => {
      const eDoc = nlp(e);
      const isPlace = eDoc.has("#Place");
      const isDate = eDoc.has("#Date");
      const isOrg = eDoc.has("#Organization") && e !== "The Fed";

      // Filter out common Kalshi event patterns that mis-tag as people or orgs
      const isEventArtifact =
        / (Game|Match|Conference|Press|Speech|Discussion|Interview|Show|Episode|Ep|Video|Professional|College|Basketball|Baseball|Basketball Game|Baseball Game)$/i.test(
          e,
        ) || /^(Professional|College|NASA|Artemis)/i.test(e);

      const isPlaceOrTeam =
        / (Professional Basketball|Professional Baseball|College Basketball)$/i.test(
          e,
        );

      return (
        e.length > 2 &&
        !["The", "Will", "April", "March", "Next", "MS"].includes(e) &&
        !isPlace &&
        !isDate &&
        !isOrg &&
        !isEventArtifact &&
        !isPlaceOrTeam
      );
    });

  // If it's an announcer market, don't let team names leak in
  if (title.toLowerCase().startsWith("announcers at")) {
    console.log(`[SpeakerID] Announcer market detected, returning ["announcer"]`);
    return ["announcer"];
  }

  // 3. Organization Fallback (if no people or specific roles found)
  if (entities.length === 0) {
    const orgs = doc
      .organizations()
      .out("array")
      .filter((o) => {
        return (
          o.length > 1 &&
          !/^(Game|Professional|College|Tournament|Conference|Next|April|March|Press|Announcement)$/i.test(
            o,
          ) &&
          !["Kalshi"].includes(o)
        );
      });

    const manualOrgs = [];
    const customOrgs = [
      { regex: /\bNASA\b/i, entity: "NASA" },
      { regex: /\bEA\b/i, entity: "EA" },
      { regex: /\bNike\b/i, entity: "Nike" },
      { regex: /\bDelta\b/i, entity: "Delta" },
      { regex: /Supreme Court/i, entity: "Supreme Court" },
    ];

    customOrgs.forEach(({ regex, entity }) => {
      if (regex.test(cleanTitle)) {
        manualOrgs.push(entity);
      }
    });

    const fallbacks = Array.from(new Set([...orgs, ...manualOrgs])).filter(
      (f) => !/say during/i.test(f),
    ); // Clean up potential mis-tags

    const isSports =
      / (Game|Match|Tournament|Professional|College|Basketball|Baseball)$/i.test(
        title,
      );

    if (!isSports) {
      fallbacks.forEach((f) => {
        entities.push(f);
        if (f.toLowerCase() !== "supreme court") {
          entities.push(`${f} employee`);
        }
      });
    } else {
      entities.push(...fallbacks);
    }
    if (fallbacks.length > 0) {
      console.log(`[SpeakerID] Org fallback found: ${fallbacks.join(", ")}`);
    }
  }

  // remove any entity that has 'press conference' in it
  entities = entities.filter((e) => !/press conference/i.test(e.toLowerCase()));

  // Remove entities that are strict substrings of another entity in the list
  const initialCount = entities.length;
  entities = entities.filter((e1) => {
    return !entities.some(
      (e2) => e1 !== e2 && e2.toLowerCase().includes(e1.toLowerCase()),
    );
  });
  if (entities.length < initialCount) {
    console.log(`[SpeakerID] Substring deduplication removed ${initialCount - entities.length} entities`);
  }

  console.log(`[SpeakerID] Final identified entities: ${JSON.stringify(entities)}`);
  return entities;
}

module.exports = {
  getSpeakerEntities,
};
