const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  buildKeywordIndex,
  findKeywordMatch,
  removeFromIndex,
} = require("../lib/matching");

describe("buildKeywordIndex", () => {
  it("indexes a single-word keyword by itself", () => {
    const index = buildKeywordIndex({ Touchdown: "TICKER-TD" });
    assert.deepEqual(index, {
      touchdown: [
        { key: "Touchdown", words: ["touchdown"], value: "TICKER-TD" },
      ],
    });
  });

  it("indexes a multi-word keyword by its last word", () => {
    const index = buildKeywordIndex({ "Home Depot": "HD-TICKER" });
    assert.deepEqual(index, {
      depot: [
        { key: "Home Depot", words: ["home", "depot"], value: "HD-TICKER" },
      ],
    });
  });

  it("groups multiple keywords sharing the same last word", () => {
    const index = buildKeywordIndex({
      "first goal": "TICKER-1",
      "second goal": "TICKER-2",
    });
    assert.equal(index.goal.length, 2);
    assert.equal(index.goal[0].key, "first goal");
    assert.equal(index.goal[1].key, "second goal");
  });

  it("handles mixed single and multi-word keywords", () => {
    const index = buildKeywordIndex({
      Revenue: "REV",
      "net revenue": "NET-REV",
      Profit: "PROF",
    });
    assert.deepEqual(Object.keys(index).sort(), ["profit", "revenue"]);
    assert.equal(index.revenue.length, 2);
    assert.equal(index.profit.length, 1);
  });

  it("returns empty object for empty keywords", () => {
    assert.deepEqual(buildKeywordIndex({}), {});
  });
});

describe("findKeywordMatch", () => {
  it("matches a single-word keyword", () => {
    const index = buildKeywordIndex({ touchdown: "TD" });
    const transcript = ["the", "first", "touchdown"];
    const result = findKeywordMatch(index, transcript, "touchdown");
    assert.deepEqual(result, { key: "touchdown", value: "TD" });
  });

  it("matches a multi-word keyword phrase", () => {
    const index = buildKeywordIndex({ "Home Depot": "HD" });
    const transcript = ["welcome", "to", "home", "depot"];
    const result = findKeywordMatch(index, transcript, "depot");
    assert.deepEqual(result, { key: "Home Depot", value: "HD" });
  });

  it("returns null when last word matches but preceding words do not", () => {
    const index = buildKeywordIndex({ "Home Depot": "HD" });
    const transcript = ["warehouse", "depot"];
    const result = findKeywordMatch(index, transcript, "depot");
    assert.equal(result, null);
  });

  it("returns null for an unknown word", () => {
    const index = buildKeywordIndex({ touchdown: "TD" });
    const transcript = ["some", "random", "word"];
    const result = findKeywordMatch(index, transcript, "word");
    assert.equal(result, null);
  });

  it("returns null when transcript is shorter than keyword", () => {
    const index = buildKeywordIndex({ "three word phrase": "TWP" });
    const transcript = ["phrase"];
    const result = findKeywordMatch(index, transcript, "phrase");
    assert.equal(result, null);
  });

  it("matches the correct keyword when multiple share a last word", () => {
    const index = buildKeywordIndex({
      "first goal": "TICKER-1",
      "second goal": "TICKER-2",
    });

    const transcript1 = ["the", "first", "goal"];
    assert.deepEqual(findKeywordMatch(index, transcript1, "goal"), {
      key: "first goal",
      value: "TICKER-1",
    });

    const transcript2 = ["the", "second", "goal"];
    assert.deepEqual(findKeywordMatch(index, transcript2, "goal"), {
      key: "second goal",
      value: "TICKER-2",
    });
  });

  it("is case-insensitive (keywords lowercased at index time)", () => {
    const index = buildKeywordIndex({ Revenue: "REV" });
    const transcript = ["total", "revenue"];
    const result = findKeywordMatch(index, transcript, "revenue");
    assert.deepEqual(result, { key: "Revenue", value: "REV" });
  });

  it("matches exact transcript tail, not a substring", () => {
    const index = buildKeywordIndex({ "net income": "NI" });
    const transcript = ["planet", "income"];
    assert.equal(findKeywordMatch(index, transcript, "income"), null);
  });

  it("works with a long transcript", () => {
    const index = buildKeywordIndex({ "earnings per share": "EPS" });
    const transcript = Array(100).fill("filler");
    transcript.push("earnings", "per", "share");
    const result = findKeywordMatch(index, transcript, "share");
    assert.deepEqual(result, { key: "earnings per share", value: "EPS" });
  });
});

