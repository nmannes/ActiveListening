/**
 * Known host schedules. Times are Eastern Time (EST/EDT).
 *
 * Each entry maps a host name to their regular show time.
 * Used as a fallback when the market has no eventStartTime and
 * no schedule match provides one.
 *
 * Format: { host, showTime: "HH:MM" (24h ET), channel, showName, days: [0-6] (0=Sun) }
 * If days is omitted, assumes weekdays (Mon-Fri).
 */
const HOST_SCHEDULES = [
  {
    host: "Sean Hannity",
    showTime: "21:00", // 9PM ET
    channel: "Fox News",
    showName: "Hannity",
    days: [1, 2, 3, 4, 5], // Mon-Fri
  },
];

/**
 * Returns the next upcoming show time for a given host, or null if unknown.
 * @param {string} hostName
 * @param {Date} [after=new Date()] - Find the next show after this time
 * @returns {Date|null}
 */
function getNextShowTime(hostName, after = new Date()) {
  const entry = HOST_SCHEDULES.find(
    (e) => e.host.toLowerCase() === hostName.toLowerCase(),
  );
  if (!entry) return null;

  const [hourStr, minStr] = entry.showTime.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);

  // Determine if ET is currently EDT or EST
  const now = new Date();
  const mar2ndSun = 8 + ((7 - new Date(now.getFullYear(), 2, 1).getDay()) % 7);
  const nov1stSun = 1 + ((7 - new Date(now.getFullYear(), 10, 1).getDay()) % 7);
  const isEDT =
    now >= new Date(now.getFullYear(), 2, mar2ndSun) &&
    now < new Date(now.getFullYear(), 10, nov1stSun);
  const etOffset = isEDT ? 4 : 5; // UTC offset

  // Start from the target date in ET
  const etNow = new Date(after.getTime() - etOffset * 60 * 60 * 1000);

  // Check the next 7 days for a valid show day
  for (let i = 0; i < 7; i++) {
    const check = new Date(
      etNow.getFullYear(),
      etNow.getMonth(),
      etNow.getDate() + i,
    );
    const dayOfWeek = check.getDay();

    if (!entry.days || entry.days.includes(dayOfWeek)) {
      const showDate = new Date(
        Date.UTC(
          check.getFullYear(),
          check.getMonth(),
          check.getDate(),
          hour + etOffset,
          minute,
        ),
      );

      // Skip if today's show already started (unless we're within 10 min of it)
      if (showDate <= new Date(after.getTime() + 10 * 60 * 1000)) {
        continue;
      }

      return showDate;
    }
  }

  return null;
}

/**
 * Given a market, returns the host schedule time if the market's speakers
 * match a known host and no better time source is available.
 * @param {Object} market
 * @param {Date} [after]
 * @returns {Date|null}
 */
function getHostScheduleTime(market, after) {
  const speakers = market.speakerEntities || [];
  for (const speaker of speakers) {
    const time = getNextShowTime(speaker, after);
    if (time) return time;
  }
  return null;
}

module.exports = { HOST_SCHEDULES, getNextShowTime, getHostScheduleTime };
