const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { matchDiscoveryEvents } = require("../lib/discovery_matcher");
const { getMediaSourceCommonName } = require("../lib/channel_names");
const { CHANNEL_MAPPINGS } = require("../lib/yttv_channels");
const { normalizeSchedule } = require("../lib/normalize_schedule");

// ── getMediaSourceCommonName ────────────────────────────────────────────────

describe("getMediaSourceCommonName", () => {
  it("resolves NEWSMAX YouTube TV URL to 'NEWSMAX'", () => {
    const ms = {
      type: "market",
      name: "Market Stream",
      url: CHANNEL_MAPPINGS["NEWSMAX"],
    };
    assert.equal(getMediaSourceCommonName(ms), "NEWSMAX");
  });

  it("resolves C-SPAN 2 YTTV URL to 'C-SPAN 2' (not generic 'C-SPAN')", () => {
    const ms = {
      type: "cspan",
      name: "C-SPAN 2",
      url: CHANNEL_MAPPINGS["C-SPAN 2"],
    };
    // URL lookup should win, returning the specific channel name
    assert.equal(getMediaSourceCommonName(ms), "C-SPAN 2");
  });

  it("returns 'C-SPAN' as fallback for cspan type without YTTV URL", () => {
    const ms = {
      type: "cspan",
      name: "C-SPAN 2",
      url: "https://c-span.org/event/123",
    };
    // No YTTV URL match -> falls through to type check -> "C-SPAN"
    // Note: this loses the channel specificity (C-SPAN 2 vs C-SPAN 3)
    assert.equal(getMediaSourceCommonName(ms), "C-SPAN");
  });
});

// ── matching: Newsmax market must not lose to C-SPAN via speaker match ──────

describe("Newsmax market channel assignment", () => {
  // Build a market for the Greg Kelly / Newsmax show
  function makeGregKellyMarket(overrides = {}) {
    return {
      link: "https://kalshi.com/markets/kxtrumpmentionb/trump-mention-b/kxtrumpmentionb-26jul13c",
      slug: "kxtrumpmentionb-26jul13c",
      title: "What will Trump say during Newsmax: Greg Kelly Reports?",
      volume: "$7,829 vol",
      listingStartTimeStr: null,
      eventStartTime: "2026-07-13T21:00:00.000-04:00",
      externalLinks: ["https://www.reddit.com/r/Kalshi/"],
      mediaStreamURL: CHANNEL_MAPPINGS["NEWSMAX"],
      speakerEntities: ["Donald Trump"],
      clipProfile: null,
      ...overrides,
    };
  }

  it("resolves mediaStreamURL to NEWSMAX when title contains Newsmax", () => {
    const market = makeGregKellyMarket();
    // The URL set on the market must point to NEWSMAX, not C-SPAN
    assert.ok(market.mediaStreamURL.includes("CCIZG3NimsA"));
    // And the resolved common name is NEWSMAX
    const ms = {
      type: "market",
      name: "Market Stream",
      url: market.mediaStreamURL,
    };
    assert.equal(getMediaSourceCommonName(ms), "NEWSMAX");
  });

  it("does NOT create a cspan source when CSPAN events have no speaker overlap", () => {
    const market = makeGregKellyMarket();
    const cspanEvents = normalizeSchedule([
      {
        title: "LIVE U.S. Senate",
        date: "2026-07-13",
        startTime: "06:00 PM EDT",
        channel: "C-SPAN 2",
        url: "https://c-span.org/event/456",
      },
    ], "cspan");

    const [result] = matchDiscoveryEvents(
      [market], [], [], [], cspanEvents, [], [], [],
    );

    const cspanSources = result.mediaSources.filter((s) => s.type === "cspan");
    assert.equal(cspanSources.length, 0,
      "No CSPAN source should be created when there's no speaker overlap");
  });

  it("does NOT let a CSPAN speaker match outrank the correct Newsmax source", () => {
    const market = makeGregKellyMarket();

    // A CSPAN2 event that mentions Trump — this creates a spurious match
    const cspanEvents = normalizeSchedule([
      {
        title: "LIVE The Hearing Room",
        date: "2026-07-13",
        startTime: "08:00 PM EDT",
        channel: "C-SPAN 2",
        url: "https://c-span.org/event/789",
        sponsor: "Donald Trump testifies before Congress",
      },
    ], "cspan");

    const [result] = matchDiscoveryEvents(
      [market], [], [], [], cspanEvents, [], [], [],
    );

    // The market source (NEWSMAX YTTV URL) must be present,
    // now typed as "tv" since the URL resolves to a known channel
    const marketSource = result.mediaSources.find(
      (s) => s.commonName === "NEWSMAX"
    );
    assert.ok(marketSource, "NEWSMAX source must be present");
    assert.equal(marketSource.url, CHANNEL_MAPPINGS["NEWSMAX"]);

    // There may be a CSPAN source from the Trump speaker match,
    // but it must not be the only source
    const cspanSources = result.mediaSources.filter((s) => s.type === "cspan");
    if (cspanSources.length > 0) {
      // The highest-priority source should NOT be CSPAN when the market
      // explicitly names a channel (Newsmax) that we have a YTTV URL for.
      // Currently this assertion FAILS because type priority sorts
      // cspan(4) above market(5), revealing the bug.
      const firstSource = result.mediaSources[0];
      assert.notEqual(
        firstSource.type,
        "cspan",
        "CSPAN match must not outrank the explicit Newsmax channel source. " +
        "BUG: type priority (cspan=4, market=5) puts spurious CSPAN matches " +
        "ahead of the correct channel URL."
      );
    }
  });

  it("preserves correct Newsmax channel when no competing events exist", () => {
    const market = makeGregKellyMarket();

    const [result] = matchDiscoveryEvents(
      [market], [], [], [], [], [], [], [],
    );

    // Should have exactly one source: the known-channel source with NEWSMAX
    assert.equal(result.mediaSources.length, 1);
    assert.equal(result.mediaSources[0].commonName, "NEWSMAX");
    assert.equal(result.mediaSources[0].type, "tv");
  });
});

// ── CSPAN normalization: channel names must align with CHANNEL_MAPPINGS ─────

describe("cspan normalization", () => {
  it("C-SPAN 2 channel maps to the correct YTTV URL", () => {
    const result = normalizeSchedule(
      [{
        title: "LIVE U.S. Senate",
        date: "2026-07-13",
        startTime: "06:00 PM EDT",
        channel: "C-SPAN 2",
        url: "https://c-span.org/event/456",
      }],
      "cspan"
    );

    assert.equal(result[0].channel, "C-SPAN 2");
    // CHANNEL_MAPPINGS["C-SPAN 2"] should exist and be the YTTV URL
    assert.equal(result[0].linkURL, CHANNEL_MAPPINGS["C-SPAN 2"]);
  });
});
