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
- custom `.alive`, `.gid`, and `.vcf` commands
- group-restricted social and YouTube automatic downloads
- `.autodownload on`, `.autodownload off`, and status controls
- persistent `AUTO_STATUS_VIEW=no-dl` deployment defaults
- disabled upstream auto-update and Levanter startup advertisement

## Deploy on a new VPS

Clone this project, create `config.env` from the example, add a newly generated
session ID, and run:

```bash
bash deploy/deploy.sh /root/KEN6
```

The script installs production dependencies, starts or restarts the PM2 app,
and saves the PM2 process list for reboot recovery.

Before deploying, preserve the live `config.env`, session/authentication data,
and databases. These contain server-specific secrets and must not be copied
into this source folder.
