# View-once, settings and conversion repairs

Use the account's configured prefix (`!` or `.`):

- `vv`: owner/sudo only; reply to an available view-once image, video or audio message. Modern wrapper variants are decoded. Consumed/expired media cannot be recovered. The hosted plugin directory now includes this command; it no longer depends on optional `eplugins` loading.
- `allvar`: owner/sudo only, private chat only. Shows saved settings in bounded pages; credentials, session information and unknown/private configuration values are hidden. Hosted deployments retain the exclusion of unrestricted variable-editing plugins.
- `compress`: reply to video. Uses a bounded local FFmpeg job, single-threaded codecs and a compatible MP4 output. An already-smaller compatible original is retained.
- `convert mp3|mp4|jpg|png|sticker`: reply to media. Uses local codecs rather than an external conversion site.

New processing jobs accept media up to 20 MB, run one conversion at a time per bot, have a two-minute FFmpeg timeout and clean their scratch files on success/failure. Old scratch artifacts are covered by the hourly stale-media sweep. Unsupported formats, missing replies and expired downloads return a message rather than failing silently.

Validation includes wrapper decoding, bounded settings output/redaction, owner permissions, private-chat restrictions, actual compression handler invocation, real FFmpeg output for five formats, scratch cleanup on codec failure, command-prefix handling and the full Node regression suite. Linux fixtures are generated locally; no customer media, orders or WhatsApp messages are sent during testing.

Legacy regression fixtures were updated to reflect existing behavior: startup's health-monitor attachment, selection of the custom owner status route alongside legacy aliases, status-media versus text paths, and the current explicit-block/no-auto-ban group guard policy. Production status and group-guard behavior is unchanged by these test corrections.

Automated validation does not establish end-to-end operation of every third-party API, account, payment or group permission. Those require their own authorized live inputs.
