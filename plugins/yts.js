const { bot, yts, song, addAudioMetaData, generateList, lang, YT_URL_REGEX } = require('../lib/')
const { downloadYouTube, youtubeId } = require('../lib/youtube-download')

bot(
  {
    pattern: 'yts ?(.*)',
    desc: lang.plugins.yts.desc,
    type: 'search',
  },
  async (message, match) => {
    if (!match) return await message.send(lang.plugins.yts.usage)
    const vid = YT_URL_REGEX.exec(match)
    if (vid) {
      const result = await yts(vid[1], true, null, message.id)
      const { title, description, duration, view, published } = result[0]
      return await message.send(
        `${lang.plugins.yts.title}${title}\n${lang.plugins.yts.time}${duration}\n${lang.plugins.yts.views}${view}\n${lang.plugins.yts.publish}${published}\n${lang.plugins.yts.desc_label}${description}`
      )
    }
    const result = await yts(match, false, null, message.id)
    const msg = result
      .map(
        ({ title, id, view, duration, published, author }) =>
          `• *${title.trim()}*\n${view ? `${lang.plugins.yts.views}${view}\n` : ''}${lang.plugins.yts.time}${duration}\n${lang.plugins.yts.author}${author}\n${published ? `${lang.plugins.yts.publish}${published}\n` : ''}${lang.plugins.yts.url}${id.startsWith('http') ? id : `https://www.youtube.com/watch?v=${id}`}\n\n`
      )
      .join('')

    return await message.send(msg.trim())
  }
)

bot(
  {
    pattern: 'song ?(.*)',
    desc: lang.plugins.song.desc,
    type: 'download',
  },
  async (message, match) => {
    match = match || message.reply_message?.text
    if (!match) return await message.send(lang.plugins.song.usage)
    const isDirect = YT_URL_REGEX.test(match)
    if (isDirect) {
      const { buffer, title, author, thumbnail } = await song(match, message.id)
      if (!buffer) return await message.send(lang.plugins.song.not_found)

      const meta = await addAudioMetaData(buffer, title, author, '', thumbnail?.url || thumbnail)
      return await message.send(
        meta,
        { quoted: message.data, mimetype: 'audio/mpeg', fileName: `${title}.mp3` },
        'audio'
      )
    }

    const result = await yts(match, false, 1, message.id)
    if (!result.length) return await message.send(lang.plugins.song.no_result.format(match))
    const msg = generateList(
      result.map(({ title, id, duration, author, album }) => ({
        _id: lang.plugins.song.id_label,
        text: `🎵${title}\n🕒${duration}\n👤${author}\n📀${album || 'Unknown'}\n\n`,
        id: `song ${id.startsWith('http') ? id : `https://www.youtube.com/watch?v=${id}`}`,
      })),
      lang.plugins.song.list_header.format(match, result.length),
      message.jid,
      message.participant,
      message.id
    )
    return await message.send(msg.message, { quoted: message.data }, msg.type)
  }
)

bot(
  {
    pattern: 'video ?(.*)',
    desc: lang.plugins.video.desc,
    type: 'download',
  },
  async (message, match) => {
    match = match || message.reply_message?.text
    if (!match) return await message.send(lang.plugins.video.usage)

    let quality = null;
    let urlMatch = match;

    const qualityPattern = /^(1080p|720p|480p|360p|240p|144p)\s+(.+)$/i;
    const qualityMatch = match.match(qualityPattern);

    if (qualityMatch) {
      quality = qualityMatch[1];
      urlMatch = qualityMatch[2];
    }

    const videoId = youtubeId(urlMatch)
    const vid = videoId ? [urlMatch, videoId] : null
    if (!vid) {
      const result = (await yts(urlMatch, false, null, message.id)).filter(r => !r.isMusic)
      if (!result.length) return await message.send(lang.plugins.video.not_found)
      const msg = generateList(
        result.map(({ title, id, duration, view }) => ({
          text: `${title}\nduration : ${duration}\nviews : ${view}\n`,
          id: `video ${quality ? quality + ' ' : ''}https://www.youtube.com/watch?v=${id}`,
        })),
        lang.plugins.video.list_header.format(urlMatch, result.length),
        message.jid,
        message.participant,
        message.id
      )
      return await message.send(msg.message, { quoted: message.data }, msg.type)
    }

    const options = quality ? { videoQuality: quality } : {};
    try {
      return await message.send(
        await downloadYouTube(vid[1], options),
        { quoted: message.data, mimetype: 'video/mp4', fileName: `${vid[1]}.mp4` },
        'video'
      )
    } catch (_) {
      return message.send('YouTube could not provide the video right now. Please try again shortly.', { quoted: message.data })
    }
  }
)
