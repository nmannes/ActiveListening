const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parseIndex,
  isScheduled,
  isLive,
  parseSearchResults,
} = require("../lib/scrapers/debate_streams");

describe("parseIndex", () => {
  it("extracts the index from JSON responses", () => {
    assert.equal(parseIndex('{"index": 2}'), 2);
    assert.equal(parseIndex('{"index": null}'), null);
  });

  it("tolerates prose around the JSON", () => {
    assert.equal(parseIndex('Sure! Here: {"index": 0} hope that helps'), 0);
    assert.equal(parseIndex("no index found"), null);
    assert.equal(parseIndex(""), null);
  });
});

describe("isScheduled / isLive", () => {
  it("classifies badges and flags", () => {
    assert.equal(isScheduled({ scheduledISO: "2026-08-03T23:00:00.000Z" }), true);
    assert.equal(isScheduled({ badge: "Premieres" }), true);
    assert.equal(isScheduled({ badge: "Upcoming" }), true);
    assert.equal(isScheduled({ badge: "32:17" }), false);
    assert.equal(isScheduled({}), false);
    assert.equal(isLive({ isLiveNow: true }), true);
    assert.equal(isLive({ badge: "LIVE New" }), true);
    assert.equal(isLive({ badge: "2:14:05" }), false);
  });
});

describe("parseSearchResults", () => {
  it("parses videoRenderer results with scheduled start times", () => {
    const fixture = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        videoRenderer: {
                          videoId: "abc123",
                          title: { runs: [{ text: "Massachusetts Democratic Senate Debate" }] },
                          ownerText: { runs: [{ text: "MassLive" }] },
                          thumbnailOverlayTimeStatusRenderer: { text: { simpleText: "Premieres" } },
                          upcomingEventData: { startTime: "1785726000" },
                          publishedTimeText: { simpleText: "Premieres in 1 day" },
                        },
                      },
                      {
                        videoRenderer: {
                          videoId: "vod999",
                          title: { runs: [{ text: "Past Debate Full Replay" }] },
                          thumbnailOverlayTimeStatusRenderer: { text: { simpleText: "2:14:05" } },
                        },
                      },
                      {
                        playlistRenderer: { playlistId: "PL123" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    const results = parseSearchResults(fixture);
    assert.equal(results.length, 2);
    assert.equal(results[0].url, "https://www.youtube.com/watch?v=abc123");
    assert.equal(results[0].channel, "MassLive");
    assert.equal(results[0].badge, "Premieres");
    assert.equal(results[0].scheduledISO, new Date(1785726000 * 1000).toISOString());
    assert.equal(results[0].isLiveNow, false);
    assert.equal(results[1].badge, "2:14:05");
  });

  it("parses LIVE badges from the badges array", () => {
    const fixture = {
      contents: {
        twoColumnSearchResultsRenderer: {
          primaryContents: {
            sectionListRenderer: {
              contents: [
                {
                  itemSectionRenderer: {
                    contents: [
                      {
                        videoRenderer: {
                          videoId: "live99",
                          title: { runs: [{ text: "Massachusetts Democratic Senate Debate" }] },
                          badges: [{ metadataBadgeRenderer: { label: "LIVE" } }],
                          liveBroadcastDetails: { isLiveNow: true, startTimestamp: "2026-08-03T18:30:00.000Z" },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    };

    const [r] = parseSearchResults(fixture);
    assert.equal(r.badge, "LIVE");
    assert.equal(r.isLiveNow, true);
    // A live-now stream has no *future* start time.
    assert.equal(r.scheduledISO, null);
  });

  it("returns [] for missing or malformed ytInitialData", () => {
    assert.deepEqual(parseSearchResults(null), []);
    assert.deepEqual(parseSearchResults({}), []);
  });
});
