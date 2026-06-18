#!/usr/bin/env python3
"""
telegram_server.py — Persistent Telegram bot server (runs on the client).

Receives commands, enqueues long-running tasks to Redis queues, and handles
inline keyboard callbacks for voice sample verification.

Commands:
    /start               — welcome
    /generate <name>     — enqueue voice sample generation
    /status              — show all queue lengths
    /trust <name>        — show/manage trust preferences
    /samples <name>      — list voice samples in audio library
    /help                — show available commands

Usage:
    python3 telegram_server.py [--debug]
"""

import argparse
import asyncio
import json
import logging
import os
import re
import sys
from pathlib import Path

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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).resolve().parent / "logs" / "generate-samples.log"),
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
# Callback query handler — voice sample verification
# ---------------------------------------------------------------------------

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    data = query.data

    if not data.startswith(CALLBACK_PREFIX + ":"):
        await query.answer("Unknown action")
        return

    parts = data.split(":", 2)
    if len(parts) < 3:
        await query.answer("Invalid callback")
        return

    action = parts[1]
    idx_str = parts[2]

    try:
        idx = int(idx_str)
    except ValueError:
        await query.answer("Invalid segment index")
        return

    # Determine which slug this callback belongs to by checking all pending
    # verification states for one that contains this index
    pending = pending_verifications()
    slug = None
    vdata = None
    for p in pending:
        vdata = get_verification_state(p, idx)
        if vdata:
            slug = p
            break

    if slug is None:
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

    # Command handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("generate", cmd_generate))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("trust", cmd_trust))
    app.add_handler(CommandHandler("samples", cmd_samples))

    # Callback query handler
    app.add_handler(CallbackQueryHandler(handle_callback))

    logger.info("Starting Telegram bot (polling) …")
    app.run_polling(allowed_updates=["message", "callback_query"])


if __name__ == "__main__":
    main()
