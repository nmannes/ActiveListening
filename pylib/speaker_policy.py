"""
InferencePolicy — single source of truth for when speaker inference runs and stops.

Two modes, selected automatically based on whether we have voice samples for the target:
  - voice mode: audio-based identification against known samples (definitive, fast).
  - inference mode: transcript-based Bedrock inference (needs word accumulation, stability).

Extracted from server.py (loop gating) and speaker_recognition.py (stability tracking)
so the policy can be updated in one place.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from pylib.speaker_identifier import SpeakerIdentifier


class InferencePolicy:
    """Owns all decisions about when to run speaker inference and when to stop."""

    def __init__(
        self,
        *,
        interval_secs: int = 10,
        word_step: int = 500,
        max_words: int = 10000,
        max_duration_secs: int = 600,
        stability_rounds: int = 3,
    ):
        self.interval_secs = interval_secs
        self.word_step = word_step
        self.max_words = max_words
        self.max_duration_secs = max_duration_secs
        self.stability_rounds = stability_rounds

        self.history: list = []  # list of mapping dicts from each inference round
        self._stable = False
        self._last_word_count = 0  # total words at the time of the last inference run

    # ── Factory ───────────────────────────────────────────────────────

    @classmethod
    def for_entities(cls, entities: list, identifier: SpeakerIdentifier | None = None) -> InferencePolicy:
        """Return a policy configured for the given target entities.

        If any entity has a voice sample on disk, use voice mode (fast, definitive
        audio matching). Otherwise use inference mode (conservative, transcript-based).
        """
        has_sample = identifier is not None and any(
            identifier.has_sample_for(e) for e in entities
        )
        return cls.voice_mode() if has_sample else cls.inference_mode()

    @classmethod
    def voice_mode(cls) -> InferencePolicy:
        """For targets we have voice samples of — audio ID is definitive.

        Runs quickly with low thresholds: audio matching doesn't need word
        accumulation or stability checks, it's a direct embedding comparison.
        """
        return cls(
            interval_secs=10,
            word_step=300,
            max_words=3000,
            max_duration_secs=120,
            stability_rounds=1,
        )

    @classmethod
    def inference_mode(cls) -> InferencePolicy:
        """For targets inferred from transcripts — needs more data + stability.

        Conservative defaults: accumulates more words between runs, requires
        3 consistent rounds before declaring stable.
        """
        return cls(
            interval_secs=10,
            word_step=500,
            max_words=10000,
            max_duration_secs=600,
            stability_rounds=3,
        )

    # ── Scheduling gates ──────────────────────────────────────────────

    def should_run(self, total_words: int) -> bool:
        """True if enough new words have accumulated and we're under the word limit."""
        if total_words >= self.max_words:
            return False
        return total_words >= self._last_word_count + self.word_step

    # ── Stopping gates ────────────────────────────────────────────────

    @property
    def is_stable(self) -> bool:
        return self._stable

    def is_duration_exceeded(self, elapsed_secs: float) -> bool:
        return elapsed_secs >= self.max_duration_secs

    def is_word_limit_reached(self, total_words: int) -> bool:
        return total_words >= self.max_words

    # ── Result tracking ───────────────────────────────────────────────

    def record_result(self, mapping: dict, market_entities: list) -> bool:
        """Record an inference result. Returns True if stability was just reached."""
        self.history.append(mapping)
        if len(self.history) >= self.stability_rounds:
            last_n = self.history[-self.stability_rounds :]
            if all(r == last_n[0] and r for r in last_n):
                if any(label in market_entities for label in last_n[0].values()):
                    self._stable = True
                    return True
        return False

    def mark_ran(self, total_words: int):
        """Update the word-count tracker after running inference."""
        self._last_word_count = total_words
