# Temporary media cleanup

Owner/sudo commands (use the bot's configured prefix):

- `.mediastorage`: preview disposable media and report free VPS disk and temporary-filesystem space.
- `.clearmedia`: remove eligible temporary media, then report the number and bytes removed.

For a bot using `!`, use `!mediastorage` and `!clearmedia`.

Cleanup also runs at startup and hourly. It removes regular, single-link media files older than six hours directly inside the bot's `temp` directory, plus old `input.mp4`/`output.mp4` files inside known `kentech-youtube-XXXXXX` scratch directories. Recent files, active conversions, symlinks, nested directories and unexpected files are retained. It never sweeps the general VPS filesystem or the bot's permanent media assets, databases, credentials, sessions, inbox, backups or node_modules.

The video converter already removes its scratch directory in `finally` on both success and failure. The sweep catches stale files left by interrupted processes and legacy media operations. Each hosted bot clears only the files visible to its isolated runtime. The commands do not request sudo or execute shell deletion commands.

On VPS deployments with a tmpfs `/tmp`, temporary media consumes RAM rather than disk. Clearing media does not guarantee more hosting slots: RAM, CPU and configured deployment limits still apply.

Validation: `node --test lib/test/media-cleanup.test.js lib/test/sudo-access.test.js lib/test/youtube-download.test.js lib/test/download-presentation.test.js` (24 tests). Tests use disposable fixtures and mocked message sending; no customer files or chats are altered.
