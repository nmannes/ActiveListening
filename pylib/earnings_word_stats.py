"""
earnings_word_stats.py — Word-level statistics over earnings call transcripts.

Shared Kalshi-style word matching (word boundaries + plural/possessive forms)
and the baseline probability used by scripts/generate_earnings_report.py and
scripts/analyze_earnings_predictability.py. Kalshi resolves YES for a word's
plural/possessive forms, so every matcher here mirrors that rule.
"""

import re
from typing import Dict, List, Optional, Tuple

_WORD_SPLIT_RE = re.compile(r"\s*/\s*")


def word_variants(word: str) -> List[str]:
    """Split a Kalshi word into its synonym variants ("Gross Margin/Profit" → 2)."""
    return [v.strip() for v in _WORD_SPLIT_RE.split(word) if v.strip()]


def normalize(w: str) -> str:
    return w.lower().replace("’", "'")


def word_in_text(word: str, text: str) -> bool:
    """Match any synonym variant, including plural/possessive forms.

    Mirrors Kalshi's resolution rule: resolves YES for the exact word or
    its plural/possessive form (e.g. "Message" matches "Messages").
    """
    t = text.lower().replace("’", "'")
    for v in word_variants(word):
        base = normalize(v)
        for form in (base, base + "s", base + "es", base + "'s", base + "s'", base + "es'"):
            esc = re.escape(form)
            if re.search(rf"(?<![a-z0-9]){esc}(?![a-z0-9])", t):
                return True
    return False


def word_in_calls(word: str, texts: List[str]) -> int:
    """How many of the given call texts contain the word (Kalshi-style match)."""
    return sum(1 for t in texts if word_in_text(word, t))


def baseline_probability(
    present_in: int,
    total_calls: int,
    said_last_call: bool,
    p_after_yes: float = 0.67,
    p_after_no: float = 0.243,
) -> Optional[float]:
    """Baseline P(word said next call) from transcript evidence only.

    Blends the word's own Laplace-smoothed presence rate with the aggregate
    transition rate (P(said | said/not said last call)), weighted toward the
    transition prior when per-word evidence is thin. Returns None when there
    is no prior-call history at all.
    """
    if total_calls <= 0:
        return None
    presence = (present_in + 1) / (total_calls + 2)
    transition = p_after_yes if said_last_call else p_after_no
    alpha = 1 / (1 + total_calls / 2)
    return alpha * transition + (1 - alpha) * presence
