const SOURCES = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'X / Twitter', tiktok: 'TikTok', youtube: 'YouTube', spotify: 'Spotify', pinterest: 'Pinterest', reddit: 'Reddit', mediafire: 'MediaFire', apk: 'APKMirror', web: 'Web' }

function downloadCaption(source = 'web', media = 'Media') {
  const name = SOURCES[source] || 'Web'
  return `┌── ⚡ KENTECH AI ──┐\n🤖 SMART MEDIA ENGINE\n└────────────────┘\n\n✅ Download Successful! 🎉\n\n📘 Source: ${name}\n🎞️ Media: ${media}\n📥 Status: Ready to Use\n\n━━━━━━━━━━━━━━\n🚀 Smart • Fast • Reliable\n💎 Powered by KENTECH AI\n\n💬 Support: wa.me/237670217260`
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
  const result = await message.sendFromUrl(url, options)
  // Preserve the library's file-type detection and existing filename/MIME handling.
  let media = 'Media'
  const value = typeof url === 'string' ? url.split('?')[0] : ''
  if (/\.(mp4|webm|mov)$/i.test(value)) media = 'Video'
  else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(value)) media = 'Image'
  else if (/\.(mp3|m4a|ogg|wav)$/i.test(value)) media = 'Audio'
  if (result) await message.send(downloadCaption(source, media), { quoted: message.data }).catch(() => {})
  return result
}

function uploadSource(match) {
  const tagged = String(match || '').match(/^ktech:([a-z]+)\s+(.+)$/s)
  return tagged && SOURCES[tagged[1]] ? { source: tagged[1], url: tagged[2] } : { source: 'web', url: match }
}
module.exports = { downloadCaption, sendDownload, sendDownloadedUrl, uploadSource }
