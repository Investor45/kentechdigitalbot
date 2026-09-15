#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$(pwd)}"
APP_NAME="${APP_NAME:-}"

cd "$APP_DIR"

if [[ ! -f package.json ]]; then
  echo "package.json was not found in $APP_DIR" >&2
  exit 1
fi

if [[ ! -f config.env ]]; then
  echo "Create $APP_DIR/config.env from config.env.example before deployment." >&2
  exit 1
fi

if [[ -z "$APP_NAME" ]]; then
  APP_NAME="$(sed -n 's/^BOT_NAME="\(.*\)"$/\1/p' config.env | head -n 1)"
  APP_NAME="${APP_NAME:-kentech-ai}"
fi

yarn install --frozen-lockfile --production=false

required_runtime_files=(
  index.js
  lib/index.js
  lib/client.js
  lib/download-group-guard.js
  lib/yt-auth.js
  lib/db/amenu.js
)

for runtime_file in "${required_runtime_files[@]}"; do
  if [[ ! -f "$runtime_file" ]]; then
    echo "Required runtime file is missing: $APP_DIR/$runtime_file" >&2
    exit 1
  fi
  node --check "$runtime_file"
done

PM2="$APP_DIR/node_modules/.bin/pm2"
if "$PM2" describe "$APP_NAME" >/dev/null 2>&1; then
  "$PM2" restart "$APP_NAME" --update-env
else
  "$PM2" start "$APP_DIR" --name "$APP_NAME" --cwd "$APP_DIR"
fi

"$PM2" save
"$PM2" status
