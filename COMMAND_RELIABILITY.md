# Command prefixes and reply health

Private chats accept the configured bot prefix as well as the legacy `+` alias.
Group command patterns and all existing active/fromMe/sudo restrictions remain
unchanged. New plugin registrations and prefix changes are synchronized.

Fresh commands sent from the linked phone into Message Yourself are accepted
when WhatsApp marks them as append/history events. Only fromMe messages in the
linked account's own PN/LID chat, created since the socket started, qualify.
Message IDs are deduplicated across notify/append/history routes. Ordinary chat
history and generated bot replies are not promoted into commands.

The legacy loader previously forced private patterns to `^[+]`, which caused a
valid configured command such as `!ping` to be ignored in private conversations.
The adaptation wraps registration and prefix updates without editing obfuscated
upstream files.

`command-health.json` is a private, bounded snapshot of connection state, command
registry counts and reply queue progress. Ping diagnostics record counts and
event metadata only, never message text, chat addresses or credentials.

A connected, paused reply queue with pending work and no running worker resumes
after one stable minute. A connected active queue with no progress for ten
minutes exits with code 75 so the service supervisor can restart it. Idle and
disconnected bots are not restarted by this monitor. Unknown in-flight messages
are not replayed. Use systemd Restart=on-failure/always or an equivalent PM2
restart policy. This cannot guarantee uninterrupted WhatsApp or provider service.
