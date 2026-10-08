"""sample_library.py — shared helpers for the voice-sample library.

Stdlib-only on purpose: imported by the sample-generation scripts, the
Telegram bot server, CI tests, and (on the GPU server) the live speaker-ask
manager.

The .embedding files are the canonical samples — runtime identification only
loads those; .wav files are optional side artifacts and may be purged — so
all counting is done on them.
"""

import re
from pathlib import Path

AUDIO_LIBRARY = Path("~/audio-library").expanduser()

# Hard cap on stored samples per identity.
MAX_SAMPLES_PER_IDENTITY = 100


def slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"[\s]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def count_samples(slug: str) -> int:
    """Number of stored samples for an identity — <slug>.embedding plus <slug>-N.embedding."""
    files = sorted(AUDIO_LIBRARY.glob(f"{slug}.embedding"))
    files += sorted(AUDIO_LIBRARY.glob(f"{slug}-*.embedding"))
    return len(files)


def next_sample_index(slug: str) -> int:
    """Next free numeric suffix for an identity's samples (0 => bare <slug>).

    Considers both .wav and .embedding files so a save never overwrites an
    existing sample on a library where the WAVs are missing.
    """
    stems = {p.stem for p in AUDIO_LIBRARY.glob(f"{slug}*.wav")}
    stems |= {p.stem for p in AUDIO_LIBRARY.glob(f"{slug}*.embedding")}
    next_idx = 0
    for stem in stems:
        if stem == slug:
            next_idx = max(next_idx, 1)
        elif stem.startswith(slug + "-"):
            try:
                next_idx = max(next_idx, int(stem[len(slug) + 1:]) + 1)
            except ValueError:
                pass
    return next_idx
