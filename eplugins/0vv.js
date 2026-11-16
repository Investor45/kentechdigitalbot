const { bot } = require('../lib')
const { viewOnceCommand } = require('../lib/media-tools')

bot(
  {
    pattern: 'vv ?(.*)',
    fromMe: true,
    desc: 'antiViewOnce',
    type: 'whatsapp',
  },
  viewOnceCommand
)
