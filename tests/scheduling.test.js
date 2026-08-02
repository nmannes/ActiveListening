const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { collectCandidates, groupByStreamUrl, buildCombinedMarket } = require("../lib/scheduling");

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "scheduling-test-"));
process.env.KALSHI_CACHE_DIR = cacheDir;

before(() => {
  fs.rmSync(cacheDir, { recursive: true, force: true });
});

function makeMatch(overrides = {}) {
  const now = new Date();
  const startTime = new Date(now.getTime() + 3600000); // 1 hour ahead
  return {
    market: {
      slug: "test-market",
      title: "Test Market",
      keywords: { test: "TICKER" },
      eventStartTime: startTime.toISOString(),
      ...overrides.market,
    },
    mediaSources: [
      {
        type: "youtube",
        name: "YouTube",
        url: "https://youtube.com/watch?v=test",
        startTime: startTime.toISOString(),
        ...overrides.source,
      },
    ],
  };
}

function makeBaseballCandidate(slug, title, startTime, extraSources = []) {
  return {
    slug,
    title,
    keywords: { run: "TICKER" },
    eventStartTime: startTime,
    mediaSources: [
      { type: "youtube", name: "YouTube", url: `https://youtube.com/${slug}` },
      ...extraSources,
    ],
  };
}

// ── collectCandidates ────────────────────────────────────────────────────

describe("collectCandidates", () => {
  it("returns a candidate that passes all filters", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "test-event",
          title: "Test Event",
          keywords: { goal: "TICKER" },
          eventStartTime: startTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/watch?v=abc",
            startTime: startTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].slug, "test-event");
  });

  it("skips candidates without keywords", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "no-keywords",
          title: "No Keywords",
          keywords: {},
          eventStartTime: startTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/watch?v=abc",
            startTime: startTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 0);
  });

  it("skips candidates without a stream URL", () => {
    const now = new Date();
    const matches = [
      {
        market: {
          slug: "no-stream",
          title: "No Stream",
          keywords: { test: "TICKER" },
        },
        mediaSources: [],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 0);
  });

  it("skips candidates past the lookahead window", () => {
    const now = new Date();
    const farFuture = new Date(now.getTime() + 10 * 3600000);
    const matches = [
      {
        market: {
          slug: "too-far",
          title: "Too Far",
          keywords: { test: "TICKER" },
          eventStartTime: farFuture.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/watch?v=abc",
            startTime: farFuture.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 2 * 3600000,
      now,

    });

    assert.equal(candidates.length, 0);
  });

  it("filters to youtube-only when youtubeOnly is set", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "tv-event",
          title: "TV Event",
          keywords: { test: "TICKER" },
          eventStartTime: startTime.toISOString(),
        },
        mediaSources: [
          {
            type: "tv",
            name: "ESPN",
            url: "https://espn.com/stream",
            startTime: startTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: true,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 0);
  });

  it("skips Apple TV sources", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "apple-event",
          title: "Apple TV Event",
          keywords: { test: "TICKER" },
          eventStartTime: startTime.toISOString(),
        },
        mediaSources: [
          {
            type: "tv",
            name: "Apple TV",
            url: "https://tv.apple.com/stream",
            startTime: startTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 0);
  });

  it("sorts candidates by eventStartTime", () => {
    const now = new Date();
    const later = new Date(now.getTime() + 7200000);
    const earlier = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "later",
          title: "Later Event",
          keywords: { test: "TICKER" },
          eventStartTime: later.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/later",
            startTime: later.toISOString(),
          },
        ],
      },
      {
        market: {
          slug: "earlier",
          title: "Earlier Event",
          keywords: { test: "TICKER" },
          eventStartTime: earlier.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/earlier",
            startTime: earlier.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].slug, "earlier");
    assert.equal(candidates[1].slug, "later");
  });
});

// ── resolveOverlappingBaseballCandidates (via collectCandidates) ─────────

