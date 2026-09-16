#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${KENTECH_REPO_URL:-https://github.com/Investor45/kentechdigitalbot.git}"
BRANCH="${KENTECH_BRANCH:-kentech-custom}"
APP_DIR="${KENTECH_DIR:-$HOME/kentech-ai}"
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RESET='\033[0m'

clear 2>/dev/null || true
printf "${CYAN}\n"
cat <<'BANNER'
+------------------------------------------------------------------+
|                         KENTECH AI                              |
|                  WHATSAPP BOT INSTALLER                        |
|                                                                  |
|              Simple setup for VPS and Ubuntu                    |
+------------------------------------------------------------------+
BANNER
printf "${RESET}\n"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "This installer is for an Ubuntu/Debian VPS. Use deploy.ps1 on Windows." >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer requires an Ubuntu/Debian VPS with apt-get." >&2
  exit 1
fi

printf "${YELLOW}[1/5] Installing system packages...${RESET}\n"
sudo apt-get update
sudo apt-get install -y git curl ffmpeg

printf "${YELLOW}[2/5] Checking Node.js, Yarn, and PM2...${RESET}\n"

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

printf "${YELLOW}[3/5] Preparing bot directory: %s${RESET}\n" "$APP_DIR"
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

read_hidden_line() {
  local prompt="$1"
  local target="$2"
  local tty_state value
  tty_state="$(stty -g </dev/tty)"
  printf '%s' "$prompt" >/dev/tty
  stty -echo -icanon min 1 time 0 </dev/tty
  if ! IFS= read -r value </dev/tty; then
    stty "$tty_state" </dev/tty
    printf '\n' >/dev/tty
    return 1
  fi
  stty "$tty_state" </dev/tty
  printf '\n' >/dev/tty
  printf -v "$target" '%s' "$value"
}

valid_session_id() {
  printf '%s' "${1:-}" | node -e '
    let value = ""
    process.stdin.on("data", chunk => { value += chunk })
    process.stdin.on("end", () => {
      try {
        if (!value || /\s/.test(value) || value.length > 250000) throw new Error("Invalid session")
        if (value.startsWith("KENTECH_")) require("./lib/session-bundle").decodeSession(value)
        if (value.startsWith("KTECH_") && !require("./lib/short-session").SHORT_SESSION.test(value)) throw new Error("Invalid short session")
      } catch (_) { process.exitCode = 1 }
    })
  '
}

if [[ ! -t 0 ]]; then
  echo "Created $APP_DIR/config.env. Run this installer from an interactive terminal to enter bot settings." >&2
  exit 0
fi

printf "${GREEN}[4/5] KENTECH AI setup${RESET}\n"
echo "Answer the questions below. No editor will be opened."
while :; do
  read -r -p "Bot username [KENTECH AI]: " bot_name
  bot_name="${bot_name:-KENTECH AI}"
  if [[ "$bot_name" =~ ^[[:alnum:]_.\ -]{2,40}$ ]]; then break; fi
  echo "Username must be 2-40 letters, numbers, spaces, dots, underscores, or hyphens."
done
while :; do
  read_hidden_line "WhatsApp SESSION_ID (hidden): " session_id || exit 1
  if valid_session_id "$session_id"; then break; fi
  echo "SESSION_ID is empty, contains spaces, or is too long. Paste the complete ID on one line."
done
while :; do
  read -r -p "Your WhatsApp number with country code: " sudo_number
  sudo_number="${sudo_number//[^0-9]/}"
  [[ "$sudo_number" =~ ^[0-9]{10,15}$ ]] && break
  echo "Enter 10-15 digits including country code. Example: 237670217260."
done
read -r -p "Command prefix [.] : " prefix
prefix="${prefix:-.}"
if [[ ${#prefix} -ne 1 || "$prefix" != [.!+,?#/_-] ]]; then
  echo "Prefix must be one supported symbol: . ! + , ? # / _ or -" >&2
  exit 1
fi

set_env BOT_NAME "$bot_name"
set_env SESSION_ID "$session_id"
set_env SUDO "$sudo_number"
set_env PREFIX "$prefix"
chmod 600 config.env
printf "${GREEN}[5/5] Configuration saved to %s${RESET}\n" "$APP_DIR/config.env"

APP_NAME="$bot_name" bash deploy/deploy.sh "$APP_DIR"
printf "${GREEN}\n+===============================================================\n"
printf "  KENTECH AI is installed and running.\n"
printf "  Check status with: pm2 status\n"
printf "===============================================================\n${RESET}\n"
