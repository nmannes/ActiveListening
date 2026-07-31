const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function logWarn(msg) {
  // Write warnings to stderr so stdout stays clean for JSON output
  process.stderr.write(`[classify_video] ${msg}\n`);
}

const CLASSIFICATION_SYSTEM = `You classify YouTube videos by whether they feature a specific person as a PRIMARY speaker.

Classification rules:
- "primary": The video is an interview WITH the person, a speech BY the person, a press conference featuring the person speaking, testimony BY the person, or any event where the person is a main speaker. The person's voice must be prominently featured.
- "mentioned": The video is ABOUT the person (news analysis, commentary, reaction, panel discussion) but the person does NOT speak or only appears in short clips. News reports discussing what the person said or did.
- "irrelevant": The person is not meaningfully featured or mentioned.

Key indicators of "mentioned" (NOT primary):
- Titles with "highlights", "reaction", "analysis", "recap", "summary", "breaking"
- News panel discussions about the person's actions
- Commentary/opinion videos about the person
- Videos where the title suggests someone else reacting TO the person

Key indicators of "primary":
- "Full speech", "press conference", "interview with", "testimony", "hearing"
- Videos from C-SPAN, official channels, or the person's own channel
- Long-form content (15+ minutes) with the person's name in the title

Return ONLY valid JSON in this exact format:
{"classifications": {"video_id_1": "primary", "video_id_2": "mentioned", ...}}`;

/**
 * Classify a batch of YouTube video metadata using Anthropic.
 *
 * @param {string} target - The person's full name (e.g., "Donald Trump")
 * @param {Array<{id: string, title: string, channel: string, description: string, duration_sec: number}>} videos
 * @returns {Promise<Object<string, string>>} — {video_id: "primary"|"mentioned"|"irrelevant"}
 */
async function classifyVideos(target, videos) {
  if (!videos.length) return {};

  const videoList = videos
    .map((v, i) => {
      const dur = v.duration_sec
        ? `${Math.floor(v.duration_sec / 60)}m${v.duration_sec % 60}s`
        : "unknown";
      return `[${i}] id: ${v.id}\n    title: ${v.title}\n    channel: ${v.channel}\n    duration: ${dur}\n    description: ${(v.description || "").slice(0, 200)}`;
    })
    .join("\n\n");

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: CLASSIFICATION_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Target person: "${target}"\n\nClassify each video below:\n\n${videoList}\n\nReturn the JSON classification object.`,
      },
    ],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  const content = textBlock?.text || "";

  // Parse the JSON response
  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch {}

  if (!parsed) {
    const start = content.indexOf("{");
    if (start !== -1) {
      let depth = 0,
        end = -1;
      for (let i = start; i < content.length; i++) {
        if (content[i] === "{") depth++;
        else if (content[i] === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
      if (end !== -1) {
        try {
          parsed = JSON.parse(content.slice(start, end + 1));
        } catch {}
      }
    }
  }

  if (parsed && parsed.classifications && typeof parsed.classifications === "object") {
    return parsed.classifications;
  }

  logWarn(
    `classify_video: Could not parse Claude response, defaulting all to "primary". Raw: ${content.slice(0, 200)}`,
  );
  // Fall back to all primary so pipeline still works
  const fallback = {};
  for (const v of videos) {
    fallback[v.id] = "primary";
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node classify_video.js <target_name> '<json_array>'");
    console.error("  JSON array: [{id, title, channel, description, duration_sec}, ...]");
    process.exit(1);
  }

  const target = args[0];
  let videos;
  try {
    videos = JSON.parse(args[1]);
  } catch (e) {
    console.error(`Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(videos)) {
    console.error("Second argument must be a JSON array");
    process.exit(1);
  }

  try {
    const classifications = await classifyVideos(target, videos);
    console.log(JSON.stringify({ classifications }));
  } catch (err) {
    logWarn(`classify_video failed: ${err.message}`);
    // On failure, classify all as primary so pipeline degrades gracefully
    const fallback = {};
    for (const v of videos) {
      fallback[v.id] = "primary";
    }
    console.log(JSON.stringify({ classifications: fallback }));
  }
}

// Export for use as a module
module.exports = { classifyVideos };

// Run as CLI if called directly
if (require.main === module) {
  main().catch((err) => {
    logWarn(`classify_video fatal: ${err.message}`);
    process.exit(1);
  });
}