describe("resolveOverlappingBaseballCandidates", () => {
  it("returns non-baseball candidates unchanged", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "kxhockey-bruins-vs-rangers",
          title: "Bruins vs Rangers",
          keywords: { goal: "TICKER" },
          eventStartTime: startTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/hockey",
            startTime: startTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].slug, "kxhockey-bruins-vs-rangers");
  });

  it("keeps a single baseball candidate", () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 3600000);
    const matches = [
      {
        market: {
          slug: "kxbb-mets-vs-phillies",
          title: "Mets vs Phillies",
          keywords: { run: "TICKER" },
          eventStartTime: startTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/mlb",
            startTime: startTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].slug, "kxbb-mets-vs-phillies");
  });

  it("disambiguates overlapping baseball games using TV descriptions", () => {
    const now = new Date();
    const overlapTime = new Date(now.getTime() + 3600000);

    // Two overlapping baseball games at the same time
    const matches = [
      {
        market: {
          slug: "kxbb-mets-vs-phillies",
          title: "Mets vs Phillies",
          keywords: { run: "TICKER" },
          eventStartTime: overlapTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/mlb1",
            startTime: overlapTime.toISOString(),
          },
          {
            type: "tv",
            name: "ESPN",
            url: "https://espn.com/stream",
            startTime: overlapTime.toISOString(),
            metadata: {
              description: "Mets at Phillies. From Citizens Bank Park.",
            },
          },
        ],
      },
      {
        market: {
          slug: "kxbb-yankees-vs-redsox",
          title: "Yankees vs Red Sox",
          keywords: { run: "TICKER" },
          eventStartTime: overlapTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/mlb2",
            startTime: overlapTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    // Only the candidate whose teams match the TV description should remain
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].slug, "kxbb-mets-vs-phillies");
  });

  it("disambiguates overlapping baseball games with same-city teams using raw team names", () => {
    const now = new Date();
    const overlapTime = new Date(now.getTime() + 3600000);

    // Two overlapping games that share cities: Dodgers=LA, Angels=LA; Yankees=NY, Mets=NY.
    // Without raw name checking, expanded city variants would cause both to match.
    const matches = [
      {
        market: {
          slug: "kxbb-dodgers-vs-yankees",
          title: "Dodgers vs Yankees",
          keywords: { run: "TICKER" },
          eventStartTime: overlapTime.toISOString(),
        },
        mediaSources: [
          {
            type: "tv",
            name: "ESPN",
            url: "https://espn.com/stream",
            startTime: overlapTime.toISOString(),
            metadata: {
              description: "Dodgers at Yankees. From Yankee Stadium.",
            },
          },
        ],
      },
      {
        market: {
          slug: "kxbb-angels-vs-mets",
          title: "Angels vs Mets",
          keywords: { run: "TICKER" },
          eventStartTime: overlapTime.toISOString(),
        },
        mediaSources: [
          {
            type: "tv",
            name: "MLB Network",
            url: "https://mlb.com/stream",
            startTime: overlapTime.toISOString(),
            metadata: {
              description: "Dodgers at Yankees. From Yankee Stadium.",
            },
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,
    });

    // Only the Dodgers vs Yankees market should survive — raw names "dodgers" and "yankees"
    // match the TV description, while "angels" and "mets" do not.
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].slug, "kxbb-dodgers-vs-yankees");
  });

  it("keeps all overlapping baseball candidates when no TV descriptions exist", () => {
    const now = new Date();
    const overlapTime = new Date(now.getTime() + 3600000);

    const matches = [
      {
        market: {
          slug: "kxbb-mets-vs-phillies",
          title: "Mets vs Phillies",
          keywords: { run: "TICKER" },
          eventStartTime: overlapTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/mlb1",
            startTime: overlapTime.toISOString(),
          },
        ],
      },
      {
        market: {
          slug: "kxbb-yankees-vs-redsox",
          title: "Yankees vs Red Sox",
          keywords: { run: "TICKER" },
          eventStartTime: overlapTime.toISOString(),
        },
        mediaSources: [
          {
            type: "youtube",
            name: "YouTube",
            url: "https://youtube.com/mlb2",
            startTime: overlapTime.toISOString(),
          },
        ],
      },
    ];

    const { candidates } = collectCandidates(matches, {
      targetSlug: null,
      youtubeOnly: false,
      lookaheadMs: 4 * 3600000,
      now,

    });

    // No TV descriptions means we can't disambiguate — keep both
    assert.equal(candidates.length, 2);
  });
});

