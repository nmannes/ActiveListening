#!/usr/bin/env python3
"""
run_tests.py - Test runner for the CLIP classifier profiles.
Reads from results.json and validates the model against expected outcomes.
"""

import json
import os
import sys

# Add src/python to path so we can import pylib/clip.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src", "python")))

from pylib.clip import FrameClassifier


def main():
    test_dir = os.path.dirname(os.path.abspath(__file__))
    results_file = os.path.join(test_dir, "results.json")
    images_dir = os.path.join(test_dir, "images")

    with open(results_file, "r") as f:
        test_cases = json.load(f)

    # Cache classifiers so we only load each profile once
    classifiers = {}

    passed_count = 0
    failed_count = 0

    print(f"Running {len(test_cases)} tests...\n")

    for i, test in enumerate(test_cases, 1):
        image_name = test["image"]
        profile = test["profile"]
        expected = test["expected_is_desired_content_visible"]
        desc = test["description"]

        image_path = os.path.join(images_dir, image_name)

        if not os.path.exists(image_path):
            print(f"[{i}/{len(test_cases)}] ⚠️  SKIP: Image not found {image_path}")
            failed_count += 1
            continue

        with open(image_path, "rb") as f:
            frame_bytes = f.read()

        # Load classifier on demand
        if profile not in classifiers:
            classifiers[profile] = FrameClassifier(
                device="cpu", content_profile=profile
            )

        classifier = classifiers[profile]

        try:
            result = classifier.classify(frame_bytes)
            actual = result["is_desired_content_visible"]
            confidence = result["confidence"]

            if actual == expected:
                print(
                    f"[{i}/{len(test_cases)}] ✅ PASS: {image_name} ({profile}) - {desc}"
                )
                print(
                    f"          -> result: {actual} (expected: {expected}), conf: {confidence:.4f}"
                )
                passed_count += 1
            else:
                print(
                    f"[{i}/{len(test_cases)}] ❌ FAIL: {image_name} ({profile}) - {desc}"
                )
                print(
                    f"          -> result: {actual} (expected: {expected}), conf: {confidence:.4f}"
                )
                failed_count += 1

        except Exception as e:
            print(
                f"[{i}/{len(test_cases)}] ❌ ERROR: {image_name} ({profile}) - {desc}"
            )
            print(f"          -> {e}")
            failed_count += 1

    print(f"\n{'='*40}")
    print(f"Test Summary: {passed_count} passed, {failed_count} failed")
    print(f"{'='*40}")

    if failed_count > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
