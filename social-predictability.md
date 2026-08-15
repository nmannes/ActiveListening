# Social Predictability

Generated 2026-08-15

## Method

For each recorded appearance session with (a) a Kalshi mention market row, (b) the guest's speaker labeled in `data/speaker_labels.json`, and (c) cached X posts for the guest (`social/x-<handle>.jsonl`): take the show's candidate words (the event's Kalshi markets) and compare each word's presence in the guest's pre-show posts (lookback window) with whether the guest actually said it on the show. Word matching follows Kalshi resolution rules (word boundaries, plural/possessive forms).

## Coverage

- no mention sessions found
- usable in this analysis: 0

Nothing to analyze yet. Fetch posts with `./bin/kalshi social fetch <handle>`, label guest speakers with `scripts/label_speaker.py`, then re-run.
