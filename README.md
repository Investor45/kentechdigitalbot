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

On a fresh Ubuntu/Debian VPS, run this one-line installer as a sudo-capable user:

```bash
bash <(curl -fsSL https://tinyurl.com/2bbkrpfu)
```

The installer installs Node.js, FFmpeg, Yarn, and PM2; clones KENTECH AI; asks
for the bot settings directly in the terminal; and starts the bot with PM2.

For manual installation, use these commands:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ffmpeg
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn pm2
git clone -b kentech-custom https://github.com/Investor45/kentechdigitalbot.git kentech-ai
cd kentech-ai
bash deploy/install.sh
pm2 save
pm2 status
pm2 logs kentech-ai --lines 100
```

The installer asks for `SESSION_ID`, the locked admin number `670217260`,
`PREFIX`, language, and timezone. The admin number cannot be changed through
`config.env`. Keep `config.env` private.

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

The guided installer asks for these values directly in the terminal. If you
already cloned the repository manually, run:

```bash
bash deploy/install.sh
```

It asks for the WhatsApp session ID, locked admin number `670217260`, command
prefix, language, and timezone without opening an editor. Never commit `config.env`, session
files, or database files; they contain private account information.

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
