#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${KENTECH_REPO_URL:-https://github.com/Investor45/kentechdigitalbot.git}"
BRANCH="${KENTECH_BRANCH:-kentech-custom}"
APP_DIR="${KENTECH_DIR:-$HOME/kentech-ai}"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer is for an Ubuntu/Debian VPS. Use deploy.ps1 on Windows." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer requires an Ubuntu/Debian VPS with apt-get." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git curl ffmpeg

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v yarn >/dev/null 2>&1; then
  sudo npm install -g yarn
fi
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  if [[ -e "$APP_DIR" ]]; then
    echo "$APP_DIR already exists and is not a Git checkout." >&2
    exit 1
  fi
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
[[ -f config.env ]] || cp config.env.example config.env

if [[ -t 0 ]]; then
  echo "Edit config.env and set SESSION_ID and SUDO before the bot starts."
  "${EDITOR:-nano}" config.env
else
  echo "Created $APP_DIR/config.env. Set SESSION_ID and SUDO, then run:"
  echo "bash deploy/deploy.sh $APP_DIR"
  exit 0
fi

bash deploy/deploy.sh "$APP_DIR"
