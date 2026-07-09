from collections import defaultdict
from pylib.keyword_matching import find_keyword_match


class SignalDetector:
    """Pure keyword matching over per-speaker word buffers. No side effects."""

    def __init__(self):
        self.speaker_buffers: dict[str, list[dict]] = defaultdict(list)

    def feed_token(self, speaker_id: str, token: dict, keyword_index: dict) -> dict | None:
        entry = {"word": token["text"], "confidence": token.get("confidence", 0)}
        self.speaker_buffers[speaker_id].append(entry)
        return find_keyword_match(
            keyword_index, self.speaker_buffers[speaker_id], token["text"]
        )
