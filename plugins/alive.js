const { bot } = require('../lib/')

const START_MESSAGE = `
PREFIX    : .
MENU      : .menu | .help | .list
VERSION   : 6.0.5
PLUGINS   : 183
E-PLUGINS : 46
🛡️ SUDO      : 237670217260
📖 AUTO READ MSG    : ❎
👀 AUTO STATUS VIEW : ✅ (no-dl)
🚫 AUTO REJECT CALL : ❎
🔋 ALWAYS ONLINE    : ✅
🛡️ ANTI DELETE MSG  : ✅ (p)
🔄 AUTO UPDATE BOT  : ❎


Telegram : https://t.me/bestmediadownloader

Channel : https://whatsapp.com/channel/0029VaX6kguGk1Fr135z610I

WHATSAPP GROUP
https://chat.whatsapp.com/JZ7Cpya0ho9150PSEqifs4
`.trim()

bot(
  {
    pattern: 'alive ?(.*)',
    desc: 'Show the Kentech Digital start message',
    type: 'misc',
  },
  async (message) => message.send(START_MESSAGE)
)
