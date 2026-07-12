#!/usr/bin/env python3
"""
Migrate existing S3 recordings: copy {slug}.json to event.json.

S3 layout per recording:
  {slug}_{timestamp}/
    transcript.json
    {slug}.json        <-- copy this to event.json
    audio/
    deepgram_responses/

This script finds all recordings that have a {slug}.json but no event.json,
and copies {slug}.json -> event.json in place.
"""

import os
import sys
import argparse
import boto3
from botocore.exceptions import ClientError


def get_bucket():
    return os.environ.get("S3_BUCKET", "recordings-846345203908-us-east-1-an")


def list_recording_prefixes(s3, bucket):
    """Yield each top-level recording prefix (the session directories)."""
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Delimiter="/"):
        for prefix in page.get("CommonPrefixes", []):
            yield prefix["Prefix"]


def get_root_json_files(s3, bucket, prefix):
    """Return set of JSON filenames directly under the given prefix (no subdirs)."""
    json_files = set()
    paginator = s3.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=bucket, Prefix=prefix, Delimiter="/"):
        for obj in page.get("Contents", []):
            key = obj["Key"]
            # Only root-level files: strip prefix, ensure no '/' remains
            relative = key[len(prefix):]
            if "/" not in relative and relative.endswith(".json"):
                json_files.add(relative)
    return json_files


def copy_object(s3, bucket, src_key, dst_key):
    """Copy an S3 object to a new key within the same bucket."""
    copy_source = {"Bucket": bucket, "Key": src_key}
    s3.copy_object(CopySource=copy_source, Bucket=bucket, Key=dst_key)
    print(f"  Copied: {src_key} -> {dst_key}")


def migrate_prefix(s3, bucket, prefix, dry_run=True):
    """Migrate a single recording prefix: find {slug}.json and copy to event.json."""
    json_files = get_root_json_files(s3, bucket, prefix)

    # Already migrated
    if "event.json" in json_files:
        return "already_migrated"

    # Find the slug json — the one that isn't transcript.json
    candidates = json_files - {"transcript.json"}
    if not candidates:
        return "no_slug_json"

    # There should be exactly one, but handle multiple defensively
    for filename in candidates:
        src_key = prefix + filename
        dst_key = prefix + "event.json"
        if not dry_run:
            copy_object(s3, bucket, src_key, dst_key)
        else:
            print(f"  [DRY-RUN] Would copy: {src_key} -> {dst_key}")
        return "migrated"

    return "no_slug_json"


def main():
    parser = argparse.ArgumentParser(
        description="Migrate S3 recordings: copy {slug}.json to event.json"
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=True,
        help="List what would be done without making changes (default)"
    )
    parser.add_argument(
        "--no-dry-run", dest="dry_run", action="store_false",
        help="Actually perform the copies"
    )
    parser.add_argument(
        "--prefix", type=str, default=None,
        help="Only migrate recording prefixes starting with this string"
    )
    parser.add_argument(
        "--bucket", type=str, default=None,
        help="S3 bucket name (default: $S3_BUCKET or recordings-846345203908-us-east-1-an)"
    )
    args = parser.parse_args()

    bucket = args.bucket or get_bucket()
    s3 = boto3.client("s3")

    print(f"Bucket: {bucket}")
    print(f"Mode: {'DRY-RUN' if args.dry_run else 'LIVE'}")
    if args.prefix:
        print(f"Filter prefix: {args.prefix}")
    print()

    stats = {"already_migrated": 0, "migrated": 0, "no_slug_json": 0, "total": 0}

    for prefix in list_recording_prefixes(s3, bucket):
        if args.prefix and not prefix.startswith(args.prefix):
            continue

        stats["total"] += 1
        print(f"[{stats['total']}] {prefix}")

        result = migrate_prefix(s3, bucket, prefix, dry_run=args.dry_run)
        stats[result] += 1
        print(f"       -> {result}")

    print()
    print("Summary:")
    print(f"  Total prefixes scanned: {stats['total']}")
    print(f"  Already had event.json: {stats['already_migrated']}")
    print(f"  Migrated:               {stats['migrated']}")
    print(f"  No slug JSON found:     {stats['no_slug_json']}")

    if args.dry_run:
        print("\nThis was a dry run. Run with --no-dry-run to apply changes.")


if __name__ == "__main__":
    main()
