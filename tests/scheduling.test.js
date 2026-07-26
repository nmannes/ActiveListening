const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { collectCandidates } = require("../lib/scheduling");

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
