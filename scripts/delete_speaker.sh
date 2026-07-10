#!/bin/bash
# Deletes all speaker embedding + audio files for a given name from
# ~/audio-library/ and s3://<bucket>/speaker_embeddings/

set -euo pipefail

BUCKET="${S3_BUCKET:-recordings-846345203908-us-east-1-an}"
AUDIO_LIB="$HOME/audio-library"
S3_PREFIX="speaker_embeddings"

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  echo "Usage: $0 <name>"
  echo "  Deletes all ~/audio-library/<name>* and s3://$BUCKET/$S3_PREFIX/<name>* files."
  echo
  echo "Examples:"
  echo "  $0 bernie-sanders     # matches bernie-sanders, bernie-sanders-1, etc."
  echo "  $0 evan-spiegel-1     # matches only the -1 variant"
  exit 1
}

[ $# -eq 1 ] || usage
NAME="$1"

echo "=== Local: ~/audio-library/ ==="
count=$(find "$AUDIO_LIB" -maxdepth 1 -name "${NAME}*" -type f 2>/dev/null | wc -l)
if [ "$count" -eq 0 ]; then
  echo "  No files found matching '${NAME}*'"
else
  find "$AUDIO_LIB" -maxdepth 1 -name "${NAME}*" -type f -print0 | while IFS= read -r -d '' f; do
    echo "  rm $(basename "$f")"
    rm "$f"
  done
  echo "  Deleted $count file(s)"
fi

echo ""
echo "=== S3: s3://$BUCKET/$S3_PREFIX/ ==="
keys=$(aws s3 ls "s3://$BUCKET/$S3_PREFIX/" 2>/dev/null | grep -o "${NAME}[^ ]*\\.\(wav\\|embedding\)$" || true)
if [ -z "$keys" ]; then
  echo "  No files found matching '${NAME}*'"
else
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    echo "  aws s3 rm s3://$BUCKET/$S3_PREFIX/$key"
    aws s3 rm "s3://$BUCKET/$S3_PREFIX/$key"
  done <<< "$keys"
  key_count=$(echo "$keys" | grep -c . || true)
  echo "  Deleted $key_count file(s)"
fi

echo ""
echo "Done."
