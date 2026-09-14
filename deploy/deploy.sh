#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-$(pwd)}"
APP_NAME="${APP_NAME:-kentech-ai}"

cd "$APP_DIR"

if [[ ! -f package.json ]]; then
  echo "package.json was not found in $APP_DIR" >&2
  exit 1
fi

if [[ ! -f config.env ]]; then
  echo "Create $APP_DIR/config.env from config.env.example before deployment." >&2
  exit 1
fi

yarn install --frozen-lockfile --production=false
node --check index.js

PM2="$APP_DIR/node_modules/.bin/pm2"
if "$PM2" describe "$APP_NAME" >/dev/null 2>&1; then
  "$PM2" restart "$APP_NAME" --update-env
else
  "$PM2" start "$APP_DIR" --name "$APP_NAME" --cwd "$APP_DIR"
fi

"$PM2" save
"$PM2" status
