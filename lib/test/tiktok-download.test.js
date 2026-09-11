const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')

// Exercise the downloader without installing the bot or making network calls.
const sandbox = { module: { exports: {} }, require: () => ({}), Buffer, URL, URLSearchParams }
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../tiktok-download.js'), 'utf8'), sandbox)
const { createDownloader, tiktokUrl } = sandbox.module.exports
const url = 'https://vt.tiktok.com/ZSqFGMM6Y/'
const mp4 = Buffer.from('0000ftypisom0000')
const valid = { status: 200, data: mp4, headers: { 'content-type': 'video/mp4' } }

test('accepts pasted share text and rejects lookalike hosts', () => {
  assert.equal(tiktokUrl(`Watch (${url}).`), url)
  assert.equal(tiktokUrl('https://tiktok.com.evil.example/video/1'), null)
  assert.equal(tiktokUrl('https://eviltiktok.com/video/1'), null)
})

test('falls back from empty primary media to a working alternative', async () => {
  const calls = []
  const download = createDownloader({
    post: async () => ({ data: { code: 0, data: { hdplay: '/hd.mp4', play: '/sd.mp4' } } }),
    get: async (url) => {
      calls.push(url)
      return url.endsWith('/sd.mp4') ? { status: 204, data: Buffer.alloc(0) } : valid
    },
  })
  assert.deepEqual(await download(url), mp4)
  assert.equal(calls.length, 2)
})

test('retries failed metadata lookup without HD', async () => {
  const qualities = []
  const download = createDownloader({
    post: async (_, form) => {
      qualities.push(form.get('hd'))
      if (qualities.length === 1) throw new Error('timeout')
      return { data: { code: 0, data: { play: '/sd.mp4' } } }
    },
    get: async () => valid,
  })
  assert.deepEqual(await download(url), mp4)
  assert.deepEqual(qualities, ['1', '0'])
})

test('rejects HTML and audio masquerading as downloadable video', async () => {
  for (const type of ['text/html', 'audio/mp4']) {
    const download = createDownloader({
      post: async () => ({ data: { code: 0, data: { play: '/bad' } } }),
      get: async () => ({ ...valid, headers: { 'content-type': type } }),
    })
    await assert.rejects(download(url), /could not provide/)
  }
})

test('photo posts are not sent as videos', async () => {
  const download = createDownloader({
    post: async () => ({ data: { code: 0, data: { images: ['photo.jpg'], play: '/audio' } } }),
    get: async () => assert.fail('photo post must not download video'),
  })
  await assert.rejects(download(url), /contains photos/)
})
