const { CHANNEL_MAPPINGS } = require("./yttv_channels");

function parseAmazonTime(timeStr) {
  if (!timeStr) return null;
  if (timeStr.includes("T") && timeStr.includes("Z")) return timeStr;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (timeStr.toLowerCase().includes("tomorrow")) {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const timeMatch = timeStr.match(/(\d{1,2})\s*(pm|am)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      if (timeMatch[2].toLowerCase() === "pm" && hours < 12) hours += 12;
      tomorrow.setHours(hours, 0, 0, 0);
      return tomorrow.toISOString();
    }
    return tomorrow.toISOString();
  }

  const match = timeStr.match(/([a-z]{3}),\s*([a-z]{3})\s*(\d{1,2})(?:\s+(\d{1,2})\s*(pm|am))?/i);
  if (match) {
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[match[2].toLowerCase()];
    const day = parseInt(match[3]);
    let hours = 0;
    if (match[4]) {
      hours = parseInt(match[4]);
      if (match[5].toLowerCase() === "pm" && hours < 12) hours += 12;
    }
    const date = new Date(2026, month, day, hours, 0, 0, 0);
    return date.toISOString();
  }

  return null;
}

function parseCspanTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    if (timeMatch[3].toUpperCase() === "PM" && hours < 12) hours += 12;
    if (timeMatch[3].toUpperCase() === "AM" && hours === 12) hours = 0;
    const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return date.toISOString();
  }
  return null;
}

function normalizeSchedule(data, type) {
  if (!data) return [];
  return data.map(item => {
    let normalized = {
      title: "",
      startTime: null,
      channel: "",
      linkURL: "",
      description: "",
      metadata: item
    };

    if (type === "tv") {
      normalized.title = item.title;
      normalized.startTime = item.startTimestamp;
      normalized.channel = item.station;

      const stationUpper = (item.station || "").toUpperCase();
      const isOtaPriority = stationUpper.includes("NBC") || stationUpper.includes("CBS");
      if (isOtaPriority && item.channelURL) {
        normalized.linkURL = item.channelURL;
      } else {
        normalized.linkURL = CHANNEL_MAPPINGS[item.station] || item.channelURL;
      }

      normalized.description = item.description;
    } else if (type === "espn") {
      const cleanTeam = (name) => (name || "").replace(/^v\s+/i, "").replace(/ /g, " ").trim();
      normalized.title = `${cleanTeam(item.awayTeam)} vs. ${cleanTeam(item.homeTeam)} ${item.league || ""}`.trim().toLowerCase();
      normalized.startTime = item.startTime;

      const tvChannels = item.tvChannels || [];
      const mappedChannel = tvChannels.find((ch) => {
        const name = ch.name;
        if (name.toUpperCase() === "MLB.TV") return false;
        return !!CHANNEL_MAPPINGS[name];
      });
      if (mappedChannel) {
        normalized.channel = mappedChannel.name;
        normalized.linkURL = CHANNEL_MAPPINGS[mappedChannel.name];
      } else {
        const fallback = tvChannels.find((ch) => ch.name.toUpperCase() !== "MLB.TV");
        normalized.channel = fallback ? fallback.name : "ESPN";
        const watchLink = tvChannels.find((ch) => ch.link && ch.link.includes("/watch/player/"))?.link;
        normalized.linkURL = watchLink || item.gameLink;
      }

      normalized.description = `${item.league || "sports"} game`;
    } else if (type === "amazon") {
      normalized.title = item.title;
      normalized.startTime = parseAmazonTime(item.time);
      normalized.channel = "Amazon Prime Video";
      normalized.linkURL = item.href;
      normalized.description = "NBA on Prime";
    } else if (type === "cspan") {
      normalized.title = item.title;
      normalized.startTime = parseCspanTime(item.date, item.startTime);
      normalized.channel = item.channel;
      normalized.linkURL = CHANNEL_MAPPINGS[item.channel] || item.url;
      normalized.description = item.sponsor || "";
    } else if (type === "foxnews") {
      normalized.title = item.title;
      normalized.startTime = item.startTime;
      normalized.channel = item.channel || "Fox News";
      normalized.linkURL = item.showUrl || "";
      normalized.description = [item.hosts, item.description].filter(Boolean).join(" | ");
    } else if (type === "msnbc") {
      normalized.title = item.title;
      normalized.startTime = item.startTime;
      normalized.channel = item.channel || "MS NOW";
      normalized.linkURL = CHANNEL_MAPPINGS["MS NOW"] || "";
      normalized.description = item.time || "";
    } else if (type === "youtube_upcoming") {
      normalized.title = item.title;
      normalized.startTime = item.scheduledISO;
      normalized.channel = item.channel || "YouTube";
      normalized.linkURL = item.url || "";
      normalized.description = item.scheduledText || "";
    }

    return normalized;
  });
}

module.exports = { normalizeSchedule, parseAmazonTime, parseCspanTime };
