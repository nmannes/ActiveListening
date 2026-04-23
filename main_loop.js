const { spawn } = require("child_process");
const path = require("path");

const SCHEDULER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DISCOVERY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`[${new Date().toISOString()}] Running ${scriptName} ${args.join(" ")}...`);
        const proc = spawn(process.execPath, ["run", scriptName, ...args], {
            cwd: __dirname,
            stdio: "inherit"
        });

        proc.on("close", (code) => {
            if (code === 0) {
                console.log(`[${new Date().toISOString()}] ${scriptName} completed successfully.`);
                resolve();
            } else {
                console.error(`[${new Date().toISOString()}] ${scriptName} failed with code ${code}.`);
                reject(new Error(`${scriptName} failed`));
            }
        });
    });
}

async function start() {
    console.log("Starting Kalshi Main Event Loop...");

    // 1. Start UI Server in background
    console.log("Starting Market Manager UI...");
    const uiProc = spawn(process.execPath, ["run", "market_ui.js"], {
        cwd: __dirname,
        stdio: "inherit"
    });

    uiProc.on("error", (err) => {
        console.error("Failed to start UI server:", err);
    });

    // 2. Initial Discovery Run
    try {
        await runScript("e2e_discovery.js");
    } catch (e) {
        console.error("Initial discovery failed, but continuing loop...");
    }

    // 3. Initial Scheduling Run
    try {
        await runScript("schedule_matches.js");
    } catch (e) {
        console.error("Initial scheduling failed, but continuing loop...");
    }

    // 4. Setup Intervals
    setInterval(async () => {
        try {
            await runScript("schedule_matches.js");
        } catch (e) {
            console.error("Scheduled matching run failed:", e);
        }
    }, SCHEDULER_INTERVAL_MS);

    setInterval(async () => {
        try {
            await runScript("e2e_discovery.js");
            // Always follow discovery with scheduling to pick up new matches
            await runScript("schedule_matches.js");
        } catch (e) {
            console.error("Scheduled discovery run failed:", e);
        }
    }, DISCOVERY_INTERVAL_MS);

    console.log("Main loop active. Scheduling runs every 15m, Discovery every 60m.");
}

start().catch(err => {
    console.error("Fatal error in main loop:", err);
    process.exit(1);
});
