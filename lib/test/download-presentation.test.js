const { test } = require('node:test')
const assert = require('node:assert/strict')
const { sendDownload, sendDownloadedUrl, uploadSource, downloadCaption } = require('../download-presentation')
test('video caption preserves transport metadata and shows the correct platform', async () => {
  let args
  const buffer = Buffer.from('video')
  await sendDownload({ send: async (...a) => { args = a; return { key: { id: 'sent' } } } }, 'facebook', buffer, { mimetype: 'video/mp4', fileName: 'original.mp4' }, 'video')
  assert.equal(args[0], buffer)
  assert.equal(args[1].fileName, 'original.mp4')
  assert.match(args[1].caption, /Source: Facebook/)
  assert.match(args[1].caption, /Media: Video/)
  assert.match(args[1].caption, /wa.me\/237670217260/)
})
test('audio confirms after successful delivery and never confirms a failed send', async () => {
  const calls = []
  const message = { send: async (...args) => { calls.push(args); return { key: { id: 'ok' } } } }
  await sendDownload(message, 'youtube', Buffer.from('audio'), { fileName: 'song.mp3' }, 'audio')
  assert.equal(calls[0][2], 'audio')
  assert.match(calls[1][0], /Media: Audio/)
  calls.length = 0
  message.send = async () => { calls.push('failed'); throw new Error('offline') }
  await assert.rejects(sendDownload(message, 'youtube', Buffer.from('audio'), {}, 'audio'))
  assert.deepEqual(calls, ['failed'])
})
test('URL downloads preserve file handling; quality selections retain their platform', async () => {
  const calls = []
  const message = { sendFromUrl: async (...args) => { calls.push(args); return { key: { id: 'ok' } } }, send: async text => calls.push(text) }
  await sendDownloadedUrl(message, 'instagram', 'https://cdn.example/photo.jpg', { buffer: false })
  assert.deepEqual(calls[0], ['https://cdn.example/photo.jpg', { buffer: false }])
  assert.match(calls[1], /Source: Instagram/)
  assert.match(calls[1], /Media: Image/)
  assert.deepEqual(uploadSource('ktech:facebook https://cdn.example/video.mp4'), { source: 'facebook', url: 'https://cdn.example/video.mp4' })
  assert.equal(uploadSource('https://example.org/file').source, 'web')
  assert.ok(downloadCaption('youtube').length < 1024)
})
