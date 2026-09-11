const {
  bot,
  parsedJid,
  validateTime,
  createStatusSchedule,
  getScheduleStatus,
  delScheduleStatus,
  deleteScheduleStatusTask,
  lang,
  isGroup,
  isAdmin
} = require('../lib/')

const hasStatusReply = reply => Boolean(reply &&
  (reply.image || reply.video || reply.txt || String(reply.text || '').trim()))

const scheduleMyStatusRenewals = message => {
  for (const delay of [23, 46].map(hours => hours * 60 * 60 * 1000)) {
    const timer = setTimeout(() => {
      Promise.resolve(message.setStatus(message, [], 'contact')).catch(() => {})
    }, delay)
    timer.unref?.()
  }
}

const myStatusHandler = async message => {
  if (!message.data?.key?.fromMe) return
  if (!hasStatusReply(message.reply_message)) {
    return message.send('Reply to an image, video, or text with .mystatus.')
  }
  if (typeof message.setStatus !== 'function') {
    return message.send('Personal status is not supported by this bot build.')
  }
  try {
    const statusCount = await message.setStatus(message, [], 'contact')
    scheduleMyStatusRenewals(message)
    return message.send(`Status posted to ${statusCount || 'your'} contact(s). It will renew for over 48 hours.`)
  } catch (_) {
    return message.send('Could not post your personal status. Please try again.')
  }
}

bot(
  {
    pattern: 'mystatus',
    desc: 'Post replied media or text to your personal status',
    type: 'whatsapp',
    fromMe: true,
  },
  myStatusHandler
)

bot({ on: 'text', fromMe: true, type: 'myStatusOwner' }, async message => {
  if (String(message.text || '').trim().toLowerCase() === 'mystatus') return myStatusHandler(message)
})

bot(
  {
    pattern: 'setstatus ?(.*)',
    desc: lang.plugins.setstatus.desc,
    type: 'whatsapp',
  },
  async (message, match) => {
    const jids = parsedJid(match)
    if (jids.length === 0 && match !== 'contact') {
      return await message.send(lang.plugins.setstatus.usage)
    }
    if (
      !message.reply_message ||
      (!message.reply_message.image && !message.reply_message.video && !message.reply_message.txt)
    ) {
      return await message.send(lang.plugins.setstatus.reply_required)
    }
    const statusCount = await message.setStatus(message, jids, match)
    await message.send(lang.plugins.setstatus.sent.format(statusCount))
  }
)

bot(
  {
    pattern: 'scstatus ?(.*)',
    desc: lang.plugins.scstatus.desc,
    type: 'whatsapp',
  },
  async (message, match) => {
    if (match === 'list') {
      const statuses = await getScheduleStatus(message.id)
      let msg = lang.plugins.scstatus.list
      statuses.forEach((status) => {
        msg += `\n\ntime : ${status.time}\njids: ${status.jids.length > 1 ? status.jids : 'contact'
          }`
      })
      return await message.send(msg)
    }
    if (match.startsWith('delete')) {
      match = match.replace('delete', '').trim()
      await delScheduleStatus(match, message.id)
      await deleteScheduleStatusTask(match, message.id)
      return await message.send('deleted!')
    }
    const [_, time] = match.split('|')
    const isTimeValid = validateTime(time)
    const jids = parsedJid(match)
    if ((jids.length === 0 && match.startsWith('contact')) || !isTimeValid) {
      return await message.send(lang.plugins.scstatus.usage)
    }
    if (
      !message.reply_message ||
      (!message.reply_message.image && !message.reply_message.video && !message.reply_message.txt)
    ) {
      return await message.send(lang.plugins.scstatus.reply_required)
    }
    const at = await createStatusSchedule(isTimeValid, message, jids, message.id)
    return await message.send(lang.plugins.scstatus.scheduled.format(at))
  }
)

const normalizeJid = jid => String(jid || '').replace(/:\d+(?=@)/, '')
const groupAlias = subject => String(subject || 'group')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '') || 'group'

async function ownedGroups(message) {
  const groups = await message.client.groupFetchAllParticipating()
  const own = [message.client.user?.id, message.client.user?.jid, message.client.user?.lid]
    .map(normalizeJid)
    .filter(Boolean)
  const used = new Set()
  return Object.entries(groups || {}).flatMap(([jid, metadata]) => {
    const participants = Array.isArray(metadata) ? metadata : metadata.participants || []
    const isAdmin = participants.some(participant => participant.admin &&
      [participant.id, participant.lid, participant.phoneNumber, participant.jid]
        .map(normalizeJid).some(id => own.includes(id)))
    if (!isAdmin) return []
    const base = groupAlias(metadata.subject)
    let alias = base
    let index = 2
    while (used.has(alias)) alias = `${base}-${index++}`
    used.add(alias)
    return [{ jid, alias, subject: metadata.subject || jid }]
  })
}

