const { bot } = require('../lib/')
const { registerOwnerCommand, messageKey } = require('../lib/owner-commands')

registerOwnerCommand(bot, 'gid',
  async (message) => {
    const jid = message.jid || messageKey(message).remoteJid
    if (!String(jid || '').endsWith('@g.us')) {
      return message.send('Use .gid inside a WhatsApp group.')
    }

    return message.send(`Group ID:\n${jid}`)
  }, 'Show the current WhatsApp group ID'
)
