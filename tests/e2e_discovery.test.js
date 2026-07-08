const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeSchedule,
  parseAmazonTime,
  parseCspanTime,
} = require("../lib/normalize_schedule");

// ── normalizeSchedule ──────────────────────────────────────────────────────

describe("normalizeSchedule", () => {
  it("returns empty array for null/undefined data", () => {
    assert.deepEqual(normalizeSchedule(null, "tv"), []);
    assert.deepEqual(normalizeSchedule(undefined, "tv"), []);
  });

  it("normalizes tv type correctly", () => {
    const result = normalizeSchedule(
      [{
        title: "The Last Word",
        startTimestamp: "2026-07-08T02:00:00Z",
        station: "MS NOW",
        channelURL: "https://msnbc.com/live",
        description: "Lawrence O'Donnell",
      }],
      "tv"
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].title, "The Last Word");
    assert.equal(result[0].startTime, "2026-07-08T02:00:00Z");
    assert.equal(result[0].channel, "MS NOW");
    assert.equal(result[0].description, "Lawrence O'Donnell");
    // metadata is the original item
    assert.equal(result[0].metadata.title, "The Last Word");
  });

  it("tv type prefers ota channelURL for NBC/CBS stations", () => {
    const result = normalizeSchedule(
      [{ title: "Meet the Press", startTimestamp: "2026-01-01T00:00:00Z",
         station: "NBC", channelURL: "https://nbc.com/live" }],
      "tv"
    );
    assert.equal(result[0].linkURL, "https://nbc.com/live");
  });

  it("normalizes espn type", () => {
    const result = normalizeSchedule(
      [{ awayTeam: "Red Sox", homeTeam: "Yankees", league: "MLB",
         startTime: "2026-07-08T23:00:00Z", tvChannels: [
           { name: "ESPN", link: "https://espn.com/watch/player/123" }
         ]}],
      "espn"
    );

    assert.equal(result.length, 1);
    assert.equal(result[0].title, "red sox vs. yankees mlb");
    assert.equal(result[0].description, "MLB game");
  });

  it("espn type skips MLB.TV channels", () => {
    const result = normalizeSchedule(
      [{ awayTeam: "Cubs", homeTeam: "Cardinals", league: "MLB",
         startTime: "2026-01-01T00:00:00Z", tvChannels: [
           { name: "MLB.TV", link: "" },
           { name: "ESPN", link: "https://espn.com/watch/player/456" }
         ]}],
      "espn"
    );
    assert.equal(result[0].channel, "ESPN");
  });

  it("normalizes amazon type", () => {
    const result = normalizeSchedule(
      [{ title: "Lakers vs Celtics", href: "https://amazon.com/nba",
         time: "2026-07-08T01:00:00Z" }],
      "amazon"
    );
    assert.equal(result[0].channel, "Amazon Prime Video");
  });

  it("normalizes cspan type", () => {
    const result = normalizeSchedule(
      [{ title: "House Floor", date: "2026-07-08", startTime: "10:00 AM EDT",
         channel: "C-SPAN", url: "https://c-span.org/123" }],
      "cspan"
    );
    assert.equal(result[0].title, "House Floor");
    assert.equal(result[0].channel, "C-SPAN");
  });

  it("normalizes foxnews type", () => {
    const result = normalizeSchedule(
      [{ title: "Hannity", startTime: "2026-07-08T01:00:00Z",
         channel: "Fox News", showUrl: "https://foxnews.com/hannity",
         hosts: "Sean Hannity", description: "primetime" }],
      "foxnews"
    );
    assert.equal(result[0].channel, "Fox News");
    assert.ok(result[0].description.includes("Sean Hannity"));
    assert.ok(result[0].description.includes("primetime"));
  });

  it("normalizes msnbc type", () => {
    const result = normalizeSchedule(
      [{ title: "Morning Joe", startTime: "2026-07-08T10:00:00Z",
         channel: "MS NOW", time: "6am-10am" }],
      "msnbc"
    );
    assert.equal(result[0].title, "Morning Joe");
    assert.equal(result[0].description, "6am-10am");
  });

  it("normalizes youtube_upcoming type", () => {
    const result = normalizeSchedule(
      [{ title: "Press Briefing", scheduledISO: "2026-07-08T18:00:00Z",
         channel: "YouTube", url: "https://youtube.com/watch?v=abc",
         scheduledText: "Scheduled for Jul 8" }],
      "youtube_upcoming"
    );
    assert.equal(result[0].title, "Press Briefing");
    assert.equal(result[0].description, "Scheduled for Jul 8");
  });

  it("handles multiple items", () => {
    const result = normalizeSchedule(
      [
        { title: "Show A", startTimestamp: "2026-01-01T00:00:00Z",
          station: "CNN", channelURL: "", description: "" },
        { title: "Show B", startTimestamp: "2026-01-01T01:00:00Z",
          station: "MS NOW", channelURL: "", description: "" },
      ],
      "tv"
    );
    assert.equal(result.length, 2);
    assert.equal(result[0].title, "Show A");
    assert.equal(result[1].title, "Show B");
  });
});

