# Kentech Bot Custom Source

This folder is the permanent source project for the Kentech WhatsApp bot.
It is based on Levanter commit `8237001098f72ec9b9bfa82a4780283c5426995b`.

All bot edits must be made here first and then deployed to the VPS. Never
treat a VPS bot folder as the only copy of a customization.

## Safe files

- Commit bot code, local plugins, documentation, and deployment scripts.
- Never commit `config.env`, session IDs, credentials, databases, logs, or `node_modules`.
- Use `config.env.example` as the configuration template for a new server.

## Development

```bash
yarn install
yarn test
```

Put permanent custom commands in `plugins/`. Files copied from the live
KENBOY5 deployment are preserved in `eplugins/` for reference and reuse.
The runtime files that must survive every redeployment are recorded in
`deploy/custom-files.txt`.

Current permanent features include:

- Kentech sales assistant and manual offer flow
- YouTube Shorts/links and `.video` use the existing YT1D-backed provider's
  merged-video route through `lib/youtube-download.js`. Direct Google media
  downloads were rejected by the VPS network. Default quality is 480p with
  audio, capped at 60 MB, with bounded lookup, conversion and transfer times.
  `ffprobe` checks audio/video streams; `ffmpeg` converts incompatible video
  codecs to H.264/AAC for WhatsApp. Both programs must be installed on the VPS.
- custom `.alive`, `.gid`, and `.vcf` commands
- group-restricted social and YouTube automatic downloads
- `.autodownload on`, `.autodownload off`, and status controls
- persistent `AUTO_STATUS_VIEW=no-dl` deployment defaults
- disabled upstream auto-update and Levanter startup advertisement
- Download-group bot filtering is installed before the Baileys client starts.
  It deletes new messages from detected or manually silenced bot accounts,
  while allowing this account and ordinary members' download requests.
  Detection uses known bot message IDs and downloader captions; it is heuristic.
  Group admin permission is required. Owner commands: `.botguard on`,
  `.botguard status`, `.releasebots` (disable for the group), and reply with
  `.silencebot` / `.releasebot` for an individual sender. Settings persist in
  `download-group-guard.json`; runtime permission/errors are recorded in
  `download-group-guard-status.json`. Neither runtime file belongs in git.
- TikTok command and group downloads use `lib/tiktok-download.js`, with
  verified MP4 bytes, alternate media links, and a 60 MB limit. Regression
  checks: `node --test lib/test/tiktok-download.test.js`.

## Deploy on a new VPS

Owner commands use the original WhatsApp key (`message.message.key` in Levanter
6.1.7), with compatibility for older `data.key` messages. `.gid` shows the current
group ID; `.groupids` lists groups where the connected account is an admin or
owner; reply with `.mystatus` to post personal status to saved status contacts.
These commands also accept bare text. `.gstatus` posts to the current group, and
`.gstatus/<alias>` uses an alias from `.groupids`. Duplicate command/event dispatch
is suppressed. Personal-status renewals use in-process timers and do not survive
a restart.

In groups protected by `.botguard on`, native `groupStatusMessage` and
`groupStatusMessageV2` posts from known non-admin members are deleted. Admin and
owner posts are allowed; personal statuses and unprotected groups are untouched.
`.botguard off` disables this protection along with bot-message filtering.
Deletion still requires WhatsApp to grant this account group-admin permission.

Regression checks: `node --test lib/test/gstatus.test.js lib/test/download-group-guard.test.js`.

Clone this project, create `config.env` from the example, add a newly generated
session ID, and run:

```bash
bash deploy/deploy.sh /root/DIGITAL
```

The script installs production dependencies, starts or restarts the PM2 app,
and saves the PM2 process list for reboot recovery.

Before deploying, preserve the live `config.env`, session/authentication data,
and databases. These contain server-specific secrets and must not be copied
into this source folder.
