const fs = require('fs');
const { execSync } = require('child_process');
const { args } = require('./lib/args');

const MATCHES_FILE = args.fromFile || 'final_markets_with_streams.json';

if (!fs.existsSync(MATCHES_FILE)) {
    console.error(`No matches found at ${MATCHES_FILE}`);
    process.exit(1);
}

let matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));
if (!Array.isArray(matches)) {
    matches = [matches];
}

console.log(`Scheduling ${matches.length} markets...`);

matches.forEach(m => {
    // 1. Calculate start time (60 seconds before the official start)
    const startTime = new Date(m.eventStartTime);
    if (startTime < new Date()) {
        console.log(`[SKIPPED] "${m.title}" - Market has already started`);
        return;
    }

    // 2. Format for 'at' command (HH:MM MMDDYY)
    const pad = (n) => n.toString().padStart(2, '0');
    const timeStr = `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`;
    const dateStr = `${pad(startTime.getMonth() + 1)}${pad(startTime.getDate())}${startTime.getFullYear().toString().slice(-2)}`;

    // 3. Build the command
    // We pass the match data as base64 to avoid shell escaping issues
    const matchBase64 = Buffer.from(JSON.stringify(m)).toString('base64');

    const cmd = [
        "cd", process.cwd(), "&&",
        "bun run server.js",
        args.fromFile ? "--fromFile" : "--matchJSON",
        args.fromFile ? args.fromFile : matchBase64,
        "--logFile", `"./logs/${m.slug}.log"`,
        "--duration", "1200"
    ].join(' ');

    // 4. Execute 'at'
    try {
        const atCmd = `echo '${cmd}' | at ${timeStr} ${dateStr}`;
        execSync(atCmd);
        console.log(`[SCHEDULED] "${m.title}" at ${timeStr} ${dateStr}`);
    } catch (e) {
        console.error(`Failed to schedule ${m.title}:`, e.message);
    }
});
