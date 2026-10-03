#!/usr/bin/env python3
"""Builds the bundled exercise catalogue from free-exercise-db.

Source: https://github.com/yuhonas/free-exercise-db (Unlicense, public domain), pinned to a commit
so that the bundled data and the image URLs the app builds always match. Images are not bundled:
the app loads them from the same commit on demand and caches them.

Usage: python3 tools/exercises/fetch_exercises.py data/src/main/assets/exercises.json
"""
import json
import sys
import urllib.request

COMMIT = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5"
URL = f"https://raw.githubusercontent.com/yuhonas/free-exercise-db/{COMMIT}/dist/exercises.json"
FIELDS = ["id", "name", "category", "level", "equipment", "primaryMuscles", "secondaryMuscles", "instructions", "images"]


def main(output_path):
    with urllib.request.urlopen(URL, timeout=60) as response:
        exercises = json.load(response)
    trimmed = [{field: exercise.get(field) for field in FIELDS} for exercise in exercises]
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(trimmed, out, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(trimmed)} exercises written to {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
