const { bot } = require('../lib/')
const { isOwner, registerOwnerCommand } = require('../lib/owner-commands')

function repliedContent(message) {
  const reply = message.reply_message
  return Boolean(reply && (reply.image || reply.video || reply.txt || String(reply.text || '').trim()))
}

async function mystatus(message) {
  if (!isOwner(message)) return
  if (!repliedContent(message)) return message.send('Reply to an image, video, or text with .mystatus.')
  if (typeof message.setStatus !== 'function') return message.send('Personal status is not supported by this bot build.')
  try {
    let count
    try {
      count = await message.setStatus(message, [], 'contact')
    } catch (error) {
      if (!/contact list is empty/i.test(String(error?.message || error))) throw error
      const own = [message.client?.user?.id, message.client?.user?.jid, message.client?.user?.lid]
        .map(String).find(jid => /@(s\.whatsapp\.net|lid)$/.test(jid))
      if (!own) throw error
      count = await message.setStatus(message, [own], own)
    }
    return message.send('Personal status posted successfully.')
  } catch (error) {
    process.stderr.write(`[mystatus] ${error?.stack || error}\n`)
    return message.send('Could not post your personal status. Reply to the media again and try.')
  }
}

async function groupids(message) {
  if (!isOwner(message)) return
  try {
    const groups = await message.client.groupFetchAllParticipating()
    const entries = Object.entries(groups || {})
    if (!entries.length) return message.send('No WhatsApp groups were found.')
    const lines = ['Your WhatsApp groups:', '']
    entries.forEach(([jid, metadata], index) => {
      lines.push(`${index + 1}. ${metadata.subject || jid}`, `Group ID: ${jid}`, '')
    })
    return message.send(lines.join('\n').trim())
  } catch (_) {
    return message.send('I could not fetch your WhatsApp groups. Please try again.')
  }
}

async function gstatus(message, match) {
  if (!isOwner(message)) return
  if (!repliedContent(message)) return message.send('Reply to an image, video, or text with .gstatus.')
  if (typeof message.groupStatus !== 'function') return message.send('Group status is not supported by this bot build.')
  const targets = String(match || '').trim()
    ? String(match).trim().split(/[\s,]+/).filter(jid => jid.endsWith('@g.us'))
    : (message.isGroup ? [message.jid] : [])
  if (!targets.length) return message.send('Use .gstatus inside a group, or pass group JIDs.')
  let posted = 0
  for (const jid of new Set(targets)) {
    try {
      await message.groupStatus(message, jid)
      posted++
    } catch (_) {
      await message.send(`Could not post the group status to ${jid}. WhatsApp may require admin permission for that group.`)
    }
  }
  if (posted) return message.send(posted === 1 ? 'Group status posted.' : `Group status posted to ${posted} groups.`)
}

for (const [name, handler] of [['mystatus', mystatus], ['groupids', groupids], ['gstatus', gstatus]]) {
  registerOwnerCommand(bot, name, handler, `Owner ${name} command`)
}
