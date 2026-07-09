from collections import defaultdict
from pylib.keyword_matching import find_keyword_match


class SignalDetector:
    """Pure keyword matching over per-speaker word buffers. No side effects."""

    def __init__(self):
        self.speaker_buffers: dict[str, list[str]] = defaultdict(list)

    def feed_token(self, speaker_id: str, word: str, keyword_index: dict) -> dict | None:
        self.speaker_buffers[speaker_id].append(word)
        return find_keyword_match(
            keyword_index, self.speaker_buffers[speaker_id], word
        )
