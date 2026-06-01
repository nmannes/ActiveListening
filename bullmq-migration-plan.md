# Migrate from `at` to BullMQ + Bull Board

## Context

The current system uses Unix `at` to schedule one-shot jobs (launch GPU server, run client, sync logs). There's no visibility into pending/active/failed jobs beyond raw `atq` output, no retry mechanism, and no dashboard. The user wants a Sidekiq-like queue system with a UI, running on the **existing persistent server** (the box where `main_loop.js` and `market_ui.js` already run).

## Approach

BullMQ + Bull Board, co-located on the existing server. Redis runs locally. Bull Board mounts into the existing Express server (`market_ui.js`) on port 3000.

## What changes

### 1. Install Redis on the persistent server

- `sudo apt-get install redis-server`
- Bind to localhost only (no external exposure)
- Enable systemd so it survives reboots

### 2. Add npm packages

- `bullmq` — job queue (delayed jobs, retries, priorities)
- `@bull-board/express` + `@bull-board/api` — dashboard UI
- `ioredis` — Redis client (peer dep of bullmq, works with bun)

### 3. Create `lib/queues.js` — queue definitions

Three queues:

| Queue | Purpose | Replaces |
|---|---|---|
| `gpu-server` | Launch GPU EC2 instance at T-10m | `at` job in schedule_run.sh:139 |
| `run-client` | Execute client.js at event start | `at` job in schedule_run.sh:151 |
| `log-sync` | Sync logs 5m after client exit | `at` job in client.js:361 |

Exports: `gpuServerQueue`, `runClientQueue`, `logSyncQueue`.

### 4. Create `worker.js` — processes jobs from all three queues

One worker process that handles all three queues. Each job type maps to the same shell command currently invoked via `at`:

- `launch-gpu-server` — `execSync("launch_gpu_server.sh prod --shutdown-minutes N")`
- `run-client` — `execSync("bun run client.js --fromFile <file> --duration N [--browser]")`
- `sync-logs` — `execSync("sync_logs.sh <uuid> --slug <id>")`

Worker concurrency: 1 per queue type (preserves the existing single-job-at-a-time behavior).

### 5. Mount Bull Board UI into `market_ui.js`

- Add `GET /admin/queues` route that serves Bull Board
- Can also be mounted at `/queues` — add a link from the existing market UI

### 6. Modify `schedule_matches.js` — enqueue instead of `execSync(cmd)`

Current flow (lines 478-559): builds a shell command string and calls `execSync(cmd)` which invokes `schedule_run.sh`, which in turn pipes into `at`.

New flow: instead of building a shell command, directly enqueue:
- A `gpu-server` job delayed until T-10m (unless `--client-only`)
- A `run-client` job delayed until event start time

The job data contains all the info currently passed as CLI flags: market JSON file path, duration, server-duration, browser flag, etc.

### 7. Modify `schedule_run.sh` — remove `at` logic

Strip out the `at` job creation (lines 139-152). The script's other logic (argument parsing, path resolution) can stay or be inlined into `schedule_matches.js`. The simplest path: keep `schedule_run.sh` for its arg parsing but have it call a new JS function that enqueues instead of piping to `at`.

Alternatively, bypass `schedule_run.sh` entirely from `schedule_matches.js` and enqueue BullMQ jobs directly.

### 8. Modify `client.js` — replace `at now + 5 minutes` with BullMQ delayed job

Current line 361: `execSync("echo ... | at now + 5 minutes")`
New: `logSyncQueue.add("sync-logs", { runUUID, sessionId }, { delay: 5 * 60 * 1000 })`

### 9. Update `main_loop.js` — spawn worker process

Add `worker.js` to the list of processes spawned by `main_loop.js` so it runs persistently alongside `market_ui.js`.

### 10. Remove `latq.sh` (or repurpose it)

The `latq.sh` script lists pending `at` jobs. Can be removed since Bull Board provides a real UI.

## Files to modify

| File | Change |
|---|---|
| `package.json` | Add bullmq, @bull-board/express, @bull-board/api, ioredis |
| `lib/queues.js` | **NEW** — queue definitions |
| `worker.js` | **NEW** — BullMQ worker for all queues |
| `market_ui.js` | Mount Bull Board at `/admin/queues` |
| `schedule_matches.js` | Replace `execSync(cmd)` with BullMQ enqueue |
| `schedule_run.sh` | Remove `at` lines (139-152), or inline into JS |
| `client.js` | Replace `at` with `logSyncQueue.add()` |
| `main_loop.js` | Spawn `worker.js` as persistent child process |
| `latq.sh` | Delete (replaced by Bull Board) |

## Verification

1. `redis-cli ping` — confirm Redis is running
2. `bun run worker.js` — confirm worker starts and registers with Redis
3. Navigate to `http://localhost:3000/admin/queues` — Bull Board dashboard loads, shows three empty queues
4. `bun run schedule_matches.js --dry-run` — confirm jobs are enqueued with correct delays instead of `at` jobs being created
5. `atq` — confirm no new `at` jobs are created
6. Check Bull Board for pending delayed jobs with correct timestamps
7. Watch worker process a job (use `--now`/`--force` flag for immediate test)
