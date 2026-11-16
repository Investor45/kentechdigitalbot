const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')
const run = promisify(require('node:child_process').execFile)
const { activeJobs } = require('./media-cleanup')
const MAX = 20 * 1024 * 1024
const FORMATS = {
  mp3: { type: 'audio', mime: 'audio/mpeg', args: ['-vn', '-c:a', 'libmp3lame', '-b:a', '128k'] },
  mp4: { type: 'video', mime: 'video/mp4', args: ['-vf', "scale='min(720,iw)':-2", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart'] },
  jpg: { type: 'image', mime: 'image/jpeg', args: ['-frames:v', '1'] },
  png: { type: 'image', mime: 'image/png', args: ['-frames:v', '1'] },
  sticker: { ext: 'webp', type: 'sticker', mime: 'image/webp', args: ['-t', '8', '-vf', "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=12", '-c:v', 'libwebp', '-loop', '0', '-an'] },
}
function unwrap(body) {
  for (let i = 0; i < 8; i++) {
    const next = body?.ephemeralMessage?.message || body?.viewOnceMessage?.message || body?.viewOnceMessageV2?.message || body?.viewOnceMessageV2Extension?.message || body?.documentWithCaptionMessage?.message || body?.message
    if (!next) break
    body = next
  }
  return body || {}
}
function quotedMedia(message) {
  const original = unwrap(message.message || message.data)
  const context = Object.values(original).find(value => value?.contextInfo?.quotedMessage)?.contextInfo
  const reply = message.reply_message
  const candidates = [context?.quotedMessage, reply?.message, reply?.data, reply?.msg, reply]
  for (const candidate of candidates) {
    const body = unwrap(candidate)
    for (const type of ['image', 'video', 'audio', 'sticker', 'document']) {
      if (body[type + 'Message']) return { type, media: body[type + 'Message'] }
    }
  }
  return null
}
async function downloadReply(message, downloader) {
  const raw = quotedMedia(message)
  if (raw) {
    const download = downloader || (await import('baileys')).downloadContentFromMessage
    const stream = await download(raw.media, raw.type)
    const chunks = []; let size = 0
    const timer = setTimeout(() => stream.destroy?.(new Error('Media download timed out')), 45000)
    try {
      for await (const chunk of stream) {
        size += chunk.length
        if (size > MAX) { stream.destroy?.(); throw Error('Media exceeds the 20 MB processing limit') }
        chunks.push(chunk)
      }
    } finally { clearTimeout(timer) }
    if (!size) throw Error('Media is empty or no longer available')
    return { buffer: Buffer.concat(chunks), type: raw.type, mime: raw.media.mimetype, caption: raw.media.caption }
  }
  const reply = message.reply_message
  if (!reply || !['image', 'video', 'audio', 'sticker', 'document'].some(key => reply[key])) throw Error('Reply to an image, video, audio or sticker first')
  const buffer = await reply.downloadMediaMessage()
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX) throw Error('Media is unavailable or exceeds 20 MB')
  return { buffer, type: ['image', 'video', 'audio', 'sticker', 'document'].find(key => reply[key]) }
}
async function convertBuffer(buffer, format) {
  const spec = FORMATS[format]
  if (!spec) throw Error('Use convert mp3, mp4, jpg, png or sticker')
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX) throw Error('Media is unavailable or exceeds 20 MB')
  const folder = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'kentech-convert-')))
  activeJobs.add(folder)
  try {
    const input = path.join(folder, 'input.bin'), output = path.join(folder, 'output.' + (spec.ext || format))
    await fs.writeFile(input, buffer)
    await run('ffmpeg', ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-threads', '1', '-i', input, ...spec.args, '-threads', '1', output], { timeout: 120000, killSignal: 'SIGKILL', maxBuffer: 65536 })
    const size = (await fs.stat(output)).size
    if (!size || size > MAX) throw Error('Converted media is empty or exceeds 20 MB')
    return { buffer: await fs.readFile(output), ...spec, filename: 'converted.' + (spec.ext || format) }
  } finally {
    try { await fs.rm(folder, { recursive: true, force: true }) }
    finally { activeJobs.delete(folder) }
  }
}
const busy = new Set()
async function conversionCommand(message, format, compress = false) {
  const key = String(message.id || message.jid || 'bot')
  if (busy.has(key)) return message.send('A conversion is already running. Please wait for it to finish.')
  if (!FORMATS[format]) return message.send('Reply to media with convert mp3, mp4, jpg, png or sticker.')
  busy.add(key)
  try {
    const media = await downloadReply(message)
    if (compress && media.type !== 'video') return await message.send('Reply to a video with compress.')
    const output = await convertBuffer(media.buffer, format)
    const smaller = output.buffer.length < media.buffer.length
    const content = compress && !smaller && media.mime === 'video/mp4' ? media.buffer : output.buffer
    return await message.send(content, { mimetype: output.mime, filename: output.filename, fileName: output.filename, quoted: message.data, ...(compress ? { caption: content === media.buffer ? 'This video is already compact; the original is smaller.' : smaller ? 'Video compressed successfully.' : 'Converted to compatible MP4; this video could not be made smaller.' } : {}) }, output.type)
  } catch (_) { return await message.send('Conversion failed. Reply to supported media under 20 MB and try again. Expired/viewed view-once media must be sent again.') }
  finally { busy.delete(key) }
}
async function viewOnceCommand(message) {
  try {
    const media = await downloadReply(message)
    if (!['image', 'video', 'audio'].includes(media.type)) return await message.send('Reply to a view-once image, video or voice message with vv.')
    return await message.send(media.buffer, { mimetype: media.mime, ...(media.caption ? { caption: media.caption } : {}), viewOnce: false }, media.type)
  } catch (_) { return await message.send('That media is unavailable. Reply to the original view-once image/video under 20 MB before it expires. Already-consumed media cannot be recovered.') }
}
module.exports = { FORMATS, unwrap, quotedMedia, downloadReply, convertBuffer, conversionCommand, viewOnceCommand }
