const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// The module resolves its library dir at require time — override it first so
// tests never touch the real ~/audio-library (os.homedir() ignores $HOME on
// Bun, so HOME alone is not enough).
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "kalshi-samples-"));
const LIBRARY = path.join(TMP, "audio-library");
process.env.AUDIO_LIBRARY_DIR = LIBRARY;

const {
  writeSampleFiles,
  nextSampleIndex,
  slugify,
  countSamples,
  hasUnsampledEntity,
} = require("../lib/speaker_confirmations");
const logger = { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} };

const file = (name) => ({
  name,
  wav_b64: Buffer.from(`wav-${name}`).toString("base64"),
  embedding_b64: Buffer.from(`emb-${name}`).toString("base64"),
});

describe("slugify", () => {
  it("mirrors the Python implementation", () => {
    assert.equal(slugify("Donald Trump"), "donald-trump");
    assert.equal(slugify("  T.J. Smith!  "), "tj-smith");
    assert.equal(slugify("Amy Coney-Barrett"), "amy-coney-barrett");
    assert.equal(slugify(""), "");
  });
});

describe("nextSampleIndex", () => {
  it("returns 0 for a fresh identity", () => {
    assert.equal(nextSampleIndex("fresh", []), 0);
  });

  it("treats a bare slug as index 0 and continues after the highest suffix", () => {
    const entries = ["bob.wav", "bob.embedding", "bob-1.wav", "bob-2.embedding", "alice-5.embedding"];
    assert.equal(nextSampleIndex("bob", entries), 3);
    assert.equal(nextSampleIndex("alice", entries), 6);
  });

  it("ignores unrelated files", () => {
    assert.equal(nextSampleIndex("bob", ["bobby-3.wav", "notes.txt"]), 0);
  });
});

describe("writeSampleFiles", () => {
  before(() => fs.mkdirSync(LIBRARY, { recursive: true }));

  it("writes wav + embedding pairs", () => {
    const written = writeSampleFiles([file("bob-0")], logger);
    assert.equal(written, 1);
    assert.equal(fs.readFileSync(path.join(LIBRARY, "bob-0.wav"), "utf8"), "wav-bob-0");
    assert.equal(fs.readFileSync(path.join(LIBRARY, "bob-0.embedding"), "utf8"), "emb-bob-0");
  });

  it("resolves collisions with the next free suffix", () => {
    const written = writeSampleFiles([file("bob-0")], logger);
    assert.equal(written, 1);
    assert.equal(fs.readFileSync(path.join(LIBRARY, "bob-1.wav"), "utf8"), "wav-bob-0");
  });

  it("skips malformed entries", () => {
    assert.equal(writeSampleFiles([{ name: "carol-0", wav_b64: "", embedding_b64: "" }], logger), 0);
    assert.equal(writeSampleFiles([], logger), 0);
    assert.equal(writeSampleFiles(undefined, logger), 0);
    assert.ok(!fs.existsSync(path.join(LIBRARY, "carol-0.wav")));
  });

  it("ignores path components in names", () => {
    writeSampleFiles([file("../../evil")], logger);
    assert.ok(fs.existsSync(path.join(LIBRARY, "evil.wav")));
    assert.ok(!fs.existsSync(path.join(TMP, "evil.wav")));
  });
});

describe("countSamples / hasUnsampledEntity", () => {
  it("counts bare and suffixed embeddings", () => {
    assert.equal(countSamples("bob"), 2); // bob-0, bob-1
    assert.equal(countSamples("nobody"), 0);
  });

  it("flags sessions with at least one entity lacking a sample", () => {
    assert.equal(hasUnsampledEntity(["bob", "nobody"]), true);
    assert.equal(hasUnsampledEntity(["bob", "Alice Person"]), true);
    assert.equal(hasUnsampledEntity([]), false);
    assert.equal(hasUnsampledEntity(null), false);
  });

  after(() => fs.rmSync(TMP, { recursive: true, force: true }));
});
