"""
session_words.py — Extract the words a guest said during a recorded appearance.

Session dirs live at s3/<slug>_<YYYY-MM-DD_HH-MM-SS>/ with
deepgram_responses/dg_*.json — each word token carries a numeric speaker id
(channel.alternatives[0].words[].speaker). Guest names come from the Kalshi
market title ("What will Hakeem Jeffries say during Meet the Press?"); speaker
numbers are mapped to names via data/speaker_labels.json, keyed by session
dirname (maintained by scripts/label_speaker.py).
"""

import json
import re
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional

ROOT = Path(__file__).resolve().parent.parent
S3_DIR = ROOT / "s3"
LABELS_FILE = ROOT / "data" / "speaker_labels.json"

_SESSION_RE = re.compile(r"^(.*?)_(\d{4}-\d{2}-\d{2})_\d{2}-\d{2}-\d{2}$")
_TITLE_GUEST_RE = re.compile(r"^What will (.+?) say during .+?\??$")


def session_slug(dirname: str) -> Optional[str]:
    """'kxmtpmention-26aug16_2026-08-16_14-30-05' → 'kxmtpmention-26aug16'."""
    m = _SESSION_RE.match(dirname)
    return m.group(1).lower() if m else None


def session_date(dirname: str) -> Optional[date]:
    m = _SESSION_RE.match(dirname)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(2), "%Y-%m-%d").date()
    except ValueError:
        return None


def words_by_speaker(session_dir: Path) -> Dict[str, List[dict]]:
    """Speaker number (str) → [{word, start}, ...] sorted by start time.

    Reads deepgram_responses/dg_*.json word arrays; files with empty word
    arrays (finalize chunks) are skipped.
    """
    dg = session_dir / "deepgram_responses"
    if not dg.is_dir():
        return {}
    out: Dict[str, List[dict]] = {}
    for f in sorted(dg.glob("*.json")):
        try:
            data = json.loads(f.read_text())
        except (json.JSONDecodeError, OSError):
            continue
        words = ((data.get("channel") or {}).get("alternatives") or [{}])[0].get("words") or []
        for w in words:
            if not w.get("word"):
                continue
            sid = str(w.get("speaker", 0))
            out.setdefault(sid, []).append({"word": w["word"],
                                            "start": w.get("start", 0.0)})
    for sid in out:
        out[sid].sort(key=lambda x: x["start"])
    return out


def guest_from_title(title: str) -> Optional[str]:
    """'What will Hakeem Jeffries say during Meet the Press?' → 'Hakeem Jeffries'."""
    m = _TITLE_GUEST_RE.match(title or "")
    return m.group(1) if m else None


def load_labels() -> Dict[str, Dict[str, str]]:
    if not LABELS_FILE.exists():
        return {}
    try:
        return json.loads(LABELS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def guest_words(session_dir: Path, labels: Dict[str, Dict[str, str]],
                guest: str) -> Optional[List[str]]:
    """The guest's spoken words in the session, or None if the guest's
    speaker number isn't in the label map."""
    by_speaker = words_by_speaker(session_dir)
    if not by_speaker:
        return None
    mapping = labels.get(session_dir.name, {})
    needle = guest.lower()
    for sid, name in mapping.items():
        if (name or "").lower() == needle:
            return [w["word"] for w in by_speaker.get(sid, [])]
    return None


def iter_sessions() -> List[Path]:
    if not S3_DIR.is_dir():
        return []
    return sorted(p for p in S3_DIR.iterdir() if p.is_dir())