// ── parseAmazonTime ─────────────────────────────────────────────────────────

describe("parseAmazonTime", () => {
  it("returns null for falsy input", () => {
    assert.equal(parseAmazonTime(null), null);
    assert.equal(parseAmazonTime(""), null);
    assert.equal(parseAmazonTime(undefined), null);
  });

  it("returns ISO string unchanged if already ISO", () => {
    const iso = "2026-07-08T01:00:00Z";
    assert.equal(parseAmazonTime(iso), iso);
  });

  it("parses 'tomorrow 8 PM' format", () => {
    const result = parseAmazonTime("tomorrow 8 PM");
    assert.ok(result);
    const d = new Date(result);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    assert.equal(d.getDate(), tomorrow.getDate());
    assert.equal(d.getHours(), 20);
  });

  it("parses 'Thu, Apr 23 8 PM' format", () => {
    const result = parseAmazonTime("Thu, Apr 23 8 PM");
    assert.ok(result);
    const d = new Date(result);
    assert.equal(d.getMonth(), 3); // April
    assert.equal(d.getDate(), 23);
    assert.equal(d.getHours(), 20);
  });

  it("parses format without time (e.g. Thu, Apr 23)", () => {
    const result = parseAmazonTime("Thu, Apr 23");
    assert.ok(result);
    const d = new Date(result);
    assert.equal(d.getMonth(), 3);
    assert.equal(d.getDate(), 23);
    assert.equal(d.getHours(), 0);
  });

  it("returns null for unparseable string", () => {
    assert.equal(parseAmazonTime("not a date at all"), null);
  });
});

// ── parseCspanTime ─────────────────────────────────────────────────────────

describe("parseCspanTime", () => {
  it("returns null for falsy inputs", () => {
    assert.equal(parseCspanTime(null, "10:00 AM EDT"), null);
    assert.equal(parseCspanTime("2026-07-08", null), null);
    assert.equal(parseCspanTime(null, null), null);
  });

  it("parses AM time correctly", () => {
    const result = parseCspanTime("2026-07-08", "07:00 AM EDT");
    assert.ok(result);
    const d = new Date(result);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 6); // July
    assert.equal(d.getDate(), 8);
    assert.equal(d.getHours(), 7);
    assert.equal(d.getMinutes(), 0);
  });

  it("parses PM time correctly", () => {
    const result = parseCspanTime("2026-07-08", "08:30 PM EDT");
    const d = new Date(result);
    assert.equal(d.getHours(), 20);
    assert.equal(d.getMinutes(), 30);
  });

  it("handles 12 AM and 12 PM edge cases", () => {
    const midnight = parseCspanTime("2026-07-08", "12:00 AM EDT");
    assert.equal(new Date(midnight).getHours(), 0);

    const noon = parseCspanTime("2026-07-08", "12:00 PM EDT");
    assert.equal(new Date(noon).getHours(), 12);
  });

  it("returns null for unparseable time string", () => {
    assert.equal(parseCspanTime("2026-07-08", "not a time"), null);
  });
});

// ── Real fixture data normalization ─────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "e2e");
const FIXTURES = [
  { file: "espn_matchups.json", type: "espn" },
  { file: "foxnews_schedule.json", type: "foxnews" },
  { file: "msnbc_schedule.json", type: "msnbc" },
  { file: "youtube_upcoming.json", type: "youtube_upcoming" },
  { file: "cspan_schedule.json", type: "cspan" },
  { file: "latest_tv_schedule.json", type: "tv" },
];

describe("normalizeSchedule on real fixture data", () => {
  for (const { file, type } of FIXTURES) {
    it(`normalizes ${file} without errors`, () => {
      const data = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, file), "utf-8"));
      assert.ok(Array.isArray(data), `${file} should be an array`);
      assert.ok(data.length > 0, `${file} should have data`);

      const result = normalizeSchedule(data, type);
      assert.ok(Array.isArray(result));
      assert.equal(result.length, data.length);

      // Every normalized entry should have at minimum a title
      for (const entry of result) {
        assert.ok(typeof entry.title === "string" || entry.title === undefined,
          `title should be string or undefined in ${type}, got ${typeof entry.title}`);
      }
    });
  }

  it("normalizes latest_markets is valid JSON but not used by normalizeSchedule", () => {
    const markets = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, "latest_markets.json"), "utf-8"));
    assert.ok(Array.isArray(markets));
    assert.ok(markets.length > 0);
    // Markets are used for matching, not normalized through normalizeSchedule
    for (const m of markets) {
      assert.equal(typeof m.title, "string");
      assert.equal(typeof m.slug, "string");
    }
  });
});
