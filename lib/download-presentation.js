const SOURCES = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'X / Twitter', tiktok: 'TikTok', youtube: 'YouTube', spotify: 'Spotify', pinterest: 'Pinterest', reddit: 'Reddit', mediafire: 'MediaFire', apk: 'APKMirror', web: 'Web' }

function downloadCaption(source = 'web', media = 'Media') {
  const name = SOURCES[source] || 'Web'
  return `╭━━ ⚡ *KENTECH AI* ━━╮\n🤖 *SMART MEDIA ENGINE*\n╰━━━━━━━━━━━━━━╯\n\n✅ *Download Successful!* 🎉\n\n📘 *Source:* ${name}\n🎬 *Media:* ${media}\n📥 *Status:* Ready to Use\n\n━━━━━━━━━━━━━━\n🚀 _Smart • Fast • Reliable_\n💎 *Powered by KENTECH AI*\n\n💬 *Support:* https://wa.me/237670217260`
}

async function sendDownload(message, source, content, options = {}, type = 'document') {
  const media = { video: 'Video', image: 'Image', audio: 'Audio', document: 'File' }[type] || 'Media'
  // Audio does not reliably show captions in WhatsApp; confirm only after its send succeeds.
  if (type === 'audio') {
    const result = await message.send(content, options, type)
    if (result) await message.send(downloadCaption(source, media), { quoted: message.data }).catch(() => {})
    return result
  }
  return message.send(content, { ...options, caption: downloadCaption(source, media) + (options.caption ? '\n\n' + options.caption : '') }, type)
}

async function sendDownloadedUrl(message, source, url, options = {}) {
  let media = 'Media'
  const value = typeof url === 'string' ? url.split('?')[0] : ''
  if (/\.(mp4|webm|mov)$/i.test(value)) media = 'Video'
  else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(value)) media = 'Image'
  else if (/\.(mp3|m4a|ogg|wav)$/i.test(value)) media = 'Audio'
  else if (source === 'facebook') media = 'Video'
  // sendFromUrl already supports captions and retains file/MIME detection.
  // Audio keeps its separate acknowledgement because WhatsApp audio lacks captions.
  if (media === 'Audio') {
    const result = await message.sendFromUrl(url, options)
    if (result) await message.send(downloadCaption(source, media), { quoted: message.data }).catch(() => {})
    return result
  }
  return message.sendFromUrl(url, { ...options,
    caption: downloadCaption(source, media) + (options.caption ? '\n\n' + options.caption : '') })
}

function uploadSource(match) {
  const tagged = String(match || '').match(/^ktech:([a-z]+)\s+(.+)$/s)
  return tagged && SOURCES[tagged[1]] ? { source: tagged[1], url: tagged[2] } : { source: 'web', url: match }
}
function decorateLegacyPlay(source) {
  if (source.includes("require('../lib/download-presentation')")) return source
  if (!source.includes("pattern: 'play ?(.*)'") || !source.includes('message.send(buffer,')) return source
  return "const { sendDownload } = require('../lib/download-presentation')\n" + source.replace('message.send(buffer,', "sendDownload(message, 'youtube', buffer,")
}

function installLegacyPlay() {
  const Module = require('node:module')
  const fs = require('node:fs')
  const path = require('node:path')
  const filename = path.resolve(__dirname, '../eplugins/0play.js')
  const previous = Module._extensions['.js']
  if (previous.kentechDownloadPresentation) return
  const load = function (module, file) {
    if (path.resolve(file) !== filename) return previous(module, file)
    return module._compile(decorateLegacyPlay(fs.readFileSync(file, 'utf8')), file)
  }
  load.kentechDownloadPresentation = true
  Module._extensions['.js'] = load
}
module.exports = { downloadCaption, sendDownload, sendDownloadedUrl, uploadSource, decorateLegacyPlay, installLegacyPlay }
