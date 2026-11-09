const { test } = require('node:test')
const assert = require('node:assert/strict')
const { sendDownload, sendDownloadedUrl, uploadSource, downloadCaption } = require('../download-presentation')
test('video caption preserves transport metadata and shows the correct platform', async () => {
  const calls = []
  const buffer = Buffer.from('video')
  await sendDownload({ send: async (...a) => { calls.push(a); return { key: { id: 'sent' } } } }, 'facebook', buffer, { mimetype: 'video/mp4', fileName: 'original.mp4' }, 'video')
  const args = calls[0]
  assert.equal(calls[1][2], 'image')
  assert.equal(args[0], buffer)
  assert.equal(args[1].fileName, 'original.mp4')
  assert.match(args[1].caption, /Source:\* Facebook/)
  assert.match(args[1].caption, /Media:\* Video/)
  assert.match(args[1].caption, /wa.me\/237670217260/)
})
test('audio confirms after successful delivery and never confirms a failed send', async () => {
  const calls = []
  const message = { send: async (...args) => { calls.push(args); return { key: { id: 'ok' } } } }
  await sendDownload(message, 'youtube', Buffer.from('audio'), { fileName: 'song.mp3' }, 'audio')
  assert.equal(calls[0][2], 'audio')
  assert.equal(calls[1][2], 'image')
  assert.ok(Buffer.isBuffer(calls[1][0]))
  calls.length = 0
  message.send = async () => { calls.push('failed'); throw new Error('offline') }
  await assert.rejects(sendDownload(message, 'youtube', Buffer.from('audio'), {}, 'audio'))
  assert.deepEqual(calls, ['failed'])
})
test('URL downloads preserve file handling; quality selections retain their platform', async () => {
  const calls = []
  const message = { sendFromUrl: async (...args) => { calls.push(args); return { key: { id: 'ok' } } }, send: async text => calls.push(text) }
  await sendDownloadedUrl(message, 'instagram', 'https://cdn.example/photo.jpg', { buffer: false })
  assert.equal(calls[0][0], 'https://cdn.example/photo.jpg')
  assert.equal(calls[0][1].buffer, false)
  assert.equal(calls.length, 2)
  assert.match(calls[0][1].caption, /Source:\* Instagram/)
  assert.match(calls[0][1].caption, /Media:\* Image/)
  assert.deepEqual(uploadSource('ktech:facebook https://cdn.example/video.mp4'), { source: 'facebook', url: 'https://cdn.example/video.mp4' })
  assert.equal(uploadSource('https://example.org/file').source, 'web')
  assert.ok(downloadCaption('youtube').length < 1024)
})

test('legacy play keeps branding when startup restores its original source', () => {
  const { decorateLegacyPlay } = require('../download-presentation')
  const source = "bot({ pattern: 'play ?(.*)' }, async message => { await message.send(buffer, { mimetype: 'audio/mpeg' }, 'audio') })"
  const branded = decorateLegacyPlay(source)
  assert.match(branded, /sendDownload\(message, 'youtube', buffer,/)
  assert.equal(decorateLegacyPlay(branded), branded)
  assert.equal(decorateLegacyPlay('module.exports = 1'), 'module.exports = 1')
})

test('legacy loader decorates only its exact plugin path and preserves other loaders', () => {
  const Module = require('node:module')
  const path = require('node:path')
  const previous = Module._extensions['.js']
  let forwarded = 0
  Module._extensions['.js'] = () => { forwarded++ }
  try {
    const { installLegacyPlay } = require('../download-presentation')
    installLegacyPlay()
    const loader = Module._extensions['.js']
    installLegacyPlay()
    assert.equal(Module._extensions['.js'], loader)
    let code
    loader({ _compile: text => { code = text } }, path.resolve(__dirname, '../../eplugins/0play.js'))
    assert.match(code, /sendDownload\(message, 'youtube'/)
    loader({}, '/another-instance/eplugins/0play.js')
    assert.equal(forwarded, 1)
  } finally { Module._extensions['.js'] = previous }
})

test('Facebook CDN video retains its caption before its graphic card', async () => {
  const calls = []
  const message = { sendFromUrl: async (...args) => { calls.push(args); return { key: { id: 'sent' } } }, send: async (...args) => { calls.push(args); return { key: { id: 'card' } } } }
  await sendDownloadedUrl(message, 'facebook', 'https://cdn.example/download?token=temporary', { quoted: 'original' })
  assert.equal(calls.length, 2)
  assert.equal(calls[1][2], 'image')
  assert.equal(calls[0][1].quoted, 'original')
  assert.match(calls[0][1].caption, /\*KENTECH AI\*/)
  assert.match(calls[0][1].caption, /\*Source:\* Facebook/)
  assert.match(calls[0][1].caption, /\*Media:\* Video/)
  assert.match(calls[0][1].caption, /_Smart • Fast • Reliable_/)
  assert.match(calls[0][1].caption, /https:\/\/wa.me\/237670217260/)
})
