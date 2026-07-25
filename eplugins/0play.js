const { bot, yts, song } = require('../lib/')

bot(
  {
    pattern: 'play ?(.*)',
    fromMe: true,
    desc: 'Download youtube audio',
    type: 'download',
  },
  async (message, match) => {
    match = match || message.reply_message.text
    if (!match) return await message.send('_Example : play ghost_')
    const result = await yts(match, 0, 1, message.id)
    if (!result.length) return await message.send(`*${match} not found*`)
    const { title, id } = result[0]
    await message.send(`_Downloading ${title}_`)
    const buffer = await song(id, message.id)
    if (!buffer) return await message.send('failed!')
    await message.send(buffer, { mimetype: 'audio/mpeg' }, 'audio')
  }
)
