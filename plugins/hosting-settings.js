const { bot, getVars } = require('../lib/')
const { settingsPages } = require('../lib/settings-display')
bot({ pattern: 'allvar ?(.*)', fromMe: true, desc: 'Show bot settings with sensitive values hidden', type: 'vars' }, async message => {
  if (message.isGroup || String(message.jid || '').endsWith('@g.us')) return message.send('Use allvar in a private chat with this bot.')
  try {
    const values = await getVars(message.id)
    for (const page of settingsPages(values)) await message.send(page)
  } catch (_) { await message.send('Bot settings are temporarily unavailable. Please try again.') }
})
