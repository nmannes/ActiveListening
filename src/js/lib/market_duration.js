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

// Compute duration for TV schedule entries based on consecutive same-title
// blocks, and drop re-airs (any block whose title already appeared earlier in
// the schedule). Each entry is a 1-hour slot; a show spanning N consecutive
// slots gets a duration of N * 60 minutes. Works for Fox News, MSNBC, etc.
function computeTvDurations(schedule) {
  const sorted = [...schedule].sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime),
  );

  const seen = new Set();
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    const title = sorted[i].title;
    let endIndex = i + 1;
    while (endIndex < sorted.length && sorted[endIndex].title === title) {
      endIndex++;
    }

    if (seen.has(title)) {
      i = endIndex - 1;
      continue;
    }
    seen.add(title);

    let durationMinutes;
    if (endIndex < sorted.length) {
      const startMs = new Date(sorted[i].startTime).getTime();
      const endMs = new Date(sorted[endIndex].startTime).getTime();
      durationMinutes = (endMs - startMs) / 60000;
    } else {
      durationMinutes = 60;
    }

    for (let j = i; j < endIndex; j++) {
      const entry = { ...sorted[j] };
      if (!entry.metadata) entry.metadata = {};
      entry.metadata.duration = durationMinutes;
      result.push(entry);
    }
    i = endIndex - 1;
  }

  return result;
}

// Parse show duration from a TV schedule time/day string. Handles:
//   "weekdays 6am et"          -> 60 min (single time)
//   "weekdays 6am-10am et"     -> 240 min (range)
//   "tuesday-friday 9pm et"   -> 60 min (single time)
// Falls back to defaultMinutes if the string can't be parsed.
function parseTvDuration(timeStr, defaultMinutes = 60) {
  if (!timeStr) return defaultMinutes;

  const clean = timeStr.toLowerCase().trim()
    .replace(/\b(et|edt|est)\b/i, "").replace(/\s+/g, " ").trim();

  // Try to match a time range like "6am-10am" or "6am - 10am"
  const rangeMatch = clean.match(/(\d{1,2})\s*(am|pm)\s*[-–]\s*(\d{1,2})\s*(am|pm)/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1], 10);
    const startAmpm = rangeMatch[2].toLowerCase();
    let endH = parseInt(rangeMatch[3], 10);
    const endAmpm = rangeMatch[4].toLowerCase();

    if (startAmpm === "pm" && startH < 12) startH += 12;
    if (startAmpm === "am" && startH === 12) startH = 0;
    if (endAmpm === "pm" && endH < 12) endH += 12;
    if (endAmpm === "am" && endH === 12) endH = 0;

    // Handle overnight spanning (e.g. "11pm-2am")
    let diff = endH - startH;
    if (diff <= 0) diff += 24;

    return diff * 60;
  }

  return defaultMinutes;
}

// Set duration for each TV schedule entry by parsing its time field.
// Use when the schedule is sparse (e.g. featured shows only, not all time slots).
// Falls back to defaultMinutes when the time string contains no range.
// Sets duration directly on the entry (not in a nested metadata object),
// because normalizeSchedule wraps the entire entry as mediaSource.metadata.
function setDefaultTvDurations(schedule, defaultMinutes = 60) {
  return schedule.map((entry) => {
    const out = { ...entry };
    out.duration = parseTvDuration(out.time, defaultMinutes);
    return out;
  });
}

module.exports = { getDuration, computeTvDurations, setDefaultTvDurations };
