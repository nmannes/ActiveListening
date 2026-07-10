#!/usr/bin/env python3
"""Helper to extract values from config.yaml for bash scripts.

Usage:
  python3 get_config.py durations defaultMinutes        → 60
  python3 get_config.py aws region                      → us-east-1
  python3 get_config.py redis host                      → 127.0.0.1
"""
import sys, yaml
from pathlib import Path

config_path = Path(__file__).resolve().parent / "config.yaml"
with open(config_path) as f:
    data = yaml.safe_load(f)

for key in sys.argv[1:]:
    data = data[key]

print(data)