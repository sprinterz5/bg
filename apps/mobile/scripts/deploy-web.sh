#!/bin/sh
# Builds the web version and uploads it to the VPS (Caddy serves /srv/uni-web at https://web.31-220-92-154.sslip.io).
set -e
cd "$(dirname "$0")/.."
out=$(mktemp -d)
npx expo export -p web --output-dir "$out"
rsync -az --delete "$out/" root@31.220.92.154:/srv/uni-web/
rm -rf "$out"
