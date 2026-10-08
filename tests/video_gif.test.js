const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  startVideoGif,
  extractStrategy,
  scanFrames,
  evictRing,
  selectFrames,
  gifLadder,
  gifArgs,
  gifMessage,
  CAPTURE_FPS,
} = require("../lib/video_gif");

const jpeg = (payload = "x".repeat(10)) =>
  Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from(payload), Buffer.from([0xff, 0xd9])]);

describe("extractStrategy", () => {
  it("detects YouTube page URLs", () => {
    assert.equal(extractStrategy("https://www.youtube.com/watch?v=abc"), "youtube");
    assert.equal(extractStrategy("https://youtube.com/live/abc"), "youtube");
    assert.equal(extractStrategy("https://youtu.be/abc"), "youtube");
  });

  it("detects direct media URLs", () => {
    assert.equal(extractStrategy("http://localhost:9981/stream/channel1"), "direct");
    assert.equal(extractStrategy("https://cdn.example.com/live/foo.m3u8?token=1"), "direct");
    assert.equal(extractStrategy("https://cdn.example.com/vod/clip.mp4"), "direct");
  });

  it("returns null for page-based / DRM sources", () => {
    assert.equal(extractStrategy("https://www.peacocktv.com/watch"), null);
    assert.equal(extractStrategy("https://www.espn.com/watch/player"), null);
    assert.equal(extractStrategy(""), null);
    assert.equal(extractStrategy(undefined), null);
  });

  it("startVideoGif refuses unsupported sources without spawning", () => {
    assert.equal(startVideoGif({ streamUrl: "https://www.hulu.com/watch", logger: {} }), null);
  });
});

describe("scanFrames", () => {
  it("extracts a whole JPEG from one chunk", () => {
    const frame = jpeg();
    const { frames, rest } = scanFrames(Buffer.alloc(0), frame);
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], frame);
    assert.equal(rest.length, 0);
  });

  it("reassembles a JPEG split across chunks", () => {
    const frame = jpeg();
    const first = scanFrames(Buffer.alloc(0), frame.slice(0, 6));
    assert.equal(first.frames.length, 0);
    const second = scanFrames(first.rest, frame.slice(6));
    assert.equal(second.frames.length, 1);
    assert.deepEqual(second.frames[0], frame);
  });

  it("extracts multiple frames and skips leading junk", () => {
    const frame = jpeg();
    const { frames, rest } = scanFrames(Buffer.alloc(0),
      Buffer.concat([Buffer.from([0x00, 0x11]), frame, frame]));
    assert.equal(frames.length, 2);
    assert.deepEqual(frames[0], frame);
    assert.deepEqual(frames[1], frame);
    assert.equal(rest.length, 0);
  });

  it("drops an EOI with no preceding SOI", () => {
    const frame = jpeg();
    const { frames } = scanFrames(Buffer.alloc(0),
      Buffer.concat([Buffer.from([0xff, 0xd9, 0x00, 0x00]), frame]));
    assert.equal(frames.length, 1);
    assert.deepEqual(frames[0], frame);
  });
});

describe("evictRing", () => {
  const now = 1_000_000;

  it("drops frames older than bufferSecs", () => {
    const ring = [];
    for (let i = 0; i < 10; i++) ring.push({ ts: now - (10 - i) * 1000, data: Buffer.alloc(100) });
    evictRing(ring, now, { bufferSecs: 5, maxBytes: 1e9 });
    assert.equal(ring.length, 5); // ts >= now-5000 kept
    assert.equal(ring[0].ts, now - 5000);
  });

  it("drops the oldest frames past the byte cap but keeps a minimum", () => {
    const ring = []; // oldest first, like the capture loop appends them
    for (let i = 0; i < 10; i++) ring.push({ ts: now - (10 - i) * 100, data: Buffer.alloc(100) });
    evictRing(ring, now, { bufferSecs: 1e9, maxBytes: 250 });
    assert.equal(ring.length, 3); // MIN_FRAMES floor
    assert.equal(ring[0].ts, now - 300);
    assert.equal(ring[2].ts, now - 100);
  });
});

describe("selectFrames", () => {
  const now = 1_000_000;
  const ring = [];
  for (let i = 0; i <= 30; i++) ring.push({ ts: now - i * 1000, data: Buffer.alloc(1) });

  it("selects the requested age window and pads for pipeline skew", () => {
    const frames = selectFrames(ring, now, { ageNewest: 0, ageOldest: 10, padSecs: 2 });
    assert.equal(frames.length, 13); // [now-12s, now]
  });

  it("clamps the span to maxSpanSecs plus pad", () => {
    const frames = selectFrames(ring, now, {
      ageNewest: 0, ageOldest: 100, padSecs: 2, maxSpanSecs: 20,
    });
    assert.equal(frames.length, 23); // [now-22s, now]
  });

  it("never reaches into the future for a fresh window", () => {
    const frames = selectFrames(ring, now, { ageNewest: 1, ageOldest: 3, padSecs: 0 });
    assert.ok(frames.every((f) => f.ts <= now));
  });
});

describe("gifLadder", () => {
  it("starts at the requested quality and degrades", () => {
    assert.deepEqual(gifLadder(4, 320).map((r) => [r.scale, r.fps]), [
      [1, 4], [1, 2], [0.75, 2], [0.5, 2],
    ]);
  });

  it("never goes below 1 fps", () => {
    assert.ok(gifLadder(1, 320).every((r) => r.fps >= 1));
  });
});

describe("gifArgs", () => {
  it("builds a single-pass palette GIF to stdout", () => {
    const args = gifArgs({ fps: 4, width: 320, scale: 0.75 });
    const vf = args[args.indexOf("-vf") + 1];
    assert.match(vf, /scale=240:-2/);
    assert.match(vf, /palettegen/);
    assert.match(vf, /paletteuse/);
    assert.equal(args[args.indexOf("-framerate") + 1], String(CAPTURE_FPS));
    assert.equal(args[args.length - 1], "pipe:1");
  });

  it("keeps the scaled width even (h264/mjpeg-safe)", () => {
    for (const width of [320, 321, 319]) {
      const args = gifArgs({ fps: 4, width, scale: 1.0 });
      const vf = args[args.indexOf("-vf") + 1];
      const scaled = Number(/scale=(\d+):/.exec(vf)[1]);
      assert.equal(scaled % 2, 0, `width ${width} -> ${scaled}`);
    }
  });
});

describe("gifMessage", () => {
  it("matches the server's 0x02 GIF1 u32 req_id layout", () => {
    const msg = gifMessage(0x01020304, Buffer.from("GIFDATA"));
    assert.equal(msg[0], 0x02);
    assert.equal(msg.slice(1, 5).toString("ascii"), "GIF1");
    assert.equal(msg.readUInt32BE(5), 0x01020304);
    assert.equal(msg.slice(9).toString(), "GIFDATA");
  });

  it("wraps large req_ids safely", () => {
    const msg = gifMessage(0xffffffff, Buffer.from("g"));
    assert.equal(msg.readUInt32BE(5), 0xffffffff);
  });
});
