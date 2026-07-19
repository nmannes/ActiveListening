#!/usr/bin/env python3
import json, sys
from pathlib import Path

if len(sys.argv) != 4:
    print(f"Usage: {sys.argv[0]} <session_id> <speaker_num> <speaker_name>", file=sys.stderr)
    sys.exit(1)

session_id, speaker_num, speaker_name = sys.argv[1], sys.argv[2], sys.argv[3]
REPO_ROOT = Path(__file__).parent.parent
labels_path = REPO_ROOT / "data" / "speaker_labels.json"
labels = json.load(open(labels_path))
labels.setdefault(session_id, {})
labels[session_id][speaker_num] = speaker_name
json.dump(labels, open(labels_path, "w"), indent=2)
print(f"Labeled {session_id}/{speaker_num} -> {speaker_name}")
