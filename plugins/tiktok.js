const { sendDownload } = require('../lib/download-presentation')
const { bot, lang } = require('../lib/index')
const { downloadTikTok, tiktokUrl } = require('../lib/tiktok-download')

bot(
  { pattern: 'tiktok ?(.*)', desc: lang.plugins.tiktok.desc, type: 'download' },
  async (message, match) => {
    const url = tiktokUrl(match || message.reply_message?.text)
    if (!url) return message.send(lang.plugins.tiktok.usage)
    try {
      const video = await downloadTikTok(url)
      return await sendDownload(message, 'tiktok', video, { mimetype: 'video/mp4', quoted: message.data }, 'video')
    } catch (error) {
      return message.send(error.message, { quoted: message.data })
    }
  }
)
