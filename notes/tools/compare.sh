#!/usr/bin/env bash
# Usage: notes/tools/compare.sh <export.zip> <name> [--partial]
# Diffs a new design export against notes/snapshots/latest.json.gz and writes
# notes/changes/<name>.raw.md; then makes the export the new baseline.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
zip=$1; name=$2; partial=${3:-}
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/svg"; unzip -q "$zip" -d "$tmp/svg"
python3 -I "$here/tools/svgdiff.py" snap "$tmp/svg" "$tmp/new.json.gz" 2>/dev/null
python3 -I "$here/tools/svgdiff.py" diff "$here/snapshots/latest.json.gz" "$tmp/new.json.gz" > "$here/changes/$name.raw.md"
if [ "$partial" = --partial ]; then
  python3 -I "$here/tools/svgdiff.py" merge "$here/snapshots/latest.json.gz" "$tmp/new.json.gz" "$tmp/merged.json.gz"
  cp "$tmp/merged.json.gz" "$here/snapshots/latest.json.gz"
else
  cp "$tmp/new.json.gz" "$here/snapshots/latest.json.gz"
fi
grep '^|' "$here/changes/$name.raw.md" | grep -v '| 0 |'
