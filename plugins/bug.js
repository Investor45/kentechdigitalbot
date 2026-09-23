const { bot } = require('../lib')
const { isOwner, registerOwnerCommand } = require('../lib/owner-commands')
const { setBan, clearBan } = require('../lib/user-bans')

function targetJid(message) {
  const reply = message.reply_message
  return String(reply?.jid || reply?.key?.participant || reply?.key?.participantAlt || (!message.isGroup ? message.jid : '') || '')
    .replace(/:\d+(?=@)/, '')
}

function duration(value) {
  const match = String(value || '').trim().match(/^(\d+)(m|h|d)$/i)
  if (!match) return null
  const amount = Number(match[1])
  const unit = { m: 60e3, h: 3600e3, d: 86400e3 }[match[2].toLowerCase()]
  return new Date(Date.now() + amount * unit).toISOString()
}

async function bug(message, match) {
  if (!isOwner(message)) return
  const args = String(match || '').trim().split(/\s+/).filter(Boolean)
  const mode = (args[0] || 'status').toLowerCase()
  const jid = targetJid(message)
  if (!/@(?:s\.whatsapp\.net|lid)$/.test(jid)) return message.send('Reply to the user in private, then use .bug temp 1h or .bug permanent.')
  if (mode === 'status') return message.send(`User protection status: ${require('../lib/user-bans').isBanned(jid) ? 'banned' : 'clear'}`)
  if (mode === 'off' || mode === 'unban') { clearBan(jid); return message.send('User ban removed.') }
  if (mode === 'permanent') {
    setBan(jid)
    try { await message.client.updateBlockStatus?.(jid, 'block') } catch (_) {}
    return message.send('User permanently blocked.')
  }
  const expiresAt = duration(args[1])
  if (!expiresAt) return message.send('Use .bug temp 30m, .bug temp 12h, or .bug temp 7d.')
  setBan(jid, expiresAt)
  return message.send(`User temporarily banned until ${expiresAt}.`)
}

registerOwnerCommand(bot, 'bug', bug, 'Owner-only temporary or permanent user ban command')
