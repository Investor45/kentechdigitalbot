const fs = require('fs')
const { bot, isUrl, getTelegramStickers, sticker, getBuffer, sleep } = require('../lib/')
bot(
  {
    pattern: 'tg ?(.*)',
    desc: 'download telegram sticker',
    type: 'sticker',
  },
  async (message, match) => {
    const url = isUrl(match || message.reply_message.text)
    if (!url) return await message.send('*Example :* tg https://t.me/addstickers/sticker')

    const results = await getTelegramStickers(match)
    const stickersCount = results.stickers.length
    if (stickersCount === 0) await message.send('stickers not supported')
    await message.send(`Downloading ${stickersCount} from ${results.title}`)
    for (const s of results.stickers) {
      try {
        if (s.name.endsWith('webp')) {
          await message.sendFromUrl(s.url)
        } else {
          const b = await getBuffer(s.url)
          fs.writeFileSync(b.name, b.buffer)
          await message.send(
            await sticker('str', b.name, 2, message.id),
            { isAnimated: b.type === 'video' },
            'sticker'
          )
        }
      } catch (e) {
        await message.send('tg: An error occured!')
      }
      await sleep(1000)
    }
  }
)
