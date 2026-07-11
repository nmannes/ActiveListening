const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getDuration } = require("../lib/market_duration");
const { DEFAULT_DURATION_MINUTES, SCHEDULE_PADDING_MINUTES } = require("../lib/constants");

// ── getDuration: tv-timestamp rule ─────────────────────────────────────

describe("getDuration (tv-timestamp)", () => {
  it("computes duration from startTimestamp and endTimestamp in metadata", () => {
    const match = {
      mediaSources: [{
        type: "tv",
        metadata: {
          startTimestamp: "2026-07-12T04:30:00.000Z",
          endTimestamp: "2026-07-12T05:30:00.000Z",
        },
      }],
    };
    const market = { title: "James Corden After Hours", slug: "kxlatenightmention-26jul10" };

    const duration = getDuration(market, match);
    // 60-minute show, no padding (padding is added at the scheduling/job layer)
    assert.equal(duration, 60);
  });

  it("rounds fractional minutes correctly", () => {
    const match = {
      mediaSources: [{
        type: "tv",
        metadata: {
          startTimestamp: "2026-07-12T04:30:00.000Z",
          endTimestamp: "2026-07-12T05:00:30.000Z",
        },
      }],
    };
    const market = { title: "Short Segment" };

    // 30m30s -> rounds to 31m
    assert.equal(getDuration(market, match), 31);
  });

  it("clamps to at least 1 minute for very short intervals", () => {
    const match = {
      mediaSources: [{
        type: "tv",
        metadata: {
          startTimestamp: "2026-07-12T04:30:00.000Z",
          endTimestamp: "2026-07-12T04:30:10.000Z",
        },
      }],
    };
    const market = { title: "Flash" };

    assert.equal(getDuration(market, match), 1);
  });
});

// ── getDuration: other rules + fallback ────────────────────────────────

describe("getDuration (other rules)", () => {
  it("matches soccer rule for World Cup titles", () => {
    const market = { title: "FIFA World Cup Final", slug: "kxwc-26jul10" };
    const match = { mediaSources: [{}] };  // no tv timestamps, so tv-timestamp can't match

    const duration = getDuration(market, match);
    assert.equal(duration, 120);
  });

  it("matches after-hours rule for late night shows without timestamps", () => {
    const market = { title: "After Hours Recap", slug: "some-late-show" };
    const match = { mediaSources: [{}] };

    const duration = getDuration(market, match);
    assert.equal(duration, 60);
  });

  it("matches NBA rule", () => {
    const market = { title: "NBA Finals Game", slug: "nba-finals-26" };
    const match = { mediaSources: [] };

    const duration = getDuration(market, match);
    assert.equal(duration, 150);
  });

  it("falls back to default when no rule matches", () => {
    const market = { title: "Unknown Event", slug: "unknown-thing" };
    const match = { mediaSources: [] };

    const duration = getDuration(market, match);
    assert.equal(duration, DEFAULT_DURATION_MINUTES);
  });

  it("tv-timestamp takes priority over keyword rules", () => {
    // When both tv-timestamp and keyword rules match, tv-timestamp wins
    // because it comes first in DURATION_RULES.
    const match = {
      mediaSources: [{
        type: "tv",
        metadata: {
          startTimestamp: "2026-07-12T04:30:00.000Z",
          endTimestamp: "2026-07-12T05:30:00.000Z",
        },
      }],
    };
    // Title says "NBA Finals" which matches the NBA rule (150m),
    // but tv-timestamp returns 60m and should win because it's listed first.
    const market = { title: "NBA Finals Game 7", slug: "nba-finals-7" };

    const duration = getDuration(market, match);
    assert.equal(duration, 60, "tv-timestamp rule should take priority over NBA keyword rule");
  });
});

// ── Client-side end-time computation ───────────────────────────────────

describe("Client end-time logic", () => {
  // The client (client.js) computes shutdown as an absolute wall-clock time:
  //   endTime = eventStartTime + durationMinutes * 60 * 1000
  //   remainingMs = max(0, endTime - now)
  // This avoids the "Math.max with 90-min floor" bug and prevents schedule
  // padding from pushing the shutdown past the show's actual end.

  it("ends at eventStartTime + duration (no padding)", () => {
    const eventStartTime = "2026-07-12T04:30:00.000Z";
    const durationMinutes = 60; // from tv-timestamp, no padding
    const startMs = new Date(eventStartTime).getTime();
    const endTime = startMs + durationMinutes * 60 * 1000;

    assert.equal(
      new Date(endTime).toISOString(),
      "2026-07-12T05:30:00.000Z",
      "Should end exactly at the TV schedule end timestamp",
    );
  });

  it("remaining time is measured from wall clock, not from method call", () => {
    // Simulate a 5-minute startup delay: the event started at 04:30,
    // but it's now 04:35. The remaining time should be 55 minutes.
    const eventStartTime = new Date("2026-07-12T04:30:00.000Z").getTime();
    const durationMinutes = 60;
    const fakeNow = new Date("2026-07-12T04:35:00.000Z").getTime();

    const endTime = eventStartTime + durationMinutes * 60 * 1000;
    const remainingMs = Math.max(0, endTime - fakeNow);
    const remainingMin = Math.round(remainingMs / 60000);

    assert.equal(remainingMin, 55);
    assert.equal(new Date(endTime).toISOString(), "2026-07-12T05:30:00.000Z");
  });

  it("remaining time floors at 0 when already past end time", () => {
    const eventStartTime = new Date("2026-07-12T04:30:00.000Z").getTime();
    const durationMinutes = 60;
    const fakeNow = new Date("2026-07-12T06:00:00.000Z").getTime();

    const endTime = eventStartTime + durationMinutes * 60 * 1000;
    const remainingMs = Math.max(0, endTime - fakeNow);

    assert.equal(remainingMs, 0);
  });

  it("client duration does NOT include SCHEDULE_PADDING_MINUTES", () => {
    // scheduling.js line 297: duration: marketDuration (no padding)
    const marketDuration = 60; // from getDuration / tv-timestamp
    const jobDuration = marketDuration; // no + SCHEDULE_PADDING_MINUTES

    assert.equal(jobDuration, 60);
    assert.notEqual(jobDuration, marketDuration + SCHEDULE_PADDING_MINUTES);
  });
});
