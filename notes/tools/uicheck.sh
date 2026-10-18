#!/usr/bin/env bash
# Usage: notes/tools/uicheck.sh <export-dir> <frame.svg> <app route, e.g. /welcome> [uicheck.py options]
# Env: JS='…' runs in the page before the app shot (tap, type…), WAIT=ms settle time.
# Needs the web dev server (launch.json "mobile-web", port 8090) and Playwright's headless Chromium.
# Writes design/app/side-by-side PNGs to $OUT (default /tmp/uicheck) and prints the layer report.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
dir=$1; frame=$2; route=$3; shift 3
out=${OUT:-/tmp/uicheck}; mkdir -p "$out"
ch=$(ls -d ~/.cache/ms-playwright/chromium_headless_shell-*/*/ | tail -1)chrome-headless-shell
name=$(basename "$frame" .svg | tr ' ' '_')
shot() { timeout 120 "$ch" --no-sandbox --hide-scrollbars --force-device-scale-factor=2 --window-size=390,844 "$@" 2>/dev/null >/dev/null; }
shot --screenshot="$out/$name.design.png" "file://$(realpath "$dir/$frame")"
sep='?'; [[ $route == *\?* ]] && sep='&'
TEXTS_OUT="$out/$name.texts.json" node "$here/shot.mjs" "http://localhost:8090${route}${sep}capture" "$out/$name.app.png" "${WAIT:-2500}" "${JS:-}"
magick "$out/$name.app.png" "$out/$name.design.png" +append -resize 50% "$out/$name.side.png"
# overlay: grey where both agree, cyan = only in the design, red = only in the app
magick \( "$out/$name.design.png" -colorspace gray \) \( "$out/$name.app.png" -colorspace gray \) \( "$out/$name.app.png" -colorspace gray \) -combine -resize 50% "$out/$name.ov.png"
python3 -I "$here/uicheck.py" "${SNAP:-$here/../snapshots/latest.json.gz}" "$frame" "$out/$name.design.png" "$out/$name.app.png" --texts "$out/$name.texts.json" "$@"
