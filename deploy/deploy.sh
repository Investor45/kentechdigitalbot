#!/usr/bin/env bash
set -euo pipefail
umask 077
APP_DIR="${1:-$(pwd)}"
cd "$APP_DIR"
APP_DIR="$(pwd -P)"
[[ -f config.env && -f .kentech-instance.json ]] || {
  echo 'Deployment requires an owned isolated instance. Existing unmanaged bots are preserved.' >&2
  exit 1
}
chmod 600 config.env
for file in index.js config.js lib/instance.js lib/import-session-bundle.js deploy/instance-tools.js; do
  node --check "$file"
done
node deploy/instance-tools.js deploy "$APP_DIR"
