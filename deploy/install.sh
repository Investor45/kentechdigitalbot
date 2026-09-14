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

set_env() {
  local key="$1"
  local value="$2"
  local temp_file
  temp_file="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { prefix = key "="; updated = 0 }
    index($0, prefix) == 1 { print prefix "\"" value "\""; updated = 1; next }
    { print }
    END { if (!updated) print prefix "\"" value "\"" }
  ' config.env > "$temp_file"
  mv "$temp_file" config.env
}

if [[ ! -t 0 ]]; then
  echo "Created $APP_DIR/config.env. Run this installer from an interactive terminal to enter bot settings." >&2
  exit 0
fi

echo "KENTECH AI setup"
echo "Answer the questions below. No editor will be opened."
readonly ADMIN_NUMBER="670217260"
while :; do
  read -r -s -p "WhatsApp SESSION_ID (hidden): " session_id
  echo
  [[ -n "$session_id" ]] && break
  echo "SESSION_ID is required."
done
read -r -p "Admin control number [$ADMIN_NUMBER] (locked): " sudo_number
sudo_number="${sudo_number//[^0-9]/}"
if [[ -n "$sudo_number" && "$sudo_number" != "$ADMIN_NUMBER" ]]; then
  echo "The admin control number is fixed and cannot be changed." >&2
  exit 1
fi
read -r -p "Command prefix [.] : " prefix
prefix="${prefix:-.}"
read -r -p "Bot language [en]: " bot_lang
bot_lang="${bot_lang:-en}"
read -r -p "Timezone [Africa/Lagos]: " timezone
timezone="${timezone:-Africa/Lagos}"

set_env SESSION_ID "$session_id"
set_env SUDO "$ADMIN_NUMBER"
set_env PREFIX "$prefix"
set_env BOT_LANG "$bot_lang"
set_env TIMEZONE "$timezone"
chmod 600 config.env
echo "Configuration saved to $APP_DIR/config.env"

bash deploy/deploy.sh "$APP_DIR"
