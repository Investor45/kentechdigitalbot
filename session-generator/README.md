# KENTECH AI Session Generator

This private companion service creates session IDs accepted by the KENTECH AI
WhatsApp bot. It binds to localhost so a reverse proxy can provide HTTPS later.

```bash
SESSION_PORT=3100 node session-generator/server.js
```

Do not expose the service over plain HTTP. When a subdomain is available, place
Nginx or Caddy with HTTPS in front of `127.0.0.1:3100`.
