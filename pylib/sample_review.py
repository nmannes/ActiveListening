"""sample_review.py — review-batch size/diversity policy for voice samples.

Shared by scripts/generate_samples.py (the /generate flow) and
scripts/queue_worker.py (the Redis-driven pipeline).  Stdlib-only on purpose
so the policy is unit-testable without librosa/torch/redis.

Caps: at most MAX_REVIEW_PER_VIDEO clips per source video and
MAX_REVIEW_PER_BATCH per run, so one person never floods the Telegram chat
with >10 clips in a row.  MAX_PERSIST_PER_VIDEO bounds what stays on
disk/Redis (review set + best spares); everything else is dropped after
selection because auto_best and the /next flow only act on persisted segments.
"""

MAX_REVIEW_PER_VIDEO = 4
MAX_REVIEW_PER_BATCH = 10
MAX_PERSIST_PER_VIDEO = 8


def select_review_subset(segments, *, max_per_video, min_sources,
                         max_batch=MAX_REVIEW_PER_BATCH):
    """Pick the segments that get sent to Telegram for human review.

    Diversity policy: up to ``max_per_video`` segments per source video (hard
    capped at MAX_REVIEW_PER_VIDEO so no sample video dominates), at least
    ``min_sources`` distinct sources when available, and at most ``max_batch``
    total (so one person never floods the chat with >10 clips in a row). When
    trimming to the batch cap, the best segment from each of the first
    ``min_sources`` sources is preserved and remaining slots go to the
    highest scores.

    Returns ``(review_indices, diverse, seen_sources)`` where ``review_indices``
    are indices into ``segments`` and ``diverse`` is the same pairs sorted by
    score descending.
    """
    max_per_video = max(1, min(max_per_video, MAX_REVIEW_PER_VIDEO))

    by_source = {}
    for i, s in enumerate(segments):
        src = s.get("source", "unknown")
        by_source.setdefault(src, []).append((i, s))
    for entries in by_source.values():
        entries.sort(key=lambda x: x[1]["score"], reverse=True)

    diverse = []
    for src, entries in by_source.items():
        diverse.extend(entries[:max_per_video])
    diverse.sort(key=lambda x: x[1]["score"], reverse=True)

    # Ensure at least min_sources distinct sources
    seen_sources = {segments[idx].get("source") for idx, _ in diverse}
    if len(seen_sources) < min_sources:
        for src in sorted(by_source):
            if len(seen_sources) >= min_sources:
                break
            if src in seen_sources:
                continue
            idx, s = by_source[src][0]
            diverse.append((idx, s))
            seen_sources.add(src)
        diverse.sort(key=lambda x: x[1]["score"], reverse=True)

    # Trim to max_batch, keeping one representative from each of the first
    # min_sources sources so the diversity guarantee survives the trim.
    if len(diverse) > max_batch:
        guaranteed = []
        covered = set()
        guaranteed_idx = set()
        for idx, s in diverse:
            src = s.get("source", "unknown")
            if src not in covered and len(covered) < min_sources:
                covered.add(src)
                guaranteed.append((idx, s))
                guaranteed_idx.add(idx)
        rest = [(i, s) for i, s in diverse if i not in guaranteed_idx]
        diverse = guaranteed + rest[: max(0, max_batch - len(guaranteed))]
        diverse.sort(key=lambda x: x[1]["score"], reverse=True)
        seen_sources = {s.get("source", "unknown") for _, s in diverse}

    review_indices = [idx for idx, _ in diverse]
    return review_indices, diverse, seen_sources


def select_persist_subset(segments, review_indices, max_per_video=MAX_PERSIST_PER_VIDEO):
    """Indices to write to disk / register in Redis.

    Review-selected segments plus the best remaining spares per source video
    (the ``auto_best`` flow picks the top unresolved segment per source, so
    spares are useful), capped at ``max_per_video`` total per source. Anything
    outside this set is dropped — no files written, no verification state.
    """
    review_set = set(review_indices)
    by_source = {}
    for i, s in enumerate(segments):
        by_source.setdefault(s.get("source", "unknown"), []).append(i)

    persist = set(review_set)
    for src, idxs in by_source.items():
        idxs.sort(key=lambda i: segments[i]["score"], reverse=True)
        room = max_per_video - sum(1 for i in idxs if i in review_set)
        for i in idxs:
            if room <= 0:
                break
            if i not in persist:
                persist.add(i)
                room -= 1
    return persist
