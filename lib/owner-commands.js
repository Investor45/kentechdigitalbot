const normalizeJid = jid => String(jid || '').replace(/:\d+(?=@)/, '')

// KENTECH AI's Message class keeps the original key in message.message, not data.
function messageKey(message) {
  return message.message?.key || message.data?.key || message.key || {}
}

function isOwner(message) {
  const key = messageKey(message)
  if (typeof key.fromMe === 'boolean') return key.fromMe
  const own = [message.client?.user?.id, message.client?.user?.jid, message.client?.user?.lid]
    .map(normalizeJid).filter(Boolean)
  return [key.participant, key.participantAlt, message.participant]
    .map(normalizeJid).some(id => own.includes(id))
}

function registerOwnerCommand(bot, name, handler, desc, aliases = []) {
  const seen = new Set()
  const objects = new WeakSet()
  const run = async (message, match) => {
    if (!isOwner(message)) return
    const key = messageKey(message)
    if (key.id) {
      const id = `${key.remoteJid || message.jid}:${key.id}`
      if (seen.has(id)) return
      seen.add(id)
      if (seen.size > 1000) seen.delete(seen.values().next().value)
    } else {
      if (objects.has(message)) return
      objects.add(message)
    }
    return handler(message, match)
  }
  const names = [name, ...aliases]
  // The raw key enforces ownership; do not rely on the framework's sudo/fromMe flag.
  for (const command of names) bot({ pattern: `${command}(?:\\s+|/|$)(.*)`, desc, type: 'whatsapp' }, run)
  bot({ on: 'text', type: `${name}Owner` }, message => {
    const match = String(message.text || '').trim().match(/^[.,!+]?([a-z]+)(?:\s+|\/|$)([\s\S]*)$/i)
    if (match && names.includes(match[1].toLowerCase())) return run(message, match[2])
  })
}

module.exports = { normalizeJid, messageKey, isOwner, registerOwnerCommand }
