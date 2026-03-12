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
    """Check if the newly added word completes any keyword phrase."""
    candidates = index.get(word)
    if not candidates:
        return None

    for candidate in candidates:
        length = len(candidate["words"])
        if len(transcript) < length:
            continue

        tail = transcript[-length:]
        if tail == candidate["words"]:
            return {"key": candidate["key"], "value": candidate["value"]}

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
