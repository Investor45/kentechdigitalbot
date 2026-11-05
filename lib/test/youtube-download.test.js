const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const sandbox = { module: { exports: {} }, require: () => ({}), Buffer, URL, setTimeout, clearTimeout }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../youtube-download.js'), 'utf8'), sandbox)
const { youtubeId, createDownloader } = sandbox.module.exports
const id = '5yMPFXf7trs'
const mp4 = Buffer.from('0000ftypisom0000')
const formats = { '360p': { hasAudio: true, size: 4000 }, '480p': { hasAudio: false, size: 6000 }, '720p': { hasAudio: false, size: 20000 } }

test('parses the reported Short and standard YouTube links', () => {
  for (const link of [`https://youtube.com/shorts/${id}?si=1SL_6UEgQRRP8tw7`, `https://youtu.be/${id}`, `https://www.youtube.com/watch?v=${id}&list=test`, `Watch (https://youtube.com/shorts/${id}).`]) {
    assert.equal(youtubeId(link), id)
  }
  assert.equal(youtubeId('https://youtube.com.evil.example/shorts/' + id), null)
})

test('uses merged media instead of the blocked direct 360p stream', async () => {
  let chosen
  const download = createDownloader({ get: async () => ({ video: formats }), dl: async (_, type, quality) => { chosen = quality; return 'https://cdn.example/video.mp4' } }, {
    get: async () => ({ status: 200, data: mp4, headers: { 'content-type': 'video/mp4' } }),
  })
  assert.deepEqual(await download(id), mp4)
  assert.equal(chosen, '480p')
})

test('honors an available merged quality and skips oversize formats', async () => {
  const chosen = []
  const download = createDownloader({
    get: async () => ({ video: { ...formats, '1080p': { hasAudio: false, size: 100 * 1024 * 1024 } } }),
    dl: async (_, type, quality) => { chosen.push(quality); return mp4 },
  })
  await download(id, { videoQuality: '720p' })
  await download(id, { videoQuality: '1080p' })
  assert.deepEqual(chosen, ['720p', '480p'])
})

test('rejects empty and HTML download responses', async () => {
  for (const response of [{ status: 204, data: Buffer.alloc(0) }, { status: 200, data: Buffer.from('<html>error</html>'), headers: { 'content-type': 'text/html' } }]) {
    const download = createDownloader({ get: async () => ({ video: formats }), dl: async () => 'https://cdn.example/video.mp4' }, { get: async () => response })
    await assert.rejects(download(id), /unavailable video file|empty or invalid/)
  }
})

test('does not attempt a known-blocked direct stream when merged media is missing', async () => {
  const download = createDownloader({ get: async () => ({ video: { '360p': formats['360p'] } }), dl: async () => assert.fail('must not download direct stream') })
  await assert.rejects(download(id), /No downloadable/)
})

test('accepts current server-merged MP4 metadata with numeric quality keys', async () => {
  const chosen = []
  const download = createDownloader({
    get: async () => ({ video: { '480': { quality: '480', size: 6000, format: 'mp4' }, '720p': { size: 9000, format: 'mp4' } } }),
    dl: async (_, type, quality) => { chosen.push(quality); return mp4 },
  })
  assert.deepEqual(await download(id), mp4)
  await download(id, { videoQuality: '720' })
  assert.deepEqual(chosen, ['480', '720p'])
})

test('rejects unsafe metadata and oversize provider buffers', async () => {
  for (const format of [{ size: -1, format: 'mp4' }, { size: 'unknown', format: 'mp4' }, { size: 100000000, format: 'mp4' }, { size: 10 }]) {
    const download = createDownloader({ get: async () => ({ video: { '480': format } }), dl: async () => assert.fail('must not download unsafe format') })
    await assert.rejects(download(id), /No downloadable/)
  }
  const download = createDownloader({ get: async () => ({ video: formats }), dl: async () => Buffer.alloc(60 * 1024 * 1024 + 1) })
  await assert.rejects(download(id), /exceeds/)
})

test('reports upstream failure separately from a video size limit', async () => {
  const download = createDownloader({ get: async () => false, dl: async () => assert.fail('must not download without metadata') })
  await assert.rejects(download(id), /provider is temporarily unavailable/)
})
