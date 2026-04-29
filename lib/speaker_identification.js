const nlp = require("compromise");

/**
 * Cleans the Kalshi market title for better entity extraction.
 * @param {string} title
 * @returns {string}
 */
function cleanMarketTitle(title) {
  return title
    .replace(/^What will\s+/i, "")
    .replace(/^Will\s+/i, "")
    .replace(/^Announcers at\s+/i, "")
    .replace(/during.+/i, "")
    .trim();
}

/**
 * Checks if an entity is a valid speaker based on various criteria.
 * @param {string} entity
 * @param {boolean} isOrgFallback - Whether this entity comes from organization fallback logic.
 * @returns {boolean}
 */
function isValidSpeaker(entity, isOrgFallback = false) {
  if (!entity || entity.length <= 2) return false;

  const excluded = ["The", "Will", "April", "March", "Next", "MS"];
  if (excluded.includes(entity)) return false;

  const eDoc = nlp(entity);
  if (eDoc.has("#Place") || eDoc.has("#Date")) return false;

  const isPressConference = /press conference/i.test(entity.toLowerCase());
  if (isPressConference) return false;

  // If it's an org fallback, we skip the strict person-based filters
  if (isOrgFallback) return true;

  // Unless it's "The Fed", avoid entities tagged as organizations for person extraction
  if (eDoc.has("#Organization") && entity !== "The Fed") {
    return false;
  }

  // Filter out common Kalshi event patterns that mis-tag as people or orgs
  const isEventArtifact =
    / (Game|Match|Conference|Press|Speech|Discussion|Interview|Show|Episode|Ep|Video|Professional|College|Basketball|Baseball|Basketball Game|Baseball Game)$/i.test(
      entity,
    ) || /^(Professional|College|NASA|Artemis)/i.test(entity);

  const isPlaceOrTeam =
    / (Professional Basketball|Professional Baseball|College Basketball)$/i.test(
      entity,
    );

  return !isEventArtifact && !isPlaceOrTeam;
}

/**
 * Extracts entities using custom regex mappings.
 * @param {string} cleanTitle
 * @returns {string[]}
 */
function extractCustomPeople(cleanTitle) {
  const customPeople = [
    { regex: /The Fed/i, entity: "The Fed" },
    { regex: /\bMamdani\b/i, entity: "Zohran Mamdani" },
    { regex: /\bPowell\b/i, entity: "Jerome Powell" },
    { regex: /\bcontestants?\b/i, entity: "contestant" },
    { regex: /\bVance\b/i, entity: "JD Vance" },
    { regex: /\bpanelists\b/i, entity: "panelist" },
    { regex: /\bTrump say\b/i, entity: "Donald Trump" },
    { regex: /\bMelania say\b/i, entity: "Melania Trump" },
    { regex: /\bthe announcers say\b/i, entity: "announcer" },
    { regex: /\bRFK say\b/i, entity: "Robert F. Kennedy Jr." },
  ];

  const results = [];
  customPeople.forEach(({ regex, entity }) => {
    if (regex.test(cleanTitle)) {
      results.push(entity);
    }
  });
  return results;
}

/**
 * Extracts people using NLP.
 * @param {object} doc - Compromise document
 * @returns {string[]}
 */
function extractNlpPeople(doc) {
  return doc
    .people()
    .out("array")
    .filter((p) => {
      const pDoc = nlp(p);
      return !pDoc.has("#Place") && !pDoc.has("#Organization");
    });
}

/**
 * Extracts Title Case names at the start of the title.
 * @param {string} cleanTitle
 * @returns {string[]}
 */
function extractRegexNames(cleanTitle) {
  const nameMatch = cleanTitle.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  if (nameMatch) {
    const candidate = nameMatch[1];
    const candDoc = nlp(candidate);
    if (!candDoc.has("#Place") && !candDoc.has("#Organization")) {
      return [candidate];
    }
  }
  return [];
}

/**
 * Extracts organizations as fallbacks when no people are found.
 * @param {object} doc
 * @param {string} cleanTitle
 * @param {string} originalTitle
 * @returns {string[]}
 */
