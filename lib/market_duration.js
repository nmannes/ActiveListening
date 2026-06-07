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

// Compute duration for each Fox News schedule entry based on consecutive
// same-title blocks, and drop re-airs (any block whose title already appeared
// earlier in the schedule). Each entry is a 1-hour slot; a show spanning N
// consecutive slots gets a duration of N * 60 minutes.
function computeFoxNewsDurations(schedule) {
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

module.exports = { getDuration, computeFoxNewsDurations };
