/**
 * speaker_confirmations.js — Redis→WS bridge for live speaker asks.
 *
 * The operator answers a speaker ask in Telegram; telegram_server (Python,
 * local) pushes the answer onto the Redis list `speaker_confirm:<slug>`.
 * This poller runs inside client.js — same box as Redis and the WebSocket —
 * BRPOPs that list, and forwards the answer to the EC2 server, which applies
 * the label / whitelist / sample curation.
 *
 * It also writes the curated sample files the server pushes back
 * (`sample_saved`): the local box is the library of record, so these are the
 * only new library files written anywhere.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const Redis = require("ioredis");

// AUDIO_LIBRARY_DIR exists for tests (and ops) — os.homedir() can't be
// redirected via $HOME on every runtime, and tests must never write into the
// real library.
const AUDIO_LIBRARY = process.env.AUDIO_LIBRARY_DIR
  ? path.resolve(process.env.AUDIO_LIBRARY_DIR)
  : path.join(os.homedir(), "audio-library");
// Confirmations older than this are dropped — e.g. pushed while the client
// was disconnected and arriving after a later session started.
const STALE_MS = 120_000;
const WS_OPEN = 1; // ws.OPEN

function stripExt(name) {
  return String(name || "").replace(/\.(wav|embedding)$/i, "");
}

function baseSlug(stem) {
  return stem.replace(/-\d+$/, "");
}

/** Mirrors pylib/sample_library.py::slugify. */
function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Number of stored samples for an identity (mirrors sample_library.count_samples). */
function countSamples(slug) {
  if (!slug || !fs.existsSync(AUDIO_LIBRARY)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(AUDIO_LIBRARY)) {
    if (!/\.embedding$/i.test(entry)) continue;
    const stem = stripExt(entry);
    if (stem === slug || stem.startsWith(slug + "-")) count += 1;
  }
  return count;
}

/**
 * True when at least one session entity has no library sample — the state in
 * which a speaker ask (and therefore a video GIF) is likely.  Used to decide
 * whether a session is worth a frame-capture pipeline at all.
 */
function hasUnsampledEntity(entities) {
  if (!Array.isArray(entities)) return false;
  return entities.some((entity) => countSamples(slugify(entity)) === 0);
}

/** Next free numeric suffix for an identity — mirrors pylib/sample_library.py. */
function nextSampleIndex(slug, entries) {
  let next = 0;
  for (const entry of entries) {
    if (!/\.(wav|embedding)$/i.test(entry)) continue;
    const stem = stripExt(entry);
    if (stem === slug) {
      next = Math.max(next, 1);
    } else if (stem.startsWith(slug + "-")) {
      const n = parseInt(stem.slice(slug.length + 1), 10);
      if (Number.isInteger(n)) next = Math.max(next, n + 1);
    }
  }
  return next;
}

/**
 * Write curated voice samples to ~/audio-library (collision-safe names).
 * `files`: [{name, wav_b64, embedding_b64}]. Returns number of samples written.
 */
function writeSampleFiles(files, logger) {
  if (!Array.isArray(files) || files.length === 0) return 0;
  fs.mkdirSync(AUDIO_LIBRARY, { recursive: true });
  const entries = fs.readdirSync(AUDIO_LIBRARY);
  let written = 0;
  for (const file of files) {
    let stem = stripExt(path.basename(String(file.name || "")));
    if (!stem) continue;
    const wav = Buffer.from(file.wav_b64 || "", "base64");
    const embedding = Buffer.from(file.embedding_b64 || "", "base64");
    if (!wav.length || !embedding.length) {
      logger.warn(`[samples] skipping malformed sample ${stem}`);
      continue;
    }
    if (
      entries.includes(`${stem}.wav`) ||
      entries.includes(`${stem}.embedding`)
    ) {
      stem = `${baseSlug(stem)}-${nextSampleIndex(baseSlug(stem), entries)}`;
    }
    fs.writeFileSync(path.join(AUDIO_LIBRARY, `${stem}.wav`), wav);
    fs.writeFileSync(path.join(AUDIO_LIBRARY, `${stem}.embedding`), embedding);
    entries.push(`${stem}.wav`, `${stem}.embedding`);
    written += 1;
    logger.info(`[samples] wrote ${stem}.wav + ${stem}.embedding`);
  }
  return written;
}

/**
 * Start the BRPOP→WS relay for a session. `getWs` returns the current socket
 * (reconnects replace it). Returns { stop() }.
 */
function startSpeakerConfirmations({ slug, getWs, logger }) {
  const key = `speaker_confirm:${slug}`;
  const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    maxRetriesPerRequest: null,
  });
  let stopped = false;

  (async () => {
    // Drop confirmations left over from a previous run of this slug.
    try {
      await redis.del(key);
    } catch (e) {
      logger.warn(`[speaker-confirm] could not clear ${key}: ${e.message}`);
    }

    while (!stopped) {
      let item;
      try {
        item = await redis.brpop(key, 0);
      } catch (e) {
        if (stopped) break;
        logger.warn(`[speaker-confirm] BRPOP failed: ${e.message}`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      if (!item) continue;

      let payload;
      try {
        payload = JSON.parse(item[1]);
      } catch {
        continue;
      }
      if (Date.now() - (payload.ts || 0) > STALE_MS) {
        logger.warn(`[speaker-confirm] dropping stale answer for speaker ${payload.spk}`);
        continue;
      }

      const ws = getWs();
      if (!ws || ws.readyState !== WS_OPEN) {
        logger.warn("[speaker-confirm] websocket not open — answer dropped");
        continue;
      }
      try {
        ws.send(
          JSON.stringify({
            type: "speaker_confirmed",
            slug,
            spk: String(payload.spk),
            action: payload.action,
            idx: payload.idx,
            entity: payload.entity,
          }),
        );
        logger.info(
          `[speaker-confirm] forwarded '${payload.action}' for speaker ${payload.spk}`,
        );
      } catch (e) {
        logger.error(`[speaker-confirm] send failed: ${e.message}`);
      }
    }
  })();

  return {
    stop() {
      stopped = true;
      try {
        redis.disconnect();
      } catch {
        /* best-effort */
      }
    },
  };
}

module.exports = {
  startSpeakerConfirmations,
  writeSampleFiles,
  nextSampleIndex,
  slugify,
  countSamples,
  hasUnsampledEntity,
};