describe("removeFromIndex", () => {
  it("removes a keyword from the index", () => {
    const index = buildKeywordIndex({ touchdown: "TD", "field goal": "FG" });
    removeFromIndex(index, "touchdown");
    assert.equal(index.touchdown, undefined);
    assert.equal(findKeywordMatch(index, ["touchdown"], "touchdown"), null);
  });

  it("only removes the specified keyword when multiple share a last word", () => {
    const index = buildKeywordIndex({
      "first goal": "T1",
      "second goal": "T2",
    });
    removeFromIndex(index, "first goal");
    assert.equal(index.goal.length, 1);
    assert.equal(index.goal[0].key, "second goal");
  });

  it("is a no-op for a key not in the index", () => {
    const index = buildKeywordIndex({ touchdown: "TD" });
    removeFromIndex(index, "nonexistent");
    assert.equal(index.touchdown.length, 1);
  });
});

const { getSource } = require("../lib/discover_markets");
const { matchDiscoveryEvents } = require("../lib/discovery_matcher");

const DEBATE_TITLE =
  "What will the candidates say during the Massachusetts Democratic Senate Debate?";

function makeDebateResult() {
  return {
    videoTitle: "U.S. Senate Massachusetts Democratic Primary Debate",
    videoId: "QBq3mjDMHRQ",
    url: "https://www.youtube.com/watch?v=QBq3mjDMHRQ",
    channel: "GBH News",
    badge: "Premieres",
    scheduledText: "Premieres Aug 3, 2026",
    scheduledISO: "2026-08-03T23:00:00.000Z",
    isLiveNow: false,
  };
}

describe("getSource debate branch", () => {
  it("runs the debate finder and attaches the stream to a debate market", async () => {
    const market = { slug: "kxdebatemention-test", mediaStreamURL: null };
    let calledTopic = null;
    const url = await getSource(
      { title: DEBATE_TITLE },
      market,
      [],
      null,
      null,
      async (topic) => {
        calledTopic = topic;
        return makeDebateResult();
      },
    );
    assert.equal(calledTopic, "Massachusetts Democratic Senate");
    assert.equal(url, "https://www.youtube.com/watch?v=QBq3mjDMHRQ");
    assert.equal(market.debateStream.channel, "GBH News");
  });

  it("returns no URL when the finder finds nothing", async () => {
    const market = { slug: "kxdebatemention-test" };
    const url = await getSource(
      { title: DEBATE_TITLE },
      market,
      [],
      null,
      null,
      async () => null,
    );
    assert.equal(url, null);
    assert.equal(market.debateStream, undefined);
  });

  it("catches finder errors instead of losing the market", async () => {
    const market = { slug: "kxdebatemention-test" };
    const url = await getSource(
      { title: DEBATE_TITLE },
      market,
      [],
      null,
      null,
      async () => {
        throw new Error("youtube blocked");
      },
    );
    assert.equal(url, null);
  });

  it("does not call the finder for non-debate titles", async () => {
    const market = { slug: "kxdebate-sports" };
    let calls = 0;
    const url = await getSource(
      { title: "What will the announcers say during Boston vs New York?" },
      market,
      [],
      null,
      null,
      async () => {
        calls += 1;
        return makeDebateResult();
      },
    );
    assert.equal(calls, 0);
    assert.equal(url, null);
  });

  it("respects ENABLE_DEBATE_FINDER=false", async () => {
    const previous = process.env.ENABLE_DEBATE_FINDER;
    process.env.ENABLE_DEBATE_FINDER = "false";
    try {
      const market = { slug: "kxdebatemention-test" };
      let calls = 0;
      const url = await getSource(
        { title: DEBATE_TITLE },
        market,
        [],
        null,
        null,
        async () => {
          calls += 1;
          return makeDebateResult();
        },
      );
      assert.equal(calls, 0);
      assert.equal(url, null);
    } finally {
      if (previous === undefined) {
        delete process.env.ENABLE_DEBATE_FINDER;
      } else {
        process.env.ENABLE_DEBATE_FINDER = previous;
      }
    }
  });
});

describe("matchDiscoveryEvents debate media source", () => {
  it("builds a channel-named media source from market.debateStream", () => {
    const market = {
      slug: "kxdebatemention-test",
      title: DEBATE_TITLE,
      speakerEntities: ["Ed Markey", "Seth Moulton"],
      eventStartTime: "2026-08-03T23:00:00.000Z",
      mediaStreamURL: "https://www.youtube.com/watch?v=QBq3mjDMHRQ",
      debateStream: makeDebateResult(),
    };
    const results = matchDiscoveryEvents(
      [market],
      [],
      [],
      [],
      [],
      [],
      [],
      [],
    );
    const [result] = results;
    assert.equal(result.market.slug, "kxdebatemention-test");
    assert.ok(result.mediaSources.length > 0);
    const source = result.mediaSources[0];
    assert.equal(source.type, "tv");
    assert.equal(source.name, "GBH News");
    assert.equal(source.url, "https://www.youtube.com/watch?v=QBq3mjDMHRQ");
    assert.equal(source.startTime, "2026-08-03T23:00:00.000Z");
    assert.equal(source.metadata.videoTitle, "U.S. Senate Massachusetts Democratic Primary Debate");
    assert.equal(source.commonName, "GBH News");
  });
});
