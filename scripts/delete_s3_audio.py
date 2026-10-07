#!/usr/bin/env python
"""Delete audio files under s3/, keeping transcripts and everything else.

Session folders under s3/ hold audio/ (full.wav + speaker_N.wav) alongside
transcript material (transcript.json, deepgram_responses/). This script
removes only files with an audio extension, leaving the rest in place.

Dry-run by default; pass --yes to actually delete.
"""

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ROOT = REPO_ROOT / "s3"

AUDIO_EXTS = {".wav", ".mp3", ".m4a", ".flac", ".aac", ".ogg", ".opus", ".webm"}


def human(n):
    size = float(n)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if size < 1024 or unit == "TB":
            return f"{n} B" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024


def scan(root):
    """Return ([(path, size)] for audio, {ext: [count, bytes]} for everything kept)."""
    audio = []
    kept = defaultdict(lambda: [0, 0])
    n_dirs = 0
    for dirpath, _dirnames, filenames in os.walk(root):
        n_dirs += 1
        if n_dirs % 50 == 0:
            print(f"\r  scanned {n_dirs} dirs, {len(audio)} audio files found",
                  end="", file=sys.stderr, flush=True)
        for name in filenames:
            path = Path(dirpath) / name
            try:
                size = path.stat().st_size
            except OSError:
                continue  # broken symlink etc.
            if path.suffix.lower() in AUDIO_EXTS:
                audio.append((path, size))
            else:
                entry = kept[path.suffix.lower() or "(no ext)"]
                entry[0] += 1
                entry[1] += size
    print(file=sys.stderr)
    return audio, kept


def prune_empty(root):
    removed = 0
    for dirpath, _dirnames, _filenames in os.walk(root, topdown=False):
        if os.path.abspath(dirpath) == str(root):
            continue
        try:
            os.rmdir(dirpath)  # only succeeds if empty
            removed += 1
        except OSError:
            pass
    return removed


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT,
                        help=f"session root (default: {DEFAULT_ROOT})")
    parser.add_argument("--yes", action="store_true",
                        help="actually delete (default is a dry run)")
    parser.add_argument("--prune-empty", action="store_true",
                        help="remove directories left empty after deletion")
    args = parser.parse_args()

    root = args.root.resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 1

    print(f"scanning {root}", file=sys.stderr)
    audio, kept = scan(root)
    total = sum(size for _, size in audio)

    print(f"audio files to delete: {len(audio)} ({human(total)})")
    print("files kept (top extensions by size):")
    for ext, (count, size) in sorted(kept.items(), key=lambda kv: -kv[1][1])[:10]:
        print(f"  {ext:<10} {count:>7} files  {human(size)}")

    if not args.yes:
        print(f"\ndry run: nothing deleted. re-run with --yes to delete "
              f"{len(audio)} files ({human(total)})")
        return 0

    deleted = failures = freed = 0
    for i, (path, size) in enumerate(audio, 1):
        try:
            path.unlink()
        except OSError as e:
            failures += 1
            print(f"\n  failed to delete {path}: {e}", file=sys.stderr)
            continue
        deleted += 1
        freed += size
        if i % 500 == 0:
            print(f"\r  deleting... {i}/{len(audio)}", end="", file=sys.stderr, flush=True)
    print(f"\rdeleted {deleted} files, freed {human(freed)}")
    if failures:
        print(f"{failures} files could not be deleted", file=sys.stderr)

    if args.prune_empty:
        print(f"removed {prune_empty(root)} empty directories")

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
