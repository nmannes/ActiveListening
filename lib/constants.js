const TV_SEARCH_KEYWORDS = ["basketball", "baseball", "hockey"];

// ── Scheduling timing constants ────────────────────────────────────────
const LAUNCH_BUFFER_MINUTES = 10;
const START_BUFFER_SECONDS = 5;
const STALE_THRESHOLD_MINUTES = 30;
const DEFAULT_LOOKAHEAD_HOURS = 168;
const MAX_SCHEDULED_FILE_AGE_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_PADDING_MINUTES = 10;

// ── Duration determination ─────────────────────────────────────────────
const DEFAULT_DURATION_MINUTES = 75;

// Ordered list; first matching rule wins.
// check(market, match) => boolean, duration => number | (market, match) => number
const DURATION_RULES = [
  {
    name: "cspan-explicit",
    check: (_mkt, match) => {
      const cspan = match?.mediaSources?.find((s) => s.type === "cspan")?.metadata;
      return !!(cspan && cspan.duration);
    },
    duration: (_mkt, match) =>
      match.mediaSources.find((s) => s.type === "cspan").metadata.duration,
  },
  {
    name: "survivor",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return t.includes("survivor") || s.includes("survivor");
    },
    duration: 90,
  },
  {
    name: "snl",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return (
        t.includes("snl") ||
        t.includes("saturday night live") ||
        s.includes("snl") ||
        s.includes("saturday-night-live")
      );
    },
    duration: 90,
  },
  {
    name: "earnings",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return t.includes("earnings") || s.includes("earnings");
    },
    duration: 30,
  },
  {
    name: "his-show-her-show",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      return t.includes("his show") || t.includes("her show");
    },
    duration: 60,
  },
  {
    name: "ncaa",
    check: (mkt, match) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return (
        !!match?.ncaaEvent ||
        t.includes("ncaa") ||
        s.includes("ncaa") ||
        (match?.mediaSources || []).some((src) => src.metadata?.league === "ncaa")
      );
    },
    duration: 150,
  },
  {
    name: "nba",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return t.includes("nba") || s.includes("nba");
    },
    duration: 150,
  },
  {
    name: "soccer",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return (
        s.startsWith("kxwc") ||
        t.includes("soccer") ||
        t.includes("fifa") ||
        t.includes("world cup") ||
        t.includes("premier league") ||
        t.includes("la liga") ||
        t.includes("mls") ||
        t.includes("bundesliga") ||
        t.includes("serie a") ||
        s.includes("soccer") ||
        s.includes("fifa") ||
        s.includes("world-cup")
      );
    },
    duration: 120,
  },
  {
    name: "mlb",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return t.includes("mlb") || s.includes("mlb") || t.includes("baseball");
    },
    duration: 180,
  },
  {
    name: "nhl",
    check: (mkt, match) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return (
        t.includes("nhl") ||
        s.includes("nhl") ||
        t.includes("hockey") ||
        mkt.clipProfile === "hockey" ||
        (match?.mediaSources || []).some((src) => src.metadata?.league === "nhl")
      );
    },
    duration: 120,
  },
  {
    name: "foxnews-schedule",
    check: (_mkt, match) => {
      const fox = match?.mediaSources?.find(
        (s) => s.type === "tv" && s.name === "Fox News" && s.metadata?.duration,
      );
      return !!fox;
    },
    duration: (_mkt, match) =>
      match.mediaSources.find(
        (s) => s.type === "tv" && s.name === "Fox News" && s.metadata?.duration,
      ).metadata.duration,
  },
  {
    name: "fireside-chat",
    check: (mkt) => {
      const t = (mkt.title || "").toLowerCase();
      const s = (mkt.slug || "").toLowerCase();
      return (
        t.includes("nan fireside chat") ||
        s.includes("nan-fireside") ||
        s.includes("fireside-chat")
      );
    },
    duration: 30,
  },
];

module.exports = {
  TV_SEARCH_KEYWORDS,
  LAUNCH_BUFFER_MINUTES,
  START_BUFFER_SECONDS,
  STALE_THRESHOLD_MINUTES,
  DEFAULT_LOOKAHEAD_HOURS,
  MAX_SCHEDULED_FILE_AGE_MS,
  SCHEDULE_PADDING_MINUTES,
  DEFAULT_DURATION_MINUTES,
  DURATION_RULES,
};
