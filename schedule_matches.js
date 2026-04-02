const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const scheduledDir = path.join(__dirname, 'scheduled');
execSync(`mkdir -p ${scheduledDir}`);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const youtubeOnly = args.includes('--youtube-only');
let lookaheadHours = 20;
const lookaheadIdx = args.indexOf('--lookahead');
if (lookaheadIdx !== -1 && args[lookaheadIdx + 1]) {
    lookaheadHours = parseFloat(args[lookaheadIdx + 1]);
}
const lookaheadMs = lookaheadHours * 60 * 60 * 1000;

const cacheFile = path.join('cache', 'matched_markets.json');
if (!fs.existsSync(cacheFile)) {
    console.error(`Cache file ${cacheFile} not found`);
    process.exit(1);
}

const now = new Date();
const lookaheadLimit = new Date(now.getTime() + lookaheadMs);

// ── 1. Load existing scheduled server windows ───────────────────────
const serverWindows = []; // Array of { start: Date, end: Date }
const scheduledFiles = fs.readdirSync(scheduledDir).filter(f => f.endsWith('.json'));

for (const f of scheduledFiles) {
    try {
        const data = JSON.parse(fs.readFileSync(path.join(scheduledDir, f), 'utf8'));
        if (data.eventStartTime && !data.clientOnly) {
            const start = new Date(data.eventStartTime);
            const duration = data.serverDuration || 75;
            // Launch is T-10m, Shutdown is Launch + (duration + 10m) = T + duration
            serverWindows.push({
                start: new Date(start.getTime() - 10 * 60 * 1000),
                end: new Date(start.getTime() + duration * 60 * 1000)
            });
        }
    } catch (e) {
        console.error(`Error reading ${f}: ${e.message}`);
    }
}

// ── 2. Collect and sort candidate markets ────────────────────────────
const matches = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
const candidates = [];

for (const match of matches) {
    const { market, tvEvent, espnEvent, ncaaEvent } = match;

    const streamURL = tvEvent?.channelURL || espnEvent?.link || market?.mediaStreamURL || null;

    if (youtubeOnly && !(streamURL && (streamURL.includes('youtube.com') || streamURL.includes('youtu.be')))) continue;

    let scheduleStartTime = ncaaEvent?.time || espnEvent?.startTimestamp || market?.eventStartTime || null;

    if (streamURL && scheduleStartTime) {
        let startTime = new Date(scheduleStartTime);
        let alreadyStarted = false;
        if (startTime <= now) {
            alreadyStarted = true;
            startTime = new Date(Date.now() + 5 * 1000); // 5s buffer
        }

        if (startTime <= lookaheadLimit) {
            market.mediaStreamURL = streamURL;
            market.eventStartTime = startTime;
            market.alreadyStarted = alreadyStarted;
            candidates.push(market);
        }
    }
}

candidates.sort((a, b) => new Date(a.eventStartTime) - new Date(b.eventStartTime));

// ── 3. Group into Sequences ─────────────────────────────────────────
const sequences = [];
let currentSequence = null;

for (const m of candidates) {
    if (!currentSequence) {
        currentSequence = [m];
    } else {
        const lastM = currentSequence[currentSequence.length - 1];
        const gapMinutes = (new Date(m.eventStartTime) - new Date(lastM.eventStartTime)) / 60000;

        // Group if starts within 60 minutes of the previous one
        if (gapMinutes <= 60) {
            currentSequence.push(m);
        } else {
            sequences.push(currentSequence);
            currentSequence = [m];
        }
    }
}
if (currentSequence) sequences.push(currentSequence);

// ── 4. Process Sequences ─────────────────────────────────────────────
for (const seq of sequences) {
    // Calculate optimal server window for the entire sequence
    const firstM = seq[0];
    const lastM = seq[seq.length - 1];

    const seqStart = new Date(firstM.eventStartTime);
    const seqLastStart = new Date(lastM.eventStartTime);

    // Server should launch 10m before first and shut down 75m after last starts
    const overallLaunch = new Date(seqStart.getTime() - 10 * 60 * 1000);
    const overallShutdown = new Date(seqLastStart.getTime() + 75 * 60 * 1000);
    const optimizedDuration = Math.ceil((overallShutdown - overallLaunch) / 60000) - 10;

    let seqServerWindow = null;

    for (const market of seq) {
        const startTime = new Date(market.eventStartTime);
        const slug = market.slug;
        const newFile = path.join(scheduledDir, `${slug}.json`);

        if (fs.existsSync(newFile)) {
            console.log(`Skipping ${market.title} - already scheduled`);
            // If this was the server-starter, we should still track its window
            if (!market.clientOnly) {
                // Actually, we already loaded existing windows in Step 1
            }
            continue;
        }

        // Check if we can reuse an existing server window (from previous runs or current sequence)
        const estimatedEndTime = new Date(startTime.getTime() + 60 * 60 * 1000);
        let reusableWindow = serverWindows.find(w => w.start <= startTime && w.end >= estimatedEndTime);

        if (!reusableWindow && seqServerWindow) {
            if (seqServerWindow.start <= startTime && seqServerWindow.end >= estimatedEndTime) {
                reusableWindow = seqServerWindow;
            }
        }

        let clientOnly = market.alreadyStarted || !!reusableWindow;
        let serverDuration = clientOnly ? 0 : optimizedDuration;

        if (dryRun) {
            console.log(`[DRY-RUN] Market: ${market.title}`);
            console.log(`          Event:   ${startTime.toLocaleString()}`);
            console.log(`          Mode:    ${clientOnly ? (reusableWindow ? 'REUSE Server (Client Only)' : 'Client Only (Started)') : 'NEW Server (Full Run)'}`);
            if (!clientOnly) {
                console.log(`          Server:  Launch at ${overallLaunch.toLocaleTimeString()}, Shutdown at ${overallShutdown.toLocaleTimeString()} (${optimizedDuration + 10}m total)`);
                seqServerWindow = { start: overallLaunch, end: overallShutdown };
            } else if (reusableWindow) {
                console.log(`          Using:   Existing server window (${reusableWindow.start.toLocaleTimeString()} - ${reusableWindow.end.toLocaleTimeString()})`);
            }
            console.log('');
            continue;
        }

        // Prepare market file
        if (market.keywords) delete market['keywords']['event does not qualify'];
        market.clientOnly = clientOnly;
        market.serverDuration = serverDuration;
        fs.writeFileSync(newFile, JSON.stringify(market, null, 2));

        let cmd = `/home/nathan/kalshi/schedule_run.sh ${newFile} --duration ${serverDuration || 75}`;
        if (clientOnly) {
            cmd += " --client-only";
        }

        try {
            console.log(`Scheduling ${market.title} for ${startTime.toLocaleString()}`);
            console.log(`          Mode:   ${clientOnly ? (reusableWindow ? 'REUSE Server' : 'Client Only') : 'NEW Server'}`);
            if (!clientOnly) {
                console.log(`          Server: Launch at ${overallLaunch.toLocaleTimeString()}, Shutdown at ${overallShutdown.toLocaleTimeString()} (${optimizedDuration + 10}m total)`);
            }

            execSync(cmd);

            if (!clientOnly) {
                seqServerWindow = { start: overallLaunch, end: overallShutdown };
            }
            console.log('');
        } catch (e) {
            console.error(`Failed to schedule ${market.title}: ${e.message}`);
        }
    }
}