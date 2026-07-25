const { bot } = require('../lib/')

bot(
  {
    pattern: 'gid',
    fromMe: true,
    desc: 'Show the current WhatsApp group ID',
    type: 'tools',
  },
  async (message) => {
    if (!message.isGroup) {
      return message.send('Use .gid inside a WhatsApp group.')
    }

    return message.send(`Group ID:\n${message.jid}`)
  }
)
