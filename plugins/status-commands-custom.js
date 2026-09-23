const { bot } = require('../lib/')
const { isOwner, registerOwnerCommand } = require('../lib/owner-commands')

function repliedContent(message) {
  const reply = message.reply_message
  return Boolean(reply && (reply.image || reply.video || reply.txt || String(reply.text || '').trim()))
}

async function sendGroupPost(message, jid) {
  const reply = message.reply_message
  const socket = message.client
  if (!socket?.sendMessage) throw new Error('WhatsApp client is unavailable')
  if (typeof socket.groupMetadata !== 'function') throw new Error('WhatsApp group metadata is unavailable')
  const metadata = await socket.groupMetadata(jid)
  const recipients = [...new Set((metadata?.participants || [])
    .map(participant => String(participant.id || '').trim())
    .filter(id => /@(?:s\.whatsapp\.net|lid)$/.test(id)))]
  if (!recipients.length) throw new Error('No valid members were found for this group')
  const caption = String(reply.text || '').trim()
  let payload
  if (reply.image || reply.video) {
    if (typeof reply.downloadMediaMessage !== 'function') throw new Error('Replied media cannot be downloaded')
    const media = await reply.downloadMediaMessage()
    if (!media || !media.length) throw new Error('Replied media download was empty')
    payload = reply.video ? { video: media, caption } : { image: media, caption }
  } else {
    const text = String(reply.text || '').trim()
    if (!text) throw new Error('Replied text is empty')
    payload = { text }
  }
  const result = await socket.sendMessage('status@broadcast', payload, {
    broadcast: true,
    statusJidList: recipients,
  })
  if (!result?.key?.id) throw new Error('WhatsApp did not confirm the status message')
  return result
}

async function sendPersonalStatus(message) {
  const socket = message.client
  if (!socket?.sendMessage) throw new Error('WhatsApp client is unavailable')
  const reply = message.reply_message
  const caption = String(reply.text || '').trim()
  let payload
  if (reply.image || reply.video) {
    if (typeof reply.downloadMediaMessage !== 'function') throw new Error('Replied media cannot be downloaded')
    const media = await reply.downloadMediaMessage()
    if (!media || !media.length) throw new Error('Replied media download was empty')
    payload = reply.video ? { video: media, caption } : { image: media, caption }
  } else {
    if (!caption) throw new Error('Replied text is empty')
    payload = { text: caption }
  }
  const result = await socket.sendMessage('status@broadcast', payload, { broadcast: true })
  if (!result?.key?.id) throw new Error('WhatsApp did not confirm the personal status')
  return result
}

async function mystatus(message) {
  if (!isOwner(message)) return
  if (!repliedContent(message)) return message.send('Reply to an image, video, or text with .mystatus.')
  try {
    await sendPersonalStatus(message)
    return message.send('Personal status posted successfully.')
  } catch (error) {
    process.stderr.write(`[mystatus] ${error?.stack || error}\n`)
    return message.send(`Could not post your personal status: ${String(error?.message || error).slice(0, 180)}`)
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

async function bulkstatus(message) {
  if (!isOwner(message)) return
  try {
    const groups = await message.client.groupFetchAllParticipating()
    const entries = Object.entries(groups || {}).filter(([jid]) => /@g\.us$/.test(jid))
    if (!entries.length) return message.send('No WhatsApp groups were found.')
    const lines = ['Groups included in bulk status:', '']
    entries.forEach(([jid, metadata], index) => {
      lines.push(`${index + 1}. ${metadata?.subject || 'Unnamed group'}`, `   ${jid}`)
    })
    lines.push('', 'Remove unwanted GIDs, then use these commands:', '')
    const jids = entries.map(([jid]) => jid)
    for (let i = 0; i < jids.length; i += 8) {
      lines.push(`.gstatus ${jids.slice(i, i + 8).join(',')}`)
    }
    return message.send(lines.join('\n'))
  } catch (_) {
    return message.send('I could not fetch your WhatsApp groups. Please try again.')
  }
}

async function gstatus(message, match) {
  process.stderr.write(`[gstatus] command received text=${String(message.text || '').slice(0, 120)} native=${typeof message.groupStatus === 'function'}\n`)
  if (!repliedContent(message)) return message.send('Reply to an image, video, or text with .gstatus.')
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
      process.stderr.write(`[gstatus] sending target=${jid} media=${Boolean(message.reply_message?.image || message.reply_message?.video)}\n`)
      // Prefer the runtime's native group-status implementation. Older
      // builds do not expose it, so send the replied text/photo/video through
      // WhatsApp's status broadcast API with the target group's members.
      const hasMedia = Boolean(message.reply_message?.image || message.reply_message?.video)
      const result = !hasMedia && typeof message.groupStatus === 'function'
        ? await message.groupStatus(message, jid)
        : await sendGroupPost(message, jid)
      process.stderr.write(`[gstatus] native group status completed target=${jid} result=${result ? 'returned' : 'empty'}\n`)
      posted++
    } catch (error) {
      const detail = String(error?.message || error || 'unknown error').slice(0, 180)
      process.stderr.write(`[gstatus] delivery failed for ${jid}: ${detail}\n`)
      await message.send(`Could not post the group status to ${jid}: ${detail}`)
    }
  }
  if (posted) return message.send(posted === 1 ? 'Group status posted.' : `Group status posted to ${posted} groups.`)
}

for (const [name, handler] of [['mystatus', mystatus], ['df', mystatus], ['groupids', groupids], ['bulkstatus', bulkstatus], ['gstatus', gstatus]]) {
  registerOwnerCommand(bot, name, handler, `Owner ${name} command`)
}
