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
  if (!repliedContent(message)) return message.send('Reply to an image, video, or text with .gstatus.')
  if (typeof message.setStatus !== 'function' && typeof message.groupStatus !== 'function') {
    return message.send('Group status is not supported by this bot build.')
  }
  // Read the full command as well: some dispatcher paths pass only one capture.
  const command = String(message.text || '').trim().match(/^[.,!+]?gstatus(?:\s+|\/)([\s\S]*)$/i)
  const argument = String(command?.[1] || match || '').trim()
  const tokens = argument.split(/[\s,;]+/).filter(Boolean)
  const invalid = tokens.filter(jid => !/^\d+(?:-\d+)?(?:@g\.us)?$/.test(jid))
  if (invalid.length) return message.send('Invalid group ID. Use .gstatus 123@g.us,456@g.us (numeric IDs also work). Copy the IDs from .groupids.')
  const targets = argument
    ? tokens.map(jid => jid.endsWith('@g.us') ? jid : `${jid}@g.us`)
    : (message.isGroup ? [message.jid] : [])
  if (!targets.length) return message.send('Use .gstatus inside a group, or pass group JIDs.')
  let posted = 0
  for (const jid of new Set(targets)) {
    try {
      // setStatus uses the native status@broadcast payload and preserves the
      // replied image/video/text. The legacy groupStatus helper only carried
      // text on some client builds, so keep it as a compatibility fallback.
      if (typeof message.setStatus === 'function') {
        try {
          await message.setStatus(message, [jid], jid)
        } catch (nativeError) {
          // Older WhatsApp sessions may reject the native audience form.
          // Retry through the compatibility helper before reporting failure.
          if (typeof message.groupStatus !== 'function') throw nativeError
          await message.groupStatus(message, jid)
        }
      } else await message.groupStatus(message, jid)
      posted++
    } catch (error) {
      process.stderr.write(`[gstatus] Group post failed: ${error?.name || 'Error'}\n`)
      await message.send(`Could not post the group status to ${jid}. Confirm that this WhatsApp account is still a member of the group and that the group ID is correct.`)
    }
  }
  if (posted) return message.send(posted === 1 ? 'Group status posted.' : `Group status posted to ${posted} groups.`)
}

for (const [name, handler] of [['mystatus', mystatus], ['groupids', groupids], ['gstatus', gstatus]]) {
  registerOwnerCommand(bot, name, handler, `Owner ${name} command`)
}
