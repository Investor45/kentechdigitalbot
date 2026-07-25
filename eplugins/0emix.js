const fs = require('fs')
const { getJson, sticker, bot, getBuffer } = require('../lib')
bot(
  {
    pattern: 'emix ?(.*)',
    fromMe: true,
    desc: 'mix emojis',
    type: 'search',
  },
  async (message, match) => {
    if (!match) return await message.send('Example .emix 🙂🙂')
    const { result } = await getJson(
      `https://levanter.onrender.com/emix?q=${encodeURIComponent(match)}`
    )
    if (!result)
      return await message.send('_Not supported_', {
        quoted: message.data,
      })
    const buffer = await getBuffer(result)
    fs.writeFileSync('emix.png', buffer.buffer)
    await message.send(
      await sticker('emix', 'emix.png'),
      {
        quoted: message.data,
      },
      'sticker'
    )
  }
)
