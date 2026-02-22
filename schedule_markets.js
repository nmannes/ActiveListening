const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');
const logger = require('./lib/logger');

const MATCHES_FILE = 'final_markets_with_streams.json';

if (!fs.existsSync(MATCHES_FILE)) {
    console.error(`No matches found at ${MATCHES_FILE}`);
    process.exit(1);
}

const matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));

console.log(`Scheduling ${matches.length} markets...`);

matches.forEach(m => {
    // 1. Calculate start time (60 seconds before the official start)
    const startTime = new Date(m.eventStartTimeTS);
    if (startTime < new Date()) {
        console.log(`[SKIPPED] "${m.title}" - Market has already started`);
        return;
    }
    const scheduleTime = new Date(startTime.getTime());

    // 2. Format for 'at' command (HH:MM MMDDYY)
    const pad = (n) => n.toString().padStart(2, '0');
    const timeStr = `${pad(scheduleTime.getHours())}:${pad(scheduleTime.getMinutes())}`;
    const dateStr = `${pad(scheduleTime.getMonth() + 1)}${pad(scheduleTime.getDate())}${scheduleTime.getFullYear().toString().slice(-2)}`;

    // 3. Build the command
    // We pass the match data as base64 to avoid shell escaping issues
    const matchBase64 = Buffer.from(JSON.stringify(m)).toString('base64');
    const cmd = `cd ${process.cwd()} && bun run server.js --matchJSON ${matchBase64} --logFile "./logs/${m.slug}.log" --duration 1200`;

    // 4. Execute 'at'
    try {
        const atCmd = `echo '${cmd}' | at ${timeStr} ${dateStr}`;
        execSync(atCmd);
        console.log(`[SCHEDULED] "${m.title}" at ${timeStr} ${dateStr}`);
    } catch (e) {
        console.error(`Failed to schedule ${m.title}:`, e.message);
    }
});
