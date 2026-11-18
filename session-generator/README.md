# KENTECH AI Session Generator

This private companion service creates session IDs accepted by the KENTECH AI
WhatsApp bot. It binds to localhost so a reverse proxy can provide HTTPS later.

Public pairing: **https://kentechdigital.site/pair/**.
Short-session clients use `SESSION_SERVER_URL=https://kentechdigital.site`.
Telegram hosting keeps its private `http://127.0.0.1:3100` connection.
The main-domain named tunnel reaches Nginx on loopback port 8874; Nginx forwards
only the pairing page, script and generator API routes to port 3100.
The storefront and reseller API remain separate applications.

Phone-number pairing sockets use the request's ten-minute lifetime instead of
the library's shorter QR rotation timeout. Enter a code promptly: WhatsApp can
still expire or reject it independently of the generator's request lifetime.

Standalone deployment files:

- `package.deploy.json`: generator-only dependencies, installed as the release's
  root `package.json` instead of the full bot package.
- `kentech-session-generator.service`: systemd unit, dedicated service user,
  persistent encrypted session vault at `/var/lib/kentech-session-generator`.
- `nginx.conf`: pointer to the current main-domain proxy configuration.

Releases live in `/opt/kentech-session-generator/releases/`; `current` selects the
active release. Public TLS is provided by the permanent Cloudflare named tunnel. Never put VPS login
credentials, pairing codes, session IDs or vault records into this repository.

The old VPS's encrypted session vault is not copied while that VPS is offline.
Existing bots that have already imported their session keep their local credentials.
An old short ID that was never imported needs its old vault record or a new pairing.

```bash
SESSION_PORT=3100 node session-generator/server.js
```

Do not expose the service over plain HTTP. When a subdomain is available, place
Nginx or Caddy with HTTPS in front of `127.0.0.1:3100`.
