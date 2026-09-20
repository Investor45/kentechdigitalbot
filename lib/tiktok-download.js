const axios = require('axios')

const MAX_BYTES = 60 * 1024 * 1024
const APIS = ['https://www.tikwm.com/api/', 'https://tikwm.com/api/']

function tiktokUrl(text) {
  for (const match of String(text || '').matchAll(/https?:\/\/[^\s<>]+/gi)) {
    try {
      const url = new URL(match[0].replace(/[)\]}>.,!?]+$/, ''))
      if (url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com')) {
        if (url.username || url.password || url.port) continue
        url.protocol = 'https:'
        return url.href
      }
    } catch (_) {}
  }
  return null
}

function createDownloader(http = axios) {
  return async function downloadTikTok(text) {
    const url = tiktokUrl(text)
    if (!url) throw new Error('Please send a TikTok video link.')
    for (const api of APIS) for (const hd of ['1', '0']) {
      try {
        const response = await http.post(api, new URLSearchParams({ url, hd }), {
          timeout: 15000,
          maxContentLength: 2 * 1024 * 1024,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (compatible; KENTECH-AI/6.0)',
            Accept: 'application/json',
          },
        })
        const body = response.data
        if (body?.code !== 0 || !body.data) continue
        const data = body.data
        if (Array.isArray(data.images) && data.images.length) {
          throw new Error('This TikTok post contains photos, not a video.')
        }
        // Standard MP4 is more widely compatible with WhatsApp than HD HEVC.
        for (const candidate of [...new Set([
          data.play, data.wmplay, data.hdplay, data.playwm, data.hdplaywm,
        ].filter(Boolean))]) {
          try {
            const mediaUrl = new URL(candidate, api)
            if (mediaUrl.protocol !== 'https:') continue
            const media = await http.get(mediaUrl.href, {
              responseType: 'arraybuffer', timeout: 20000,
              maxContentLength: MAX_BYTES, maxRedirects: 5,
            })
            const buffer = Buffer.from(media.data)
            // Reject empty responses, error pages, and audio download links.
            const type = String(media.headers?.['content-type'] || '').toLowerCase()
            if (media.status !== 200 || buffer.length < 12 || buffer.length > MAX_BYTES) continue
            if (/text\/|json|audio\//.test(type)) continue
            // Some TikTok CDNs omit content-type and return fragmented MP4.
            const signature = buffer.toString('ascii', 4, 8)
            if (signature !== 'ftyp' && !/video\//.test(type)) continue
            return buffer
          } catch (_) {
            // Try the next quality when a CDN URL expires or returns no media.
          }
        }
      } catch (error) {
        if (error.message === 'This TikTok post contains photos, not a video.') throw error
      }
    }
    throw new Error('TikTok could not provide a downloadable video. Try again shortly; the post may be unavailable or exceed the 60 MB limit.')
  }
}

module.exports = { tiktokUrl, createDownloader, downloadTikTok: createDownloader() }
