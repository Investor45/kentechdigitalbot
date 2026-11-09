const { sendDownloadedUrl, uploadSource } = require('../lib/download-presentation')
const { bot, isUrl, getImgUrl, lang } = require('../lib/')
bot(
  {
    pattern: 'upload ?(.*)',
    desc: lang.plugins.upload.desc,
    type: 'download',
  },
  async (message, match) => {
    const selected = uploadSource(match || message.reply_message?.text)
    match = isUrl(selected.url)
    if (!match) return await message.send(lang.plugins.upload.usage)
    if (match.startsWith('https://images.app.goo.gl')) match = await getImgUrl(match)
    await sendDownloadedUrl(message, selected.source, match, { buffer: false })
  }
)
