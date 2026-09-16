const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

function setup() {
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
      return JSON.stringify(['120363191116053479@g.us'])
    },
    writeFileSync() {},
  }
  const source = fs.readFileSync(path.join(__dirname, '../../plugins/auto-social-download.js'), 'utf8')
  vm.runInNewContext(source, {
    require(name) {
      if (name === '../lib/') return lib
      if (name.endsWith('tiktok-download')) return { downloadTikTok: async () => null, tiktokUrl: () => null }
      if (name.endsWith('download-group-guard')) return { getGuard: () => ({ shouldBlock: () => false }) }
      if (name.endsWith('youtube-download')) return { downloadYouTube: async () => null, youtubeId: () => null }
      if (name === 'fs') return fakeFs
      if (name === 'path') return path
      throw new Error(`Unexpected require: ${name}`)
    },
    __dirname: path.join(__dirname, '../../plugins'),
    process: { stderr: { write() {} } },
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
