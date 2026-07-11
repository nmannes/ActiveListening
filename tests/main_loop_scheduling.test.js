const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// ── Pure decision logic extracted from scheduleNextFromRedis ──────────
// Mirrors the logic in main_loop.js without side effects or infinite loop.

const POLL_INTERVAL_MS = 60_000;
const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Given a raw Redis value and the current time, returns:
 *   shouldRun: true if the scheduling loop should fire now
 *   nextTime:  the value to SET in Redis after running
 *   sleepMs:   how long to sleep before re-checking (0 if shouldRun)
 */
function evaluateNextScrape(raw, now) {
  const nextTime = raw ? parseInt(raw, 10) : 0;
  const remaining = nextTime - now;

  if (remaining <= 0) {
    return {
      shouldRun: true,
      nextTime: now + DEFAULT_INTERVAL_MS,
      sleepMs: 0,
    };
  }

  return {
    shouldRun: false,
    nextTime, // unchanged, already in the future
    sleepMs: Math.min(remaining, POLL_INTERVAL_MS),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("evaluateNextScrape", () => {
  it("runs immediately when key is missing (raw is null/undefined)", () => {
    const now = Date.now();
    const result = evaluateNextScrape(null, now);

    assert.equal(result.shouldRun, true);
    assert.ok(result.nextTime > now);
    assert.equal(result.nextTime, now + DEFAULT_INTERVAL_MS);
    assert.equal(result.sleepMs, 0);
  });

  it("runs immediately when stored time is in the past", () => {
    const now = Date.now();
    const pastTime = now - 600_000; // 10 minutes ago
    const result = evaluateNextScrape(String(pastTime), now);

    assert.equal(result.shouldRun, true);
    assert.equal(result.nextTime, now + DEFAULT_INTERVAL_MS);
  });

  it("runs immediately when stored time is exactly now", () => {
    const now = Date.now();
    const result = evaluateNextScrape(String(now), now);

    assert.equal(result.shouldRun, true);
  });

  it("does NOT run when the stored time is in the future", () => {
    const now = Date.now();
    const futureTime = now + 30 * 60 * 1000; // 30 minutes from now
    const result = evaluateNextScrape(String(futureTime), now);

    assert.equal(result.shouldRun, false);
    assert.equal(result.nextTime, futureTime); // unchanged
  });

  it("sleeps for the full remaining time when it fits within POLL_INTERVAL_MS", () => {
    const now = Date.now();
    const futureTime = now + 45_000; // 45 seconds from now
    const result = evaluateNextScrape(String(futureTime), now);

    assert.equal(result.shouldRun, false);
    assert.equal(result.sleepMs, 45_000);
  });

  it("caps sleep at POLL_INTERVAL_MS when remaining is larger", () => {
    const now = Date.now();
    const futureTime = now + DEFAULT_INTERVAL_MS; // 1 hour from now
    const result = evaluateNextScrape(String(futureTime), now);

    assert.equal(result.shouldRun, false);
    assert.equal(result.sleepMs, POLL_INTERVAL_MS); // capped at 60s
  });

  it("nextTime advances by exactly DEFAULT_INTERVAL_MS (1 hour) after each run", () => {
    const now = 1_750_000_000_000; // fixed timestamp
    const result = evaluateNextScrape(null, now);

    assert.equal(result.shouldRun, true);
    assert.equal(result.nextTime, now + DEFAULT_INTERVAL_MS);
    assert.equal(result.nextTime - now, 3_600_000); // exactly 1 hour
  });
});

// ── Integration: simulate the Redis-driven loop over multiple cycles ──

describe("scheduleNextFromRedis (simulated loop)", () => {
  let redisStore;
  let runCount;

  // Mock Redis with an in-memory store
  function createMockConnection() {
    return {
      get: async (key) => redisStore[key] || null,
      set: async (key, value) => { redisStore[key] = String(value); },
    };
  }

  // Single iteration of the loop logic (extracted for testing)
  async function tick(connection) {
    const raw = await connection.get("kalshi:next_scrape_time");
    const result = evaluateNextScrape(raw, Date.now());

    if (result.shouldRun) {
      runCount++;
      await connection.set("kalshi:next_scrape_time", result.nextTime);
      return { ran: true, sleepMs: 0 };
    }
    return { ran: false, sleepMs: result.sleepMs };
  }

  beforeEach(() => {
    redisStore = {};
    runCount = 0;
  });

  it("runs immediately on first tick when Redis is empty", async () => {
    const conn = createMockConnection();
    const { ran } = await tick(conn);

    assert.equal(ran, true);
    assert.equal(runCount, 1);
    assert.ok(redisStore["kalshi:next_scrape_time"]);
  });

  it("sets next time 1 hour ahead after running", async () => {
    const conn = createMockConnection();
    const before = Date.now();
    await tick(conn);

    const nextTime = parseInt(redisStore["kalshi:next_scrape_time"], 10);
    assert.ok(nextTime >= before + DEFAULT_INTERVAL_MS - 1000);
    assert.ok(nextTime <= before + DEFAULT_INTERVAL_MS + 1000);
  });

  it("does NOT run again immediately after a run (next time is in the future)", async () => {
    const conn = createMockConnection();

    await tick(conn); // first tick: runs
    assert.equal(runCount, 1);

    const { ran } = await tick(conn); // second tick: should NOT run
    assert.equal(ran, false);
    assert.equal(runCount, 1); // unchanged
  });

  it("runs again once the next-scrape time has passed", async () => {
    // Seed with a past time so the next tick runs
    redisStore["kalshi:next_scrape_time"] = String(Date.now() - 1000);
    const conn = createMockConnection();

    const { ran } = await tick(conn);
    assert.equal(ran, true);
    assert.equal(runCount, 1);
  });

  it("runs exactly once per hour in a fast-forward simulation", async () => {
    const conn = createMockConnection();
    let fakeNow = 1_750_000_000_000;

    // Override evaluateNextScrape usage locally with the fake clock
    for (let cycle = 0; cycle < 5; cycle++) {
      const raw = await conn.get("kalshi:next_scrape_time");
      const result = evaluateNextScrape(raw, fakeNow);

      if (result.shouldRun) {
        runCount++;
        await conn.set("kalshi:next_scrape_time", result.nextTime);
        // The next scrape time should be fakeNow + 1 hour
        assert.equal(result.nextTime, fakeNow + DEFAULT_INTERVAL_MS);
      }
      // Advance clock by 1 hour + 1ms to trigger next cycle
      fakeNow += DEFAULT_INTERVAL_MS + 1;
    }

    assert.equal(runCount, 5);
  });

  it("does not miss a run when key is externally deleted between cycles", async () => {
    const conn = createMockConnection();
    const fakeNow = Date.now();

    // First run sets the key
    const r1 = evaluateNextScrape(null, fakeNow);
    assert.equal(r1.shouldRun, true);
    await conn.set("kalshi:next_scrape_time", r1.nextTime);

    // Key gets deleted externally
    delete redisStore["kalshi:next_scrape_time"];

    // Next check sees missing key → runs immediately
    const r2 = evaluateNextScrape(
      await conn.get("kalshi:next_scrape_time"),
      fakeNow + 1000,
    );
    assert.equal(r2.shouldRun, true, "should run when key is deleted");
  });
});
