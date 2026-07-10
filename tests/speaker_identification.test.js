const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { getSpeakerEntities } = require("../lib/speaker_identification");

describe("getSpeakerEntities", () => {
  it('returns ["big brother houseguest"] for Big Brother cast question', () => {
    const result = getSpeakerEntities(
      "What will the cast say during Big Brother Episode 1?"
    );
    assert.deepEqual(result, ["big brother houseguest"]);
  });

  it("returns empty for null/undefined title", () => {
    assert.deepEqual(getSpeakerEntities(null), []);
    assert.deepEqual(getSpeakerEntities(undefined), []);
    assert.deepEqual(getSpeakerEntities(""), []);
  });

  it("returns ['announcer'] for announcer markets", () => {
    const result = getSpeakerEntities("Announcers at the NCAA Final");
    assert.deepEqual(result, ["announcer"]);
  });

  it("extracts custom person mappings", () => {
    assert.deepEqual(
      getSpeakerEntities("What will Powell say in the press conference?"),
      ["Jerome Powell"]
    );
    assert.deepEqual(
      getSpeakerEntities("What will Trump say at the rally?"),
      ["Donald Trump"]
    );
    assert.deepEqual(
      getSpeakerEntities("What will Bernie say about healthcare?"),
      ["Bernie Sanders"]
    );
  });

  it("extracts NLP people from titles", () => {
    const result = getSpeakerEntities(
      "What will Barack Obama say during the interview?"
    );
    assert.ok(result.length > 0);
    assert.ok(result.includes("Barack Obama"));
  });

  it("extracts regex names from title-case phrases at start", () => {
    const result = getSpeakerEntities(
      "What will Joe Biden say about the economy?"
    );
    assert.ok(result.length > 0);
    assert.ok(result.includes("Joe Biden"));
  });

  it("handles earnings call pattern", () => {
    const result = getSpeakerEntities(
      "What will Apple say during their next earnings call"
    );
    assert.deepEqual(result, ["Apple employee"]);
  });

  it("deduplicates identical entities", () => {
    // Powell matches both custom mapping and NLP
    const result = getSpeakerEntities(
      "What will Powell say during Powell interview?"
    );
    assert.equal(result.length, 1);
    assert.equal(result[0], "Jerome Powell");
  });

  it("returns custom entity before NLP fallback", () => {
    // "The Fed" is a custom mapping that should take priority over NLP
    const result = getSpeakerEntities("What will The Fed say");
    assert.deepEqual(result, ["The Fed"]);
  });

  it("deduplicates substrings", () => {
    const result = getSpeakerEntities(
      "What will Donald Trump say about Trump say during the debate?"
    );
    assert.ok(result.length <= 1);
  });
});
