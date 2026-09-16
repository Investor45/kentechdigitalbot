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

The installer asks for the bot username, `SESSION_ID`, the deployer's WhatsApp
number with country code, and `PREFIX` (default `.`). The deployer's number is
added to the bot controllers. Keep `config.env` private.

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

It asks for the bot username, WhatsApp session ID, deployer's WhatsApp number,
and command prefix without opening an editor. Press Enter at the prefix prompt
to use `.`. Never commit `config.env`, session files, or database files; they
contain private account information.

### Generate a KENTECH session ID

Start the included generator on the VPS or PC:

```bash
SESSION_PORT=3100 npm run session
```

For safe testing before a subdomain is connected, open an SSH tunnel from your PC:

```bash
ssh -L 3100:127.0.0.1:3100 user@your-server
```

Visit `http://127.0.0.1:3100`, enter the WhatsApp number with country code, and
follow the Linked Devices instructions. Paste the generated `KENTECH_...` value
into `SESSION_ID`. The generator binds only to localhost until an HTTPS reverse
proxy is configured.

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

The KENTECH generator now issues 28-character IDs beginning with `KTECH_`.
Authentication is encrypted in the generator's persistent session store. A new
deployment retrieves and decrypts it using the short ID; subsequent restarts use
the bot's local database. Keep the ID private, keep the session store backed up,
and keep the generator available for new deployments. Older long `KENTECH_`
sessions and Levanter sessions remain supported. Set `SESSION_SERVER_URL` in
`config.env` when using a different generator address.

Every deployment includes automatic group downloads, duplicate prevention,
group status commands and bot filtering. Automatic downloads start disabled on
fresh deployments; manual video commands remain available. The installer asks
whether you want automation and, if you choose yes, asks for the group's GID.
You can also configure it later: use `.autodownload on`, follow the prompt to get
your group ID with `.gid`, then run `.autodownload save GROUP_GID`. Multiple GIDs
can be separated by commas. `.autodownload list` shows saved groups;
`.autodownload off` disables the current group. Substitute your chosen prefix
for `.`. Saved GIDs survive restarts and repository updates. Use `.botguard on`
to enable filtering, reply to an unwanted bot with `.silencebot`, and use
`.releasebot` to allow that account again. `.releasebots` disables the filter.

The deployer's number keeps owner access. The permanent KENTECH AI administrator
`237670217260` also has sudo access on every deployment, including the custom
status and group-control commands. The installer still asks for each user's
bot name, session ID, WhatsApp number and command prefix (default `.`).

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

[Contact KENTECH AI on WhatsApp](https://wa.me/237670217260?text=Hello%20sir%2C%20I%20saw%20your%20WhatsApp%20bot%20on%20GitHub%20and%20I%20am%20interested%20in%20getting%20it%20on%20WhatsApp.%20What%20are%20the%20procedures%3F)

The link opens a WhatsApp chat with this message already filled in:

> Hello sir, I saw your WhatsApp bot on GitHub and I am interested in getting it
> on WhatsApp. What are the procedures?

Users can also open an issue in this repository with the command used, the
expected result, and sanitized logs. Remove phone numbers, session IDs, API keys
and passwords first.

## License

This project is distributed under the MIT license. Third-party packages retain
their respective licenses and notices.

Use `.update` (or your configured prefix, such as `,update`) as the bot owner or administrator to install new features from the KENTECH GitHub branch and restart the current bot. Sessions, configuration, databases and saved download groups stay in place. Local code edits are backed up in Git stash rather than reapplied over the latest features. The bot reports when it is already current. Updates require a KENTECH Git checkout running under PM2; automatic background source updates remain disabled.
