const axios = require('axios')
const MAX_BYTES = 60 * 1024 * 1024
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'])

function youtubeId(text) {
  text = String(text || '').trim()
  if (/^[\w-]{11}$/.test(text)) return text
  for (const match of text.matchAll(/https?:\/\/[^\s<>]+/gi)) {
    try {
      const url = new URL(match[0].replace(/[)\]}>.,!?]+$/, ''))
      if (!HOSTS.has(url.hostname) || url.username || url.password || url.port) continue
      const parts = url.pathname.split('/').filter(Boolean)
      const id = url.hostname.endsWith('youtu.be') ? parts[0]
        : parts[0] === 'watch' ? url.searchParams.get('v')
          : ['shorts', 'embed', 'live', 'v'].includes(parts[0]) ? parts[1] : null
      if (/^[\w-]{11}$/.test(id || '')) return id
    } catch (_) {}
  }
  return null
}

function bounded(task, milliseconds) {
  let timer
  return Promise.race([
    Promise.resolve().then(task),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('YouTube download timed out. Please try again.')), milliseconds) }),
  ]).finally(() => clearTimeout(timer))
}

function createDownloader(provider, http = axios) {
  return async function downloadYouTube(text, options = {}) {
    const id = youtubeId(text)
    if (!id) throw new Error('Please send a valid YouTube video or Shorts link.')
    const info = await bounded(() => provider.get(id), 45000)
    if (!info || typeof info.video !== 'object') throw new Error('YouTube provider is temporarily unavailable for this video. Please try again later.')
    // The 360p stream points directly at Google and is blocked on this VPS.
    // Older providers mark separate streams with hasAudio=false. The current
    // provider advertises server-merged MP4s without that flag, sometimes using
    // numeric quality keys. Preserve the old direct-stream exclusion.
    const qualities = [options.videoQuality, '480p', '720p', '360p', '240p', '144p'].filter(Boolean)
    const keys = Object.keys(info?.video || {})
    const quality = [...new Set(qualities)].flatMap(q => keys.filter(key => String(key).replace(/p$/, '') === String(q).replace(/p$/, ''))).find(q => {
      const format = info.video[q]
      const size = Number(format.size || 0)
      const merged = format.hasAudio === false || (format.hasAudio === undefined && format.format === 'mp4')
      return merged && Number.isFinite(size) && size >= 0 && size <= MAX_BYTES
    })
    if (!quality) throw new Error('No downloadable YouTube video is available within the 60 MB limit.')
    const media = await bounded(() => provider.dl(id, 'video', quality), 75000)
    let buffer
    if (Buffer.isBuffer(media)) buffer = media
    else {
      let url
      try { url = new URL(media) } catch (_) { throw new Error('YouTube returned an invalid download link.') }
      if (url.protocol !== 'https:') throw new Error('YouTube returned an invalid download link.')
      const response = await http.get(url.href, {
        responseType: 'arraybuffer', timeout: 45000,
        maxContentLength: MAX_BYTES, maxRedirects: 5,
      })
      const type = String(response.headers?.['content-type'] || '')
      if (response.status !== 200 || /text\/|json|audio\//i.test(type)) throw new Error('YouTube returned an unavailable video file.')
      buffer = Buffer.from(response.data)
    }
    if (buffer.length > MAX_BYTES) throw new Error('That YouTube video exceeds the 60 MB download limit.')
    if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') throw new Error('YouTube returned an empty or invalid MP4 file.')
    return buffer
  }
}

async function downloadYouTube(text, options) {
  const buffer = await createDownloader(require('./index').y2mate)(text, options)
  return require('./whatsapp-video').prepareVideo(buffer)
}

module.exports = { youtubeId, createDownloader, downloadYouTube }
