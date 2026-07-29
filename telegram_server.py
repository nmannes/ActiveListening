#!/usr/bin/env python3
"""
telegram_server.py — Persistent Telegram bot server (runs on the client).

Receives commands, enqueues long-running tasks to Redis queues, and handles
inline keyboard callbacks for voice sample verification.

Commands:
    /start               — welcome
    /generate <name>     — enqueue voice sample generation
    /status              — show all queue lengths
    /next                — show upcoming scheduled listening sessions
    /cancel <slug|index> — cancel a scheduled session
    /trust <name>        — show/manage trust preferences
    /samples <name>      — list voice samples in audio library
    /help                — show available commands

Usage:
    python telegram_server.py [--debug]
"""

import argparse
import asyncio
import json
import logging
import os
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

# Auto-load .env.prod (or --env override) so TELEGRAM_KEY is available
_env = "prod"
for i, arg in enumerate(sys.argv):
    if arg == "--env" and i + 1 < len(sys.argv):
        _env = sys.argv[i + 1]
    elif arg.startswith("--env="):
        _env = arg.split("=", 1)[1]
load_dotenv(dotenv_path=ROOT / f".env.{_env}")

from telegram import Update
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

from bullmq import Queue

from pylib.verification_state import (
    get_verification_state,
    update_verification_state,
    get_all_verification_states,
    clear_verification_state,
    pending_verifications,
)

_logs_dir = Path(__file__).resolve().parent / "logs"
_logs_dir.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(_logs_dir / "generate-samples.log"),
    ],
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("telegram_server")

CALLBACK_PREFIX = "gs"  # must match generate_samples.py / worker

# ---------------------------------------------------------------------------
# Command handlers
# ---------------------------------------------------------------------------

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🎙️ *Kalshi Voice Bot*\n\n"
        "Commands:\n"
        "/generate `Name` — Generate voice samples for a target\n"
        "/status — Show queue status\n"
        "/next — Show upcoming scheduled listening sessions\n"
        "/cancel `slug|index` — Cancel a scheduled session\n"
        "/trust `Name` — Manage trust preferences\n"
        "/samples `Name` — List voice samples in library\n"
        "/help — Show this message",
        parse_mode="Markdown",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await cmd_start(update, context)


