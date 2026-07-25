const { rmComma, bot, jidToNum, getVars, setVar } = require('../lib')

bot(
  {
    pattern: 'setsudo ?(.*)',
    fromMe: true,
    desc: 'add replied or mentioned or given num to sudo',
    type: 'vars',
  },
  async (message, match) => {
    match = jidToNum(message.reply_message.jid || message.mention[0] || match)
    if (!match) return await message.send('Example : setsudo 9876543210 | mention | reply to msg')
    try {
      const vars = await getVars(message.id)
      const SUDO = rmComma(`${vars.SUDO || ''},${match}`)
      await setVar({ SUDO }, message.id)
      return await message.send('```' + `New SUDO Numbers are : ${SUDO}` + '```')
    } catch (error) {
      return await message.send(error.message, { quoted: message.data })
    }
  }
)

bot(
  {
    pattern: 'delsudo ?(.*)',
    fromMe: true,
    desc: 'remove replied or mentioned or given num to sudo',
    type: 'vars',
  },
  async (message, match) => {
    match = jidToNum(message.reply_message.jid || message.mention[0] || match)
    if (!match) return await message.send('Example : delsudo 9876543210 | mention | reply to msg')
    try {
      const vars = await getVars(message.id)
      const SUDO = rmComma(vars.SUDO.replace(match, ''))
      await setVar({ SUDO }, message.id)
      await message.send('```' + `New SUDO Numbers are : ${SUDO}` + '```')
    } catch (error) {
      return await message.send(error.message, { quoted: message.data })
    }
  }
)

bot(
  {
    pattern: 'getsudo ?(.*)',
    fromMe: true,
    desc: 'show sudos',
    type: 'vars',
  },
  async (message, match) => {
    try {
      const vars = await getVars(message.id)
      await message.send('```' + `SUDO Numbers are : ${vars.SUDO}` + '```')
    } catch (error) {
      return await message.send(error.message, { quoted: message.data })
    }
  }
)