const listOwnedGroups = async message => {
  let groups
  try {
    groups = await ownedGroups(message)
  } catch (_) {
    return message.send('I could not fetch your WhatsApp groups. Please try again.')
  }
  if (!groups.length) return message.send('No groups where this account is an admin were found.')
  const lines = ['Your WhatsApp admin groups:', '']
  groups.forEach((group, index) => {
    lines.push(`${index + 1}. ${group.subject}`)
    lines.push(`Group ID: ${group.jid}`)
    lines.push(`Code: ${group.alias}`)
    lines.push(`Post: gstatus/${group.alias}`, '')
  })
  return message.send(lines.join('\n').trim())
}

for (const pattern of ['groupids', 'listgroupgit']) {
  bot(
    {
      pattern,
      desc: 'List your WhatsApp admin groups and group IDs',
      type: 'whatsapp',
      fromMe: true,
    },
    listOwnedGroups
  )
}

bot({ on: 'text', fromMe: true, type: 'groupIdsOwner' }, async message => {
  const text = String(message.text || '').trim().toLowerCase()
  if (text === 'groupids' || text === 'listgroupgit') return listOwnedGroups(message)
})

const scheduleStatusDeletion = (message, result) => {
  const keys = Array.isArray(result) ? result : [result]
  for (const key of keys) {
    if (!key?.id || typeof message.client?.sendMessage !== 'function') continue
    const timer = setTimeout(() => message.client.sendMessage('status@broadcast', {
      delete: { ...key, remoteJid: key.remoteJid || 'status@broadcast', fromMe: false },
    }).catch(() => {}), 48 * 60 * 60 * 1000)
    timer.unref?.()
  }
}

const gstatusHandler = async (message, match) => {
  // Enforce account ownership even when the framework treats sudo as fromMe.
  if (!message.data?.key?.fromMe) return
  const reply = message.reply_message
  if (!reply || (!reply.image && !reply.video && !reply.txt && !String(reply.text || '').trim())) {
    return message.send('Reply to an image, video, or text with .gstatus inside the group.')
  }
  const argument = String(match || '').trim().replace(/^\//, '')
  let targets
  if (argument) {
    const tokens = argument.split(/\s+/)
    const aliases = tokens.filter(target => !target.endsWith('@g.us'))
    const byAlias = aliases.length
      ? new Map((await ownedGroups(message)).map(group => [group.alias, group.jid]))
      : new Map()
    targets = tokens.flatMap(target => byAlias.has(target) ? [byAlias.get(target)] : parsedJid(target))
  } else {
    targets = message.isGroup ? [message.jid] : []
  }
  if (!targets.length) return message.send('Use .gstatus/<group-name> from private chat, or .gstatus inside a group.')
  if (typeof message.groupStatus !== 'function') {
    return message.send('Group status is not supported by this bot build.')
  }
  const own = [message.client.user?.id, message.client.user?.jid, message.client.user?.lid,
    message.data.key.participant, message.data.key.participantAlt].map(normalizeJid).filter(Boolean)
  let posted = 0
  for (const jid of new Set(targets)) {
    try {
      const metadata = await message.client.groupMetadata(jid)
      const participants = Array.isArray(metadata) ? metadata : metadata.participants || []
      const admin = participants.some(p => p.admin && [p.id, p.lid, p.phoneNumber].map(normalizeJid).some(id => own.includes(id)))
      if (!admin) {
        await message.send('Your bot account must be an admin in the target group to post its status.')
        continue
      }
      const statusKey = await message.groupStatus(message, jid)
      scheduleStatusDeletion(message, statusKey)
      posted++
    } catch (_) {
      await message.send('Could not post the group status. Check the group permissions and try again.')
    }
  }
  if (posted) return message.send(posted === 1 ? 'Group status posted.' : `Group status posted to ${posted} groups.`)
}

bot(
  {
    pattern: 'gstatus ?(.*)',
    desc: 'Reply to an image, video, or text to post a group status',
    type: 'whatsapp',
    fromMe: true,
  },
  gstatusHandler
)

bot(
  {
    pattern: 'gstatus/(.*)',
    desc: 'Post a group status using an owned group alias',
    type: 'whatsapp',
    fromMe: true,
  },
  gstatusHandler
)
