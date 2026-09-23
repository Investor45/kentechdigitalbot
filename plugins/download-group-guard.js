const { bot } = require('../lib')
const { getGuard, normalize } = require('../lib/download-group-guard')
const { isOwner, registerOwnerCommand } = require('../lib/owner-commands')

async function control(message, action) {
  // fromMe can include configured sudo users in some builds; check the raw key.
  if (!isOwner(message)) return
  if (!message.isGroup) return message.send('Use this command inside the download group.')
  const guard = getGuard()
  try {
    if (action === 'status') {
      const cfg = guard.group(message.jid)
      return message.send(`Bot filter: ${cfg?.enabled ? 'ON' : 'OFF'}\nUnsupported-link filter: ${cfg?.enabled ? 'ON' : 'OFF'}\nSilenced accounts: ${cfg?.blocked.length || 0}\nReleased accounts: ${cfg?.released.length || 0}\nGroup admins and this bot are exempt.\n.botguard on / off\n.disablebotdownloads on / off`)
    }
    const reply = message.reply_message
    const targets = [...(message.mention || []), reply?.jid, reply?.key?.participant, reply?.key?.participantAlt].filter(Boolean)
    const own = [message.client.user?.id, message.client.user?.jid, message.client.user?.lid].map(normalize).filter(Boolean)
    if (action === 'block' && targets.some(jid => own.includes(normalize(jid)))) return message.send('Your own account stays allowed.')
    if (action === 'on') {
      const meta = await message.client.groupMetadata(message.jid)
      if (!meta.participants.some(p => p.admin && [p.id, p.lid, p.phoneNumber].some(jid => own.includes(normalize(jid))))) {
        return message.send('Make your bot account a group admin so it can delete other bots’ messages.')
      }
    }
    guard.configure(message.jid, action, targets)
    return message.send(action === 'off' ? 'Bot filter OFF. Other bots are released.' : action === 'on' ? 'Bot filter ON. Detected bot replies will be deleted silently.' : action === 'release' ? 'Sender released and allowed by the bot filter.' : 'Sender silenced in this group.')
  } catch (error) { return message.send(error.message) }
}

registerOwnerCommand(bot, 'botguard', (message, match) => control(message, String(match || 'status').trim().toLowerCase()), 'Control the group bot filter')
registerOwnerCommand(bot, 'silencebot', message => control(message, 'block'), 'Silence the replied sender')
registerOwnerCommand(bot, 'releasebot', message => control(message, 'release'), 'Release the replied sender')
registerOwnerCommand(bot, 'releasebots', message => control(message, 'off'), 'Disable the group bot filter')
registerOwnerCommand(bot, 'disablebotdownloads', (message, match) => {
  const action = String(match || 'on').trim().toLowerCase() || 'on'
  return control(message, action === 'status' ? 'status' : action === 'off' ? 'off' : 'on')
}, 'Block other bot downloads while allowing group administrators')
