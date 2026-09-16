const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

function setup({ groups = ['120363191116053479@g.us'] } = {}) {
  const entries = []
  let downloads = 0
  const lib = {
    bot: (options, handler) => {
      if (options.on) assert.ok(['photo', 'image', 'text', 'sticker', 'message', 'event'].includes(options.on))
      entries.push({ options, handler })
    },
    facebook: async () => {
      downloads += 1
      await new Promise(resolve => setTimeout(resolve, 5))
      return [{ url: 'https://media.example/video.mp4', quality: 'HD' }]
    },
    instagram: async () => null,
  }
  const fakeFs = {
    readFileSync(file, encoding) {
      if (String(file).endsWith('auto-social-download.js')) return fs.readFileSync(file, encoding)
      return JSON.stringify(groups)
    },
    writeFileSync(_, value) { groups = JSON.parse(value) },
    renameSync() {},
  }
  const source = fs.readFileSync(path.join(__dirname, '../../plugins/auto-social-download.js'), 'utf8')
  vm.runInNewContext(source, {
    require(name) {
      if (name === '../lib/') return lib
      if (name.endsWith('tiktok-download')) return { downloadTikTok: async () => null, tiktokUrl: () => null }
      if (name.endsWith('download-group-guard')) return { getGuard: () => ({ shouldBlock: () => false }) }
      if (name.endsWith('youtube-download')) return { downloadYouTube: async () => null, youtubeId: () => null }
      if (name.endsWith('download-groups')) return require('../download-groups')
      if (name === 'fs') return fakeFs
      if (name === 'path') return path
      throw new Error(`Unexpected require: ${name}`)
    },
    __dirname: path.join(__dirname, '../../plugins'),
    process: { env: { PREFIX: ',' }, stderr: { write() {} } },
    Buffer,
    URL,
    setTimeout,
  })
  const sent = []
  const message = {
    jid: '120363191116053479@g.us',
    isGroup: true,
    text: 'https://www.facebook.com/watch/?v=123',
    data: { key: { remoteJid: '120363191116053479@g.us', id: 'facebook-message-1' } },
    send: async text => sent.push({ text }),
    client: { sendMessage: async (jid, content) => sent.push({ jid, content }) },
  }
  return { entries, message, sent, downloads: () => downloads }
}

test('one Facebook message is downloaded once across duplicate dispatches', async () => {
  const { entries, message, sent, downloads } = setup()
  const handlers = entries.filter(entry => ['message', 'text'].includes(entry.options.on)).map(entry => entry.handler)
  await Promise.all(handlers.map(handler => handler({ ...message })))
  await Promise.all(handlers.map(handler => handler({ ...message })))
  assert.equal(downloads(), 1)
  assert.equal(sent.filter(item => item.content?.video).length, 1)
})

test('a new message can download the same Facebook URL again', async () => {
  const { entries, message, sent, downloads } = setup()
  const handler = entries.find(entry => entry.options.on === 'message').handler
  await handler(message)
  await handler({ ...message, data: { key: { ...message.data.key, id: 'facebook-message-2' } } })
  assert.equal(downloads(), 2)
  assert.equal(sent.filter(item => item.content?.video).length, 2)
})

test('a link in a media caption downloads through the supported message event', async () => {
  const { entries, message, sent, downloads } = setup()
  const handler = entries.find(entry => entry.options.on === 'message').handler
  await handler({ ...message, text: '', caption: message.text })
  assert.equal(downloads(), 1)
  assert.equal(sent.filter(item => item.content?.video).length, 1)
})

test('automation stays off until the owner explicitly saves a GID, and off stops it', async () => {
  const { entries, message, sent, downloads } = setup({ groups: [] })
  const control = entries.find(entry => entry.options.pattern?.startsWith('autodownload')).handler
  const download = entries.find(entry => entry.options.on === 'text').handler
  await download(message)
  assert.equal(downloads(), 0)
  await control(message, 'on')
  assert.match(sent.at(-1).text, /,autodownload save GROUP_GID/)
  await download(message)
  assert.equal(downloads(), 0)
  await control({ ...message, isGroup: false }, 'save 120363191116053479')
  await download(message)
  assert.equal(downloads(), 1)
  await control(message, 'list')
  assert.match(sent.at(-1).text, /120363191116053479@g\.us/)
  await control(message, 'off')
  await download({ ...message, data: { key: { ...message.data.key, id: 'after-off' } } })
  assert.equal(downloads(), 1)
})

test('invalid GIDs do not enable automation', async () => {
  const { entries, message, sent, downloads } = setup({ groups: [] })
  await entries.find(entry => entry.options.pattern?.startsWith('autodownload')).handler(message, 'save bad-id')
  assert.match(sent.at(-1).text, /Invalid group GID/)
  await entries.find(entry => entry.options.on === 'text').handler(message)
  assert.equal(downloads(), 0)
})

test('manual commands with the configured prefix do not trigger a second automatic download', async () => {
  const { entries, message, downloads } = setup()
  await entries.find(entry => entry.options.on === 'text').handler({ ...message, text: ',facebook ' + message.text })
  assert.equal(downloads(), 0)
})
