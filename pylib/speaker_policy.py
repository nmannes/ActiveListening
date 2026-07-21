"""
InferencePolicy — simple timer-based scheduling for speaker identification.

Runs identification on a fixed interval for the full duration of the
broadcast event.  No word-count gating, no stability tracking.
"""

from __future__ import annotations

import asyncio
import time


class InferencePolicy:
    """Owns the scheduling parameters for speaker inference:
    how often to run and how long to keep running."""

    def __init__(self, *, interval_secs: int = 10, max_duration_secs: int = 1200):
        self.interval_secs = interval_secs
        self.max_duration_secs = max_duration_secs

    def is_duration_exceeded(self, elapsed_secs: float) -> bool:
        return elapsed_secs > self.max_duration_secs


class SpeakerRecognitionLoop:
    """Runs speaker identification on a fixed interval for the event duration.

    Clock and sleep are injectable so tests can fast-forward time and
    replay tests can simulate exact timing against saved transcripts.
    """

    def __init__(
        self,
        policy: InferencePolicy,
        run_fn,  # async () -> None
        *,
        clock=time.monotonic,
        sleep=asyncio.sleep,
    ):
        self._policy = policy
        self._run_fn = run_fn
        self._clock = clock
        self._sleep = sleep

    async def run(self):
        start = self._clock()
        while True:
            await self._sleep(self._policy.interval_secs)
            elapsed = self._clock() - start
            if self._policy.is_duration_exceeded(elapsed):
                break
            await self._run_fn()