// ── groupByStreamUrl ──────────────────────────────────────────────────────

describe("groupByStreamUrl", () => {
  it("returns single candidate unchanged", () => {
    const now = new Date();
    const start = new Date(now.getTime() + 3600000);
    const candidates = [{
      slug: "single-market",
      title: "Single",
      keywords: { test: "TICK" },
      eventStartTime: start.toISOString(),
      mediaStreamURL: "https://youtube.com/abc",
    }];

    const result = groupByStreamUrl(candidates);
    assert.equal(result.length, 1);
    assert(!result[0].markets); // no grouping wrapper
    assert.equal(result[0].slug, "single-market");
  });

  it("groups two candidates with same URL and exact same start time", () => {
    const start = "2026-08-02T14:30:00.000Z";
    const candidates = [
      {
        slug: "market-a",
        title: "Market A",
        keywords: { cherry: "TICK-A" },
        speakerEntities: ["Speaker A"],
        eventStartTime: start,
        mediaStreamURL: "https://youtube.com/shared",
        mediaSources: [{ type: "tv", url: "https://youtube.com/shared" }],
      },
      {
        slug: "market-b",
        title: "Market B",
        keywords: { apple: "TICK-B" },
        speakerEntities: ["Speaker B"],
        eventStartTime: start,
        mediaStreamURL: "https://youtube.com/shared",
        mediaSources: [{ type: "tv", url: "https://youtube.com/shared" }],
      },
    ];

    const result = groupByStreamUrl(candidates);
    assert.equal(result.length, 1);
    assert.equal(result[0].markets.length, 2);
    assert.equal(result[0].slug, "combined-market-a-market-b");
    assert.equal(result[0].markets[0].slug, "market-a");
    assert.equal(result[0].markets[1].slug, "market-b");
    // Union speaker entities
    assert.deepEqual(result[0].speakerEntities, ["Speaker A", "Speaker B"]);
    // Merged keywords
    assert.equal(result[0].keywords.cherry, "TICK-A");
    assert.equal(result[0].keywords.apple, "TICK-B");
  });

  it("does not group candidates with different URLs", () => {
    const start = "2026-08-02T14:30:00.000Z";
    const candidates = [
      {
        slug: "market-a",
        title: "Market A",
        keywords: { test: "TICK-A" },
        eventStartTime: start,
        mediaStreamURL: "https://youtube.com/stream-a",
      },
      {
        slug: "market-b",
        title: "Market B",
        keywords: { test: "TICK-B" },
        eventStartTime: start,
        mediaStreamURL: "https://youtube.com/stream-b",
      },
    ];

    const result = groupByStreamUrl(candidates);
    assert.equal(result.length, 2);
    assert(!result[0].markets);
    assert(!result[1].markets);
  });

  it("does not group candidates with different start times", () => {
    const candidates = [
      {
        slug: "market-a",
        title: "Market A",
        keywords: { test: "TICK" },
        eventStartTime: "2026-08-02T14:30:00.000Z",
        mediaStreamURL: "https://youtube.com/shared",
      },
      {
        slug: "market-b",
        title: "Market B",
        keywords: { test: "TICK" },
        eventStartTime: "2026-08-02T15:30:00.000Z",
        mediaStreamURL: "https://youtube.com/shared",
      },
    ];

    const result = groupByStreamUrl(candidates);
    assert.equal(result.length, 2);
  });

  it("passes candidate without stream URL through unchanged", () => {
    const candidates = [{
      slug: "no-stream",
      title: "No Stream",
      keywords: { test: "TICK" },
      eventStartTime: "2026-08-02T14:30:00.000Z",
    }];

    const result = groupByStreamUrl(candidates);
    assert.equal(result.length, 1);
    assert.equal(result[0].slug, "no-stream");
  });
});

