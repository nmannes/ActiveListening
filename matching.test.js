const {
  buildKeywordIndex,
  findKeywordMatch,
  removeFromIndex,
} = require("./lib/matching");

describe("buildKeywordIndex", () => {
  test("indexes a single-word keyword by itself", () => {
    const index = buildKeywordIndex({ Touchdown: "TICKER-TD" });
    expect(index).toEqual({
      touchdown: [
        { key: "Touchdown", words: ["touchdown"], value: "TICKER-TD" },
      ],
    });
  });

  test("indexes a multi-word keyword by its last word", () => {
    const index = buildKeywordIndex({ "Home Depot": "HD-TICKER" });
    expect(index).toEqual({
      depot: [
        { key: "Home Depot", words: ["home", "depot"], value: "HD-TICKER" },
      ],
    });
  });

  test("groups multiple keywords sharing the same last word", () => {
    const index = buildKeywordIndex({
      "first goal": "TICKER-1",
      "second goal": "TICKER-2",
    });
    expect(index.goal).toHaveLength(2);
    expect(index.goal[0].key).toBe("first goal");
    expect(index.goal[1].key).toBe("second goal");
  });

  test("handles mixed single and multi-word keywords", () => {
    const index = buildKeywordIndex({
      Revenue: "REV",
      "net revenue": "NET-REV",
      Profit: "PROF",
    });
    expect(Object.keys(index).sort()).toEqual(["profit", "revenue"]);
    expect(index.revenue).toHaveLength(2);
    expect(index.profit).toHaveLength(1);
  });

  test("returns empty object for empty keywords", () => {
    expect(buildKeywordIndex({})).toEqual({});
  });
});

describe("findKeywordMatch", () => {
  test("matches a single-word keyword", () => {
    const index = buildKeywordIndex({ touchdown: "TD" });
    const transcript = ["the", "first", "touchdown"];
    const result = findKeywordMatch(index, transcript, "touchdown");
    expect(result).toEqual({ key: "touchdown", value: "TD" });
  });

  test("matches a multi-word keyword phrase", () => {
    const index = buildKeywordIndex({ "Home Depot": "HD" });
    const transcript = ["welcome", "to", "home", "depot"];
    const result = findKeywordMatch(index, transcript, "depot");
    expect(result).toEqual({ key: "Home Depot", value: "HD" });
  });

  test("returns null when last word matches but preceding words do not", () => {
    const index = buildKeywordIndex({ "Home Depot": "HD" });
    const transcript = ["warehouse", "depot"];
    const result = findKeywordMatch(index, transcript, "depot");
    expect(result).toBeNull();
  });

  test("returns null for an unknown word", () => {
    const index = buildKeywordIndex({ touchdown: "TD" });
    const transcript = ["some", "random", "word"];
    const result = findKeywordMatch(index, transcript, "word");
    expect(result).toBeNull();
  });

  test("returns null when transcript is shorter than keyword", () => {
    const index = buildKeywordIndex({ "three word phrase": "TWP" });
    const transcript = ["phrase"];
    const result = findKeywordMatch(index, transcript, "phrase");
    expect(result).toBeNull();
  });

  test("matches the correct keyword when multiple share a last word", () => {
    const index = buildKeywordIndex({
      "first goal": "TICKER-1",
      "second goal": "TICKER-2",
    });

    const transcript1 = ["the", "first", "goal"];
    expect(findKeywordMatch(index, transcript1, "goal")).toEqual({
      key: "first goal",
      value: "TICKER-1",
    });

    const transcript2 = ["the", "second", "goal"];
    expect(findKeywordMatch(index, transcript2, "goal")).toEqual({
      key: "second goal",
      value: "TICKER-2",
    });
  });

  test("is case-insensitive (keywords lowercased at index time)", () => {
    const index = buildKeywordIndex({ Revenue: "REV" });
    // transcript words are already lowercased by the caller
    const transcript = ["total", "revenue"];
    const result = findKeywordMatch(index, transcript, "revenue");
    expect(result).toEqual({ key: "Revenue", value: "REV" });
  });

  test("matches with exact transcript tail, not a substring", () => {
    const index = buildKeywordIndex({ "net income": "NI" });
    // "planet income" should not match "net income"
    const transcript = ["planet", "income"];
    expect(findKeywordMatch(index, transcript, "income")).toBeNull();
  });

  test("works with a long transcript", () => {
    const index = buildKeywordIndex({ "earnings per share": "EPS" });
    const transcript = Array(100).fill("filler");
    transcript.push("earnings", "per", "share");
    const result = findKeywordMatch(index, transcript, "share");
    expect(result).toEqual({ key: "earnings per share", value: "EPS" });
  });
});

describe("removeFromIndex", () => {
  test("removes a keyword from the index", () => {
    const index = buildKeywordIndex({ touchdown: "TD", "field goal": "FG" });
    removeFromIndex(index, "touchdown");
    expect(index.touchdown).toBeUndefined();
    expect(findKeywordMatch(index, ["touchdown"], "touchdown")).toBeNull();
  });

  test("only removes the specified keyword when multiple share a last word", () => {
    const index = buildKeywordIndex({
      "first goal": "T1",
      "second goal": "T2",
    });
    removeFromIndex(index, "first goal");
    expect(index.goal).toHaveLength(1);
    expect(index.goal[0].key).toBe("second goal");
  });

  test("is a no-op for a key not in the index", () => {
    const index = buildKeywordIndex({ touchdown: "TD" });
    removeFromIndex(index, "nonexistent");
    expect(index.touchdown).toHaveLength(1);
  });
});
