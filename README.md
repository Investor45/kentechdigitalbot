# KENTECH AI WhatsApp Bot

A self-hosted WhatsApp automation bot with group moderation, status tools,
social-media downloads, stickers, media conversion, plugins, and optional API
and webhook support.

## Main features

- TikTok, YouTube, Instagram, Facebook, X and other media downloads
- Personal and group status posting, including multi-group posting
- Group IDs, owner commands, anti-link and bot-message protection
- Welcome, goodbye, warnings, stickers and media utilities
- Multi-session support and optional HTTP API/webhooks
- Responses in multiple languages

## Requirements

- Ubuntu 20.04 or newer on a VPS, or Windows 10/11 on a PC
- Node.js 20 or newer
- Git, FFmpeg and curl
- At least 1 GB RAM; 2 GB is recommended

## Deploy on a VPS or PC

### Quick VPS deployment

On a fresh Ubuntu/Debian VPS, paste these commands as a sudo-capable user:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn pm2
git clone -b kentech-custom https://github.com/Investor45/kentechdigitalbot.git kentech-ai
cd kentech-ai
cp config.env.example config.env
nano config.env
bash deploy/deploy.sh "$(pwd)"
pm2 save
pm2 status
pm2 logs kentech-ai --lines 100
```

Set `SESSION_ID`, `SUDO`, `PREFIX`, and `BOT_LANG` in `config.env` before
running the deployment command. Keep `config.env` private.

Windows users can run the PowerShell deployment script directly. WSL2 with
Ubuntu is also supported if you prefer Bash.

### 1. Install system packages

```bash
sudo apt update
sudo apt install -y git curl ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn pm2
```

On Windows PowerShell, install Node.js 20+, Git, and FFmpeg, then run:

```powershell
corepack enable
corepack prepare yarn@1.22.22 --activate
npm install -g pm2
```

### 2. Clone KENTECH AI

```bash
git clone -b kentech-custom https://github.com/Investor45/kentechdigitalbot.git kentech-ai
cd kentech-ai
```

### 3. Configure the bot

```bash
cp config.env.example config.env
nano config.env
```

At minimum, set your WhatsApp session and owner number:

```env
SESSION_ID=your_session_id
SUDO=237600000000
PREFIX=.
BOT_LANG=en
TZ=Africa/Lagos
```

Never commit `config.env`, session files, or database files. They contain private
account information.

### 4. Install and start

```bash
bash deploy/deploy.sh "$(pwd)"
```

On Windows PowerShell:

```powershell
.\deploy\deploy.ps1
```

The deployment script installs dependencies, validates the application, starts
it as `kentech-ai` with PM2, and saves the PM2 process list for reboot recovery.

Useful commands:

```bash
pm2 status
pm2 logs kentech-ai
pm2 restart kentech-ai --update-env
pm2 stop kentech-ai
```

After a successful connection or restart, the connected WhatsApp account receives
a private KENTECH AI startup message.

## Updating

Back up `config.env`, the database, and session files first. Then run:

```bash
git pull origin kentech-custom
yarn install --frozen-lockfile
pm2 restart kentech-ai --update-env
```

Automatic source updates are disabled so they cannot overwrite custom features.

## Optional API mode

Add these values to `config.env` when an HTTP API is required:

```env
API_MODE=true
API_KEY=replace-with-a-strong-secret
PORT=3000
API_PUBLIC_URL=https://your-own-domain.example
API_WEBHOOK_URL=https://your-own-domain.example/webhook
```

API requests use the `x-api-key` header. Keep the key private and place the API
behind HTTPS before exposing it publicly.

## Support

Open an issue in this repository with the command used, the expected result, and
sanitized logs. Remove phone numbers, session IDs, API keys and passwords first.

## License

This project is distributed under the MIT license. Third-party packages retain
their respective licenses and notices.