// ── buildCombinedMarket ───────────────────────────────────────────────────

describe("buildCombinedMarket", () => {
  it("merges keywords from both markets", () => {
    const group = [
      { slug: "a", title: "A", keywords: { alpha: "TICK-A" }, speakerEntities: ["Alice"], eventStartTime: "2026-08-02T14:30:00.000Z", mediaStreamURL: "url", mediaSources: [] },
      { slug: "b", title: "B", keywords: { beta: "TICK-B" }, speakerEntities: ["Bob"], eventStartTime: "2026-08-02T14:30:00.000Z", mediaStreamURL: "url", mediaSources: [] },
    ];

    const combined = buildCombinedMarket(group);
    assert.equal(combined.markets.length, 2);
    assert.equal(combined.keywords.alpha, "TICK-A");
    assert.equal(combined.keywords.beta, "TICK-B");
    assert.deepEqual(combined.speakerEntities, ["Alice", "Bob"]);
    assert.equal(combined.mediaStreamURL, "url");
  });

  it("deduplicates speaker entities", () => {
    const group = [
      { slug: "a", title: "A", keywords: { alpha: "TICK-A" }, speakerEntities: ["Alice", "Shared"], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
      { slug: "b", title: "B", keywords: { beta: "TICK-B" }, speakerEntities: ["Bob", "Shared"], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
    ];

    const combined = buildCombinedMarket(group);
    assert.deepEqual(combined.speakerEntities, ["Alice", "Shared", "Bob"]);
  });

  it("builds keywordMarketMap with array values for shared keywords", () => {
    const group = [
      { slug: "a", title: "A", keywords: { shared: "TICK-A-SHARED", unique_a: "TICK-A" }, speakerEntities: ["Alice"], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
      { slug: "b", title: "B", keywords: { shared: "TICK-B-SHARED", unique_b: "TICK-B" }, speakerEntities: ["Bob"], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
    ];

    const combined = buildCombinedMarket(group);
    // Both ticks present (tickers differ per market). Last market wins in Object.assign.
    assert.equal(combined.keywords.shared, "TICK-B-SHARED");
    // keywordMarketMap has array entries
    assert.deepEqual(combined.keywordMarketMap.shared, [0, 1]);
    assert.deepEqual(combined.keywordMarketMap.unique_a, [0]);
    assert.deepEqual(combined.keywordMarketMap.unique_b, [1]);
  });

  it("preserves individual market keywordConfigs", () => {
    const group = [
      { slug: "a", title: "A", keywords: { alpha: "TICK-A" }, speakerEntities: ["Alice"], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [], keywordConfigs: { alpha: { dollarAmount: 5 } } },
      { slug: "b", title: "B", keywords: { beta: "TICK-B" }, speakerEntities: ["Bob"], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
    ];

    const combined = buildCombinedMarket(group);
    // Individual market objects preserved in markets array
    assert.equal(combined.markets[0].keywordConfigs.alpha.dollarAmount, 5);
  });

  it("truncates slug to 80 chars", () => {
    const longSlug = "x".repeat(50);
    const group = [
      { slug: longSlug, title: "A", keywords: { a: "T" }, speakerEntities: [], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
      { slug: longSlug, title: "B", keywords: { b: "T" }, speakerEntities: [], eventStartTime: "t", mediaStreamURL: "u", mediaSources: [] },
    ];

    const combined = buildCombinedMarket(group);
    assert(combined.slug.length <= 80);
    assert(combined.slug.startsWith("combined-"));
  });
});
