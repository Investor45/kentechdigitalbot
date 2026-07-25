const { bot } = require('../lib')

async function statusAudience(message) {
  const audience = new Set()
  const add = (jid) => {
    jid = String(jid || '')
    if (jid && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))) audience.add(jid)
  }

  for (const contacts of [message.client?.store?.contacts, message.client?.contacts, global.store?.contacts]) {
    if (!contacts) continue
    const values = contacts instanceof Map ? contacts.values() : Object.values(contacts)
    for (const contact of values) add(contact?.id || contact?.jid)
  }

  try {
    const groups = await message.client.groupFetchAllParticipating()
    for (const group of Object.values(groups || {})) {
      for (const participant of group.participants || []) add(participant.id)
    }
  } catch (_) {}

  add(message.jid)
  const own = String(message.client?.user?.id || message.client?.user?.jid || '')
  audience.delete(own)
  return [...audience]
}

// Owner-only shortcut that does not depend on the configured command prefix.
bot({ on: 'text', fromMe: true, type: 'statusShortcut' }, async (message) => {
  if (String(message.text || '').trim().toLowerCase() !== '+status') return
  if (!message.reply_message || (!message.reply_message.image && !message.reply_message.video)) {
    return message.send('Reply to an image or video with +status.')
  }
  const audience = await statusAudience(message)
  if (!audience.length) return message.send('No Status audience was found. Add the bot to a group with your contacts first.')
  const count = await message.setStatus(message, audience, 'status')
  return message.send(`Status posted to ${count} contact(s).`)
})
