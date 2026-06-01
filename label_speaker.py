#!/usr/bin/env python3
import json, sys

if len(sys.argv) != 4:
    print(f"Usage: {sys.argv[0]} <session_id> <speaker_num> <speaker_name>", file=sys.stderr)
    sys.exit(1)

session_id, speaker_num, speaker_name = sys.argv[1], sys.argv[2], sys.argv[3]
labels = json.load(open("speaker_labels.json"))
labels.setdefault(session_id, {})
labels[session_id][speaker_num] = speaker_name
json.dump(labels, open("speaker_labels.json", "w"), indent=2)
print(f"Labeled {session_id}/{speaker_num} -> {speaker_name}")
