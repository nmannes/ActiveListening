"""
keyword_matching.py — Keyword phrase matching against a running transcript.

Port of lib/matching.js to Python.
"""


def build_keyword_index(keywords: dict) -> dict:
    """Build an index of keyword phrases keyed by their last word."""
    index = {}
    for key, value in keywords.items():
        words = key.lower().split()
        last_word = words[-1]
        if last_word not in index:
            index[last_word] = []
        index[last_word].append({"key": key, "words": words, "value": value})
    return index


def find_keyword_match(index: dict, transcript: list, word: str):
    """Check if the newly added word completes any keyword phrase.

    transcript is a list of dicts with 'word' and 'confidence' keys.
    Returns match dict with aggregated confidence on success.
    """
    candidates = index.get(word)
    if not candidates:
        return None

    words = [t["word"] for t in transcript]

    for candidate in candidates:
        length = len(candidate["words"])
        if len(words) < length:
            continue

        tail = words[-length:]
        if tail == candidate["words"]:
            matching = transcript[-length:]
            confidences = [t.get("confidence", 0) for t in matching]
            return {
                "key": candidate["key"],
                "value": candidate["value"],
                "min_confidence": min(confidences),
                "avg_confidence": round(sum(confidences) / len(confidences), 3),
                "confidences": confidences,
            }

    return None


def remove_from_index(index: dict, key: str):
    """Remove a matched keyword from the index."""
    words = key.lower().split()
    last_word = words[-1]
    if last_word in index:
        index[last_word] = [c for c in index[last_word] if c["key"] != key]
        if not index[last_word]:
            del index[last_word]


def remove_market_from_index(index: dict, value: str):
    """Remove all keywords from the index that correspond to the given market (value)."""
    empty_keys = []
    for last_word, candidates in index.items():
        index[last_word] = [c for c in candidates if c["value"] != value]
        if not index[last_word]:
            empty_keys.append(last_word)

    for k in empty_keys:
        del index[k]