function extractOrgFallbacks(doc, cleanTitle, originalTitle) {
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

  const customOrgs = [
    { regex: /\bNASA\b/i, entity: "NASA" },
    { regex: /\bEA\b/i, entity: "EA" },
    { regex: /\bNike\b/i, entity: "Nike" },
    { regex: /\bDelta\b/i, entity: "Delta" },
    { regex: /Supreme Court/i, entity: "Supreme Court" },
  ];

  const manualOrgs = [];
  customOrgs.forEach(({ regex, entity }) => {
    if (regex.test(cleanTitle)) {
      manualOrgs.push(entity);
    }
  });

  const fallbacks = Array.from(new Set([...orgs, ...manualOrgs])).filter(
    (f) => !/say during/i.test(f),
  );

  const isSports =
    / (Game|Match|Tournament|Professional|College|Basketball|Baseball)$/i.test(
      originalTitle,
    );

  const entities = [];
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
  return entities;
}

/**
 * Deduplicates entities and removes substrings.
 * @param {string[]} entities
 * @returns {string[]}
 */
function deduplicateEntities(entities) {
  const unique = Array.from(new Set(entities.map((e) => e.trim())));
  const initialCount = unique.length;

  const result = unique.filter((e1) => {
    return !unique.some(
      (e2) => e1 !== e2 && e2.toLowerCase().includes(e1.toLowerCase()),
    );
  });

  if (result.length < initialCount) {
    console.log(
      `[SpeakerID] Substring deduplication removed ${initialCount - result.length} entities`,
    );
  }
  return result;
}

/**
 * Extracts named entities (potential speakers or organizations) from a market title.
 * @param {string} title - The market event title from Kalshi
 * @returns {string[]} - Array of identified entities
 */
function getSpeakerEntities(title) {
  if (!title) return [];

  console.log(`[SpeakerID] Extracting entities from: "${title}"`);

  // Early return for announcer markets
  if (/^Announcers at\s+/i.test(title)) {
    console.log(`[SpeakerID] Announcer market detected, returning ["announcer"]`);
    return ["announcer"];
  }

  const cleanTitle = cleanMarketTitle(title);
  console.log(`[SpeakerID] Cleaned title for NLP: "${cleanTitle}"`);

  // 1. Earnings Call Pattern (High Confidence)
  const earningsMatch = title.match(/^What will (.*) say during their next earnings call/i);
  if (earningsMatch) {
    const company = earningsMatch[1].trim();
    console.log(`[SpeakerID] Earnings call detected for: ${company}`);
    return [`${company} employee`];
  }

  // 2. Custom Mappings (High Confidence)
  let customEntities = extractCustomPeople(cleanTitle);
  if (customEntities.length > 0) {
    const validCustom = deduplicateEntities(
      customEntities.filter((e) => isValidSpeaker(e)),
    );
    if (validCustom.length > 0) {
      console.log(`[SpeakerID] Custom mapping found: ${JSON.stringify(validCustom)}`);
      return validCustom;
    }
  }

  const doc = nlp(cleanTitle);

  // 3. NLP People
  let nlpPeople = extractNlpPeople(doc);
  if (nlpPeople.length > 0) {
    const validNlp = deduplicateEntities(
      nlpPeople.filter((e) => isValidSpeaker(e)),
    );
    if (validNlp.length > 0) {
      console.log(`[SpeakerID] NLP found people: ${validNlp.join(", ")}`);
      return validNlp;
    }
  }

  // 4. Regex names at start
  let regexNames = extractRegexNames(cleanTitle);
  if (regexNames.length > 0) {
    const validRegex = deduplicateEntities(
      regexNames.filter((e) => isValidSpeaker(e)),
    );
    if (validRegex.length > 0) {
      console.log(`[SpeakerID] Regex matched candidate: ${validRegex.join(", ")}`);
      return validRegex;
    }
  }

  // 5. Organization Fallback
  let orgFallbacks = extractOrgFallbacks(doc, cleanTitle, title);
  if (orgFallbacks.length > 0) {
    const validOrgs = deduplicateEntities(
      orgFallbacks.filter((e) => isValidSpeaker(e, true)),
    );
    if (validOrgs.length > 0) {
      console.log(`[SpeakerID] Org fallback found: ${validOrgs.join(", ")}`);
      return validOrgs;
    }
  }

  console.log(`[SpeakerID] No entities identified.`);
  return [];
}

module.exports = {
  getSpeakerEntities,
};
