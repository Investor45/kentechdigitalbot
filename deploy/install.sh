#!/usr/bin/env bash
set -euo pipefail
umask 077
REPO_URL="${KENTECH_REPO_URL:-https://github.com/Investor45/kentechdigitalbot.git}"
BRANCH="${KENTECH_BRANCH:-kentech-custom}"
ROOT="${KENTECH_BOTS_ROOT:-$HOME/kentech-bots}"
[[ "$(uname -s)" == Linux ]] || { echo 'Run this installer on the Linux VPS.' >&2; exit 1; }
command -v node >/dev/null && command -v git >/dev/null && command -v yarn >/dev/null || {
  echo 'Install Node.js >=20, Git and Yarn before running setup.' >&2; exit 1;
}
read -r -p 'Unique bot name (letters, numbers, underscore, hyphen): ' bot_name </dev/tty
[[ "$bot_name" =~ ^[A-Za-z][A-Za-z0-9_-]{1,39}$ ]] || { echo 'Unsafe bot name.' >&2; exit 1; }
mkdir -p "$ROOT"
ROOT="$(cd "$ROOT" && pwd -P)"
APP_DIR="$ROOT/$bot_name"
[[ ! -L "$APP_DIR" ]] || { echo 'Symlink deployment refused.' >&2; exit 1; }
exec 9>"$ROOT/.install.lock"
flock -n 9 || { echo 'Another installer is running.' >&2; exit 1; }
if [[ -e "$APP_DIR" ]]; then
  [[ -f "$APP_DIR/.kentech-instance.json" ]] || { echo 'Existing unmanaged directory preserved; choose a new bot name.' >&2; exit 1; }
  node -e 'const i=require(process.argv[1]+"/lib/instance").readInstance(process.argv[1]); if(i.name!==process.argv[2])process.exit(1)' "$APP_DIR" "$bot_name"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
  [[ ! -e config.env && ! -e database.db ]] || { echo 'Repository contains private runtime data; refusing installation.' >&2; exit 1; }
  yarn install --frozen-lockfile --production=false
  node deploy/instance-tools.js init "$APP_DIR" "$bot_name"
fi
cd "$APP_DIR"
read -r -p 'WhatsApp SESSION_ID (visible; verify before pressing Enter): ' session_id </dev/tty
printf '\n' >/dev/tty
[[ -n "$session_id" ]] || { echo 'SESSION_ID is required; deployment was not started.' >&2; exit 1; }
read -r -p 'Owner number with country code: ' sudo_number </dev/tty
[[ "$sudo_number" =~ ^[0-9]{10,15}$ ]] || { echo 'Invalid owner number.' >&2; exit 1; }
read -r -p 'Command prefix [,]: ' prefix </dev/tty
prefix="${prefix:-,}"
[[ ${#prefix} -eq 1 && "$prefix" == [.!+,?#/_-] ]] || { echo 'Invalid prefix.' >&2; exit 1; }
printf '%s\n%s\n%s\n' "$session_id" "$sudo_number" "$prefix" |
  node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const [SESSION_ID,SUDO,PREFIX]=s.split("\n");process.stdout.write(JSON.stringify({SESSION_ID,SUDO,PREFIX}))})' |
  node deploy/instance-tools.js configure "$APP_DIR"
unset session_id
bash deploy/deploy.sh "$APP_DIR"
