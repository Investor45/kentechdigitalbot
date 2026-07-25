const { bot, upscale } = require('../lib')

bot(
  {
    pattern: 'upscale ?(.*)',
    fromMe: true,
    desc: 'improve image quality',
    type: 'ai',
  },
  async (message, match) => {
    if (!message.reply_message && !message.reply_message.image) {
      return await message.send('reply to a image.')
    }

    const res = await upscale(await message.reply_message.downloadAndSaveMediaMessage('upscale'))
    await message.send(res, { quoted: message.data, mimetype: 'image/png' }, 'image')
  }
)