async def cmd_generate(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = list(context.args) if context.args else []

    # Separate YouTube URLs from target name words
    url_pattern = re.compile(r'^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/shorts/|youtube\.com/live/)[\w-]+', re.IGNORECASE)
    name_words = []
    urls = []
    for a in args:
        if url_pattern.match(a):
            urls.append(a)
        else:
            name_words.append(a)

    target = " ".join(name_words) if name_words else None
    if not target:
        await update.message.reply_text(
            "Usage: `/generate Name [url ...]`\n\n"
            "Examples:\n"
            "`/generate Donald Trump` — search YouTube\n"
            "`/generate Donald Trump https://youtube.com/watch\\?v=...` — use specific video",
            parse_mode="Markdown",
        )
        return

    job_data = {
        "target": target,
        "chat_id": update.effective_chat.id,
    }
    if urls:
        job_data["urls"] = urls

    queue = context.application.bot_data["gen_queue"]
    job = await queue.add("generate_samples", job_data)
    counts = await queue.getJobCounts()

    msg = (
        f"📥 Enqueued sample generation for *{target}*\n"
        f"Job: `{job.id}`\n"
        f"Queue depth: {counts.get('waiting', 0) + counts.get('active', 0)}"
    )
    if urls:
        msg += f"\nUsing {len(urls)} provided URL(s) (no search)"
    else:
        msg += "\nSearching YouTube"

    await update.message.reply_text(msg, parse_mode="Markdown")


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    gen_queue = context.application.bot_data["gen_queue"]
    save_queue = context.application.bot_data["save_queue"]
    gen_counts = await gen_queue.getJobCounts()
    save_counts = await save_queue.getJobCounts()
    pending = pending_verifications()

    lines = ["📊 *Queue Status*", ""]
    for name, counts in [("sample-generation", gen_counts), ("save-samples", save_counts)]:
        total = sum(counts.values())
        lines.append(f"• `{name}`: {total} job(s)")
    if not gen_counts and not save_counts:
        lines.append("• (no active queues)")

    lines.append("")
    lines.append(f"🔍 Pending verifications: {len(pending)}")
    if pending:
        for slug in pending:
            states = get_all_verification_states(slug)
            approved = sum(1 for s in states.values() if s.get("approved"))
            lines.append(f"• `{slug}`: {approved}/{len(states)} approved")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_trust(update: Update, context: ContextTypes.DEFAULT_TYPE):
    target = " ".join(context.args) if context.args else None
    trust_path = Path("~/audio-library/trust.json").expanduser()

    if not trust_path.exists():
        await update.message.reply_text("No trust preferences configured yet.")
        return

    trust = json.loads(trust_path.read_text())

    if target:
        slug = target.lower().replace(" ", "-")
        entry = trust.get(slug, {})
        default = trust.get("default", {})
        auto = entry.get("auto_approve", default.get("auto_approve", False))
        threshold = entry.get("auto_approve_threshold", default.get("auto_approve_threshold", 0.85))
        await update.message.reply_text(
            f"🎯 *{target}*\n"
            f"Auto-approve: `{auto}`\n"
            f"Threshold: `{threshold}`",
            parse_mode="Markdown",
        )
    else:
        lines = ["🎯 *Trust Preferences*", ""]
        for slug, cfg in trust.items():
            lines.append(
                f"• `{slug}`: auto=`{cfg.get('auto_approve', False)}` "
                f"thresh=`{cfg.get('auto_approve_threshold', '—')}`"
            )
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


async def cmd_samples(update: Update, context: ContextTypes.DEFAULT_TYPE):
    target = " ".join(context.args) if context.args else None
    lib = Path("~/audio-library").expanduser()

    if not lib.exists():
        await update.message.reply_text("Audio library is empty.")
        return

    if target:
        slug = target.lower().replace(" ", "-")
        wavs = sorted(lib.glob(f"{slug}*.wav"))
        embs = sorted(lib.glob(f"{slug}*.embedding"))

        lines = [f"🎙️ *{target}*", ""]
        lines.append(f"WAV files: {len(wavs)}")
        for w in wavs:
            size_kb = w.stat().st_size / 1024
            lines.append(f"• `{w.name}` ({size_kb:.0f} KB)")
        lines.append(f"Embeddings: {len(embs)}")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    else:
        # List all unique slugs
        wavs = sorted(lib.glob("*.wav"))
        slugs = set()
        for w in wavs:
            stem = w.stem
            # Strip numeric suffix for base slug
            parts = stem.rsplit("-", 1)
            if len(parts) == 2 and parts[1].isdigit():
                slugs.add(parts[0])
            else:
                slugs.add(stem)

        lines = [f"🎙️ *Audio Library* ({len(wavs)} samples)", ""]
        for slug in sorted(slugs):
            count = len(list(lib.glob(f"{slug}*.wav")))
            lines.append(f"• `{slug}` — {count} sample(s)")
        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ---------------------------------------------------------------------------
# /next — show upcoming scheduled listening sessions
# ---------------------------------------------------------------------------

async def _get_jobs_safe(queue, types, start=0, end=50):
    try:
        return await queue.getJobs(types, start, end)
    except ValueError:
        return []


async def cmd_next(update: Update, context: ContextTypes.DEFAULT_TYPE):
    queue = context.application.bot_data["run_client_queue"]

    # Get all non-terminal jobs (each call can throw ValueError if empty)
    delayed = await _get_jobs_safe(queue, ["delayed"])
    waiting = await _get_jobs_safe(queue, ["waiting"])
    active = await _get_jobs_safe(queue, ["active"])

    count = 5
    if context.args:
        try:
            count = int(context.args[0])
            count = max(1, min(count, 20))
        except ValueError:
            pass

    # Enrich from scheduled JSON files
    items = []
    for job in delayed + waiting + active:
        data = job.data
        market_file = data.get("marketFile", "")
        title = data.get("slug", "Unknown")
        event_time = None
        channel = "Unknown"

        if market_file and os.path.exists(market_file):
            try:
                market = json.loads(open(market_file).read())
                event_time = market.get("eventStartTime", "")
                title = market.get("title", title)
                channel = market.get("mediaSourceCommonName", "Unknown")
            except Exception:
                pass

        items.append({
            "job": job,
            "slug": data.get("slug", job.id),
            "event_time": event_time,
            "title": title,
            "channel": channel,
        })

    # Sort by event time (None sorts last)
    items.sort(key=lambda x: x["event_time"] or "z")

    # Cache for /cancel by index
    bot_data = context.application.bot_data
    bot_data.setdefault("next_cache", {})[update.effective_chat.id] = {
        i + 1: item["slug"] for i, item in enumerate(items[:count])
    }

    lines = ["📋 *Upcoming Listening Sessions*", ""]

    for i, item in enumerate(items[:count]):
        job = item["job"]
        title = item["title"]
        event_time = item["event_time"]
        channel = item["channel"]
        slug = item["slug"]

        if event_time:
            try:
                dt = datetime.fromisoformat(event_time.replace("Z", "+00:00"))
                et = dt.astimezone(ZoneInfo("America/New_York"))
                time_str = et.strftime("%a %b %d, %I:%M %p ET")
            except Exception:
                time_str = event_time
        else:
            time_str = "Unknown"

        try:
            state = await queue.getJobState(job.id)
        except Exception:
            state = "unknown"

        if state == "active":
            status = "🟢 *Live*"
        elif state == "waiting":
            status = "🟡 *Launching*"
        else:
            status = "🔵 Scheduled"

        lines.append(f"*{i + 1}.* {title}")
        lines.append(f"   🕐 {time_str} | 📺 {channel} | {status}")
        lines.append(f"   `/cancel {slug}`")
        lines.append("")

    if not items:
        lines.append("No upcoming listening sessions.")
    else:
        showing = min(len(items), count)
        lines.append(f"Showing {showing} of {len(items)} session(s).")

    await update.message.reply_text("\n".join(lines), parse_mode="Markdown")


# ---------------------------------------------------------------------------
# /cancel helpers
# ---------------------------------------------------------------------------

async def _terminate_ec2_instance(slug):
    """Find and destroy the EC2 instance + CloudFormation stack for slug."""

    def _run_script():
        result = subprocess.run(
            ["./scripts/terminate_ec2.sh", slug],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            return False, f"terminate_ec2.sh error: {result.stderr[:200]}"
        return True, result.stdout.strip() or "Terminated"

    try:
        return await asyncio.to_thread(_run_script)
    except Exception as e:
        return False, f"EC2 termination error: {e}"


# ---------------------------------------------------------------------------
# /cancel — cancel a scheduled listening session
# ---------------------------------------------------------------------------

async def cmd_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not context.args:
        await update.message.reply_text(
            "Usage: `/cancel <slug|index>`\n\n"
            "Use `/next` to see upcoming sessions and their cancel commands.\n"
            "Examples:\n"
            "`/cancel kxwcmention-26jun22argaut`\n"
            "`/cancel 1` (cancels the first session from your last `/next`)",
            parse_mode="Markdown",
        )
        return

    arg = context.args[0]
    queue = context.application.bot_data["run_client_queue"]

    # Resolve to slug
    slug = None
    next_cache = (
        context.application.bot_data.get("next_cache", {})
        .get(update.effective_chat.id, {})
    )

    try:
        idx = int(arg)
        slug = next_cache.get(idx)
        if not slug:
            await update.message.reply_text(
                f"No session at index {idx}. Use `/next` to see the current list.",
                parse_mode="Markdown",
            )
            return
    except ValueError:
        slug = arg

    # Find the job across all non-terminal states
    all_jobs = (
        await _get_jobs_safe(queue, ["delayed"], 0, 100)
        + await _get_jobs_safe(queue, ["waiting"], 0, 100)
        + await _get_jobs_safe(queue, ["active"], 0, 100)
    )
    target_job = None
    for job in all_jobs:
        if job.data.get("slug") == slug:
            target_job = job
            break

    if not target_job:
        # Check completed/failed as well for already-started sessions
        completed = await _get_jobs_safe(queue, ["completed"], 0, 50)
        failed = await _get_jobs_safe(queue, ["failed"], 0, 50)
        for job in completed + failed:
            if job.data.get("slug") == slug:
                await update.message.reply_text(
                    f"Session `{slug}` has already finished.\n"
                    "Clean up the scheduled file manually if needed.",
                    parse_mode="Markdown",
                )
                return

        await update.message.reply_text(
            f"No scheduled session found for `{slug}`.\n"
            "It may have already started, completed, or been cancelled.",
            parse_mode="Markdown",
        )
        return

    # Determine job state
    try:
        state = await queue.getJobState(target_job.id)
    except Exception:
        state = "unknown"

    # Get title from the market file
    title = slug
    market_file = target_job.data.get("marketFile", "")
    market_data = {}
    if market_file and os.path.exists(market_file):
        try:
            market_data = json.loads(open(market_file).read())
            title = market_data.get("title", slug)
        except Exception:
            pass

    # Remove the job (works for delayed/waiting; for active it removes
    # the queue entry but the worker child process is already spawned)
    try:
        await queue.remove(target_job.id)
        logger.info(f"Cancelled BullMQ job: {target_job.id} (state={state})")
    except Exception as e:
        logger.warning(f"Could not remove job {target_job.id}: {e}")

    # Remove the scheduled JSON file
    if market_file and os.path.exists(market_file):
        try:
            os.remove(market_file)
            logger.info(f"Removed scheduled file: {market_file}")
        except Exception as e:
            logger.warning(f"Failed to remove scheduled file {market_file}: {e}")

    # Add to blocklist
    cache_dir = os.environ.get("KALSHI_CACHE_DIR") or os.path.join(
        os.environ.get("KALSHI_DATA_DIR", str(Path(__file__).parent)),
        "cache",
    )
    blocklist_path = os.path.join(cache_dir, "unscheduled.json")
    blocklist = []
    if os.path.exists(blocklist_path):
        try:
            blocklist = json.loads(open(blocklist_path).read())
        except Exception:
            pass
    if slug not in blocklist:
        blocklist.append(slug)
        os.makedirs(os.path.dirname(blocklist_path), exist_ok=True)
        with open(blocklist_path, "w") as f:
            json.dump(blocklist, f)
        logger.info(f"Added {slug} to unscheduled blocklist")

    if state == "active":
        ec2_ok, ec2_msg = await _terminate_ec2_instance(slug)
        if ec2_ok:
            lines = [
                f"❌ *Session Killed*\n",
                f"{title}",
                f"Slug: `{slug}`",
                f"",
                f"{ec2_msg}",
            ]
        else:
            shutdown_parts = [f"EC2 termination attempted but: {ec2_msg}"]
            server_duration = market_data.get("serverDuration")
            if server_duration:
                shutdown_parts.append(f"Instance will auto-terminate after ~{server_duration}m")
            lines = [
                f"⚠️ *Session In Progress — Partial Cancel*\n",
                f"{title}",
                f"Slug: `{slug}`",
                f"",
            ] + shutdown_parts

        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")
    else:
        await update.message.reply_text(
            f"❌ *Cancelled*\n"
            f"{title}\n"
            f"Slug: `{slug}`\n"
            f"Removed from queue and unscheduled list.",
            parse_mode="Markdown",
        )


# ---------------------------------------------------------------------------
# Callback query handler — voice sample verification
# ---------------------------------------------------------------------------

async def _recompute_and_update_captions(slug: str, context: ContextTypes.DEFAULT_TYPE):
    """Recompute scores for all pending segments based on approved embeddings.

    When a user approves a sample, that embedding becomes a known-good
    reference. Remaining pending segments are rescored by cosine similarity
    to the centroid of all approved embeddings, and their Telegram captions
    are updated to reflect the new scores.
    """
    import torch

    all_states = get_all_verification_states(slug)
    if not all_states:
        return

    # Load all approved embeddings and build a reference centroid
    approved_embs = []
    for idx, sdata in all_states.items():
        if sdata.get("approved") is True:
            emb_path = sdata.get("emb_path")
            if emb_path and os.path.exists(emb_path):
                emb = torch.load(emb_path, weights_only=True)
                if emb.dim() > 1:
                    emb = emb.squeeze(0)
                approved_embs.append(emb)

    if not approved_embs:
        return

    approved_stack = torch.stack(approved_embs)
    approved_stack = torch.nn.functional.normalize(approved_stack, p=2, dim=1)
    ref_centroid = approved_stack.mean(dim=0)
    ref_centroid = torch.nn.functional.normalize(ref_centroid, p=2, dim=0)

    # Rescore each pending segment by similarity to the approved centroid
    pending = {idx: sdata for idx, sdata in all_states.items() if sdata.get("approved") is None}
    for idx, sdata in pending.items():
        emb_path = sdata.get("emb_path")
        if not emb_path or not os.path.exists(emb_path):
            continue
        emb = torch.load(emb_path, weights_only=True)
        if emb.dim() > 1:
            emb = emb.squeeze(0)
        emb = torch.nn.functional.normalize(emb, p=2, dim=0)
        sim = float(emb @ ref_centroid.T)
        new_score = round(max(0.0, min(1.0, sim)), 4)
        update_verification_state(slug, idx, {"score": new_score, "ref_score": new_score})

        # Edit the Telegram caption if we have the message info
        msg_id = sdata.get("message_id")
        chat_id = sdata.get("chat_id")
        if msg_id and chat_id:
            target = sdata.get("target", slug.replace("-", " ").title())
            source = sdata.get("source", "")
            vid_id = source.split("_", 1)[1] if "_" in source else source
            source_url = f"https://youtube.com/watch?v={vid_id}" if vid_id else "unknown"
            new_caption = (
                f"🎙️ {target} — sample {idx + 1}\n"
                f"Confidence: {new_score:.3f} | Duration: {sdata.get('duration', 0):.1f}s\n"
                f"Source: {source_url}"
            )
            try:
                await context.bot.edit_message_caption(
                    chat_id=chat_id,
                    message_id=msg_id,
                    caption=new_caption,
                )
            except Exception as exc:
                logger.warning(f"Failed to edit caption for {slug}[{idx}]: {exc}")

    logger.info(
        f"Score recompute for {slug}: {len(approved_embs)} approved, "
        f"{len(pending)} rescored"
    )


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data

    if not data.startswith(CALLBACK_PREFIX + ":"):
        await query.answer("Unknown action")
        return

    parts = data.split(":", 3)
    if len(parts) < 4:
        await query.answer("Invalid callback")
        return

    action = parts[1]
    slug = parts[2]
    idx_str = parts[3]

    try:
        idx = int(idx_str)
    except ValueError:
        await query.answer("Invalid segment index")
        return

    vdata = get_verification_state(slug, idx)
    if vdata is None:
        await query.answer("Verification expired or not found")
        return

    if action == "approve":
        update_verification_state(slug, idx, approved=True)
        await query.answer("Approved ✅")
        logger.info(f"Verification: {slug}[{idx}] approved")
        # Save immediately
        save_queue = context.application.bot_data["save_queue"]
        await save_queue.add("save_samples", {
            "slug": slug,
            "target": vdata.get("target", slug.replace("-", " ").title()),
            "approved_indices": [idx],
            "chat_id": query.message.chat.id,
        })
        # Rescore remaining pending samples against the newly approved embedding
        await _recompute_and_update_captions(slug, context)

    elif action == "reject":
        update_verification_state(slug, idx, approved=False)
        await query.answer("Rejected ❌")
        logger.info(f"Verification: {slug}[{idx}] rejected")

        # Save embedding as a negative reference so future runs can
        # filter out segments that sound like this known non-target speaker.
        emb_path = vdata.get("emb_path")
        if emb_path and os.path.exists(emb_path):
            import torch
            audio_lib = Path("~/negative-audio-library").expanduser()
            audio_lib.mkdir(parents=True, exist_ok=True)
            neg_files = sorted(audio_lib.glob(f"{slug}.negative.*.embedding"))
            next_n = 0
            for nf in neg_files:
                try:
                    n = int(nf.stem.rsplit(".", 1)[-1])
                    next_n = max(next_n, n + 1)
                except ValueError:
                    pass
            neg_path = audio_lib / f"{slug}.negative.{next_n}.embedding"
            torch.save(torch.load(emb_path, weights_only=True), str(neg_path))
            logger.info(f"Verification: saved negative embedding {neg_path.name}")

    elif action == "auto_best":
        # Approve the best (highest score) unresolved segment from each distinct source video
        all_states = get_all_verification_states(slug)
        by_source = {}
        for seg_idx, sdata in all_states.items():
            if sdata.get("approved") is None:
                src = sdata.get("source", "unknown")
                by_source.setdefault(src, []).append((seg_idx, sdata))
        auto_idxs = []
        for src, entries in by_source.items():
            entries.sort(key=lambda x: x[1].get("score", 0), reverse=True)
            best_idx = entries[0][0]
            update_verification_state(slug, best_idx, approved=True)
            auto_idxs.append(best_idx)
        await query.answer(f"Approved best from {len(auto_idxs)} source(s) ✅")
        logger.info(f"Verification: {slug} auto-approved best per source: {auto_idxs}")
        if auto_idxs:
            save_queue = context.application.bot_data["save_queue"]
            await save_queue.add("save_samples", {
                "slug": slug,
                "target": vdata.get("target", slug.replace("-", " ").title()),
                "approved_indices": auto_idxs,
                "chat_id": query.message.chat.id,
            })
        # Rescore remaining pending samples against the newly approved embeddings
        await _recompute_and_update_captions(slug, context)

    else:
        await query.answer(f"Unknown action: {action}")
        return

    # Check if all segments for this slug are now resolved
    all_states = get_all_verification_states(slug)
    resolved = all(s.get("approved") is not None for s in all_states.values())
    if resolved and all_states:
        approved_idxs = [k for k, v in all_states.items() if v.get("approved")]
        target = vdata.get("target", slug.replace("-", " ").title()) if vdata else slug

        await context.bot.send_message(
            chat_id=query.message.chat.id,
            text=(
                f"✅ Verification complete for *{target}*\n"
                f"Approved: {len(approved_idxs)}/{len(all_states)} segment(s)\n"
                f"Each sample was saved individually on approval."
            ),
            parse_mode="Markdown",
        )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Persistent Telegram bot server")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)

    token = os.environ.get("TELEGRAM_KEY_VOICE_IDS") or os.environ.get("TELEGRAM_KEY")
    if not token:
        logger.error("TELEGRAM_KEY_VOICE_IDS or TELEGRAM_KEY not set in environment")
        sys.exit(1)

    app = Application.builder().token(token).build()

    # BullMQ queues (constructor is sync, async methods used in handlers)
    redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
    redis_port = int(os.environ.get("REDIS_PORT", "6379"))
    connection = {"host": redis_host, "port": redis_port}
    app.bot_data["gen_queue"] = Queue("sample-generation", {"connection": connection})
    app.bot_data["save_queue"] = Queue("save-samples", {"connection": connection})
    app.bot_data["run_client_queue"] = Queue("run-client", {"connection": connection})

    # Command handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("generate", cmd_generate))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("next", cmd_next))
    app.add_handler(CommandHandler("cancel", cmd_cancel))
    app.add_handler(CommandHandler("trust", cmd_trust))
    app.add_handler(CommandHandler("samples", cmd_samples))

    # Callback query handler
    app.add_handler(CallbackQueryHandler(handle_callback))

    logger.info("Starting Telegram bot (polling) …")
    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()
