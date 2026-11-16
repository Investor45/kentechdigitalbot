const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Readable } = require('node:stream')
const fs = require('node:fs/promises')
const path = require('node:path')
const vm = require('node:vm')
const media = require('../media-tools')
const { settingsPages } = require('../settings-display')
const { activeJobs } = require('../media-cleanup')
const quoted = body => ({ message: { key: {}, message: { extendedTextMessage: { text: '!vv', contextInfo: { quotedMessage: body } } } } })

for (const type of ['image', 'video', 'audio']) {
  test(`extracts wrapped view-once ${type} without relying on legacy reply flags`, () => {
    for (const wrapper of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'ephemeralMessage']) {
      const body = { [wrapper]: { message: { [type + 'Message']: { mediaKey: 'private', mimetype: type + '/test' } } } }
      const result = media.quotedMedia(quoted(body))
      assert.equal(result.type, type); assert.equal(result.media.mediaKey, 'private')
    }
  })
}
test('downloads quoted media with the correct type and rejects expired/empty content', async () => {
  const message = quoted({ viewOnceMessageV2: { message: { videoMessage: { mimetype: 'video/mp4' } } } })
  const result = await media.downloadReply(message, async (value, type) => {
    assert.equal(type, 'video'); return Readable.from([Buffer.from('abc')])
  })
  assert.equal(result.buffer.toString(), 'abc'); assert.equal(result.mime, 'video/mp4')
  await assert.rejects(media.downloadReply(message, async () => Readable.from([])), /empty/)
  await assert.rejects(media.downloadReply({}), /Reply to/)
})
test('view-once handler sends a regular image and handles missing media without crashing', async () => {
  const sent = []
  const message = { reply_message: { image: true, downloadMediaMessage: async () => Buffer.from('image') }, send: async (...args) => sent.push(args) }
  await media.viewOnceCommand(message)
  assert.equal(sent[0][2], 'image'); assert.equal(sent[0][1].viewOnce, false)
  await media.viewOnceCommand({ send: message.send })
  assert.match(sent[1][0], /cannot be recovered/)
})
test('invalid conversion input produces usage and never invokes ffmpeg', async () => {
  const sent = []
  await media.conversionCommand({ send: async text => sent.push(text) }, 'shell command')
  assert.match(sent[0], /convert mp3/)
  await assert.rejects(media.convertBuffer(Buffer.from('x'), '../file'), /Use convert/)
  await assert.rejects(media.convertBuffer(Buffer.alloc(0), 'mp4'), /unavailable/)
})
test('allvar redacts secrets and nested objects, handles empty settings and chunks long replies', () => {
  const text = settingsPages({ PREFIX: '!', BOT_NAME: 'TEST', SESSION_ID: 'private-session', GEMINI_API_KEY: 'secret-key', DATABASE_URL: 'postgres://secret', CUSTOM: { secret: 'nested' } }).join('\n')
  assert.match(text, /PREFIX = !/); assert.match(text, /BOT_NAME = TEST/)
  assert.ok(!text.includes('private-session') && !text.includes('secret-key') && !text.includes('postgres://secret') && !text.includes('nested'))
  assert.match(settingsPages(null)[0], /No saved/)
  const pages = settingsPages(Object.fromEntries(Array.from({ length: 400 }, (_, i) => ['SETTING_' + i, 'private'])))
  assert.ok(pages.length > 1 && pages.every(page => page.length <= 3000))
})
test('allvar is owner-only and rejects group output; vv and convert register in hosted plugin directory', async () => {
  const entries = [], sent = []
  const source = await fs.readFile(path.join(__dirname, '../../plugins/hosting-settings.js'), 'utf8')
  vm.runInNewContext(source, { require(name) {
    return name === '../lib/' ? { bot: (options, handler) => entries.push({ options, handler }), getVars: async () => ({ PREFIX: '.', API_KEY: 'private' }) } : { settingsPages }
  } })
  assert.equal(entries[0].options.fromMe, true)
  await entries[0].handler({ isGroup: true, send: async text => sent.push(text) })
  assert.match(sent[0], /private chat/)
  await entries[0].handler({ id: 'bot', send: async text => sent.push(text) })
  assert.match(sent[1], /API_KEY = \[hidden\]/)
  vm.runInNewContext(await fs.readFile(path.join(__dirname, '../../plugins/media-tools.js'), 'utf8'), { require(name) {
    return name === '../lib/' ? { bot: (options, handler) => entries.push({ options, handler }) } : media
  } })
  assert.equal(entries.find(entry => entry.options.pattern.startsWith('vv ')).options.fromMe, true)
  assert.ok(entries.find(entry => entry.options.pattern.startsWith('convert ')))
})

// VPS validation supplies generated fixtures and requires these real codec tests.
for (const format of ['mp3', 'mp4', 'jpg', 'png', 'sticker']) {
  test(`real ffmpeg conversion to ${format} and temporary-file cleanup`, { skip: !process.env.FFMPEG_TEST_FIXTURES }, async () => {
    const input = await fs.readFile(path.join(process.env.FFMPEG_TEST_FIXTURES, 'sample.mp4'))
    const previous = activeJobs.size
    const output = await media.convertBuffer(input, format)
    assert.ok(output.buffer.length > 0); assert.equal(output.mime, media.FORMATS[format].mime)
    assert.equal(activeJobs.size, previous)
    if (format === 'mp4') assert.equal(output.buffer.subarray(4, 8).toString(), 'ftyp')
    if (format === 'png') assert.equal(output.buffer.subarray(1, 4).toString(), 'PNG')
    if (format === 'jpg') assert.equal(output.buffer[0], 255)
    if (format === 'sticker') assert.equal(output.buffer.subarray(8, 12).toString(), 'WEBP')
  })
}

test('real compress handler sends compatible video and failed codecs release scratch jobs', { skip: !process.env.FFMPEG_TEST_FIXTURES }, async () => {
  const entries = [], sent = []
  const lang = { plugins: new Proxy({}, { get: () => ({}) }) }
  vm.runInNewContext(await fs.readFile(path.join(__dirname, '../../plugins/media.js'), 'utf8'), { require(name) {
    if (name === '../lib/') return { bot: (options, handler) => entries.push({ options, handler }), lang }
    if (name === '../lib/media-tools') return media
    return require(name)
  } })
  const input = await fs.readFile(path.join(process.env.FFMPEG_TEST_FIXTURES, 'sample.mp4'))
  const command = entries.find(entry => entry.options.pattern.startsWith('compress'))
  assert.ok(command)
  await command.handler({ id: 'fixture', reply_message: { video: true, downloadMediaMessage: async () => input }, send: async (...args) => sent.push(args) }, '')
  assert.equal(sent.length, 1); assert.equal(sent[0][2], 'video'); assert.equal(sent[0][1].mimetype, 'video/mp4')
  assert.equal(sent[0][0].subarray(4, 8).toString(), 'ftyp')
  const jobs = activeJobs.size
  await assert.rejects(media.convertBuffer(Buffer.from('invalid media'), 'mp3'))
  assert.equal(activeJobs.size, jobs)
})
