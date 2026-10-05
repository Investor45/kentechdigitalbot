# KENTECH AI Session Generator

This private companion service creates session IDs accepted by the KENTECH AI
WhatsApp bot. It binds to localhost so a reverse proxy can provide HTTPS later.

Production generator: **https://172.236.139.122/**

The generator runs independently of the WhatsApp bot. Nginx serves the website
over HTTPS and forwards `/api/` to `127.0.0.1:3100`. Port 3100 stays private.
The bot's default `SESSION_SERVER_URL` uses the same HTTPS address; an explicit
environment override takes precedence.

Standalone deployment files:

- `package.deploy.json`: generator-only dependencies, installed as the release's
  root `package.json` instead of the full bot package.
- `kentech-session-generator.service`: systemd unit, dedicated service user,
  persistent encrypted session vault at `/var/lib/kentech-session-generator`.
- `nginx.conf`: HTTP redirect, HTTPS reverse proxy and certificate challenge path.

Releases live in `/opt/kentech-session-generator/releases/`; `current` selects the
active release. A Let's Encrypt IP certificate is renewed by the dedicated
`kentech-session-certificate.timer` with an Nginx reload hook. Never put VPS login
credentials, pairing codes, session IDs or vault records into this repository.

The old VPS's encrypted session vault is not copied while that VPS is offline.
Existing bots that have already imported their session keep their local credentials.
An old short ID that was never imported needs its old vault record or a new pairing.

```bash
SESSION_PORT=3100 node session-generator/server.js
```

Do not expose the service over plain HTTP. When a subdomain is available, place
Nginx or Caddy with HTTPS in front of `127.0.0.1:3100`.
