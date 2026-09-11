const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

const registered = []
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../plugins/setstatus.js'), 'utf8'), {
  require: () => ({
    bot: (options, handler) => registered.push({ options, handler }),
    parsedJid: text => text.split(/\s+/).filter(jid => /^\d+@g\.us$/.test(jid)),
    lang: { plugins: { setstatus: {}, scstatus: {} } },
  }),
})
const command = registered.find(c => c.options.pattern?.startsWith('gstatus'))
const listCommand = registered.find(c => c.options.pattern === 'groupids')
const textListCommand = registered.find(c => c.options.type === 'groupIdsOwner')
function fixture() {
  const sent = [], posted = []
  const message = {
    isGroup: true, jid: '123@g.us', data: { key: { fromMe: true } },
    reply_message: { image: true },
    client: {
      user: { id: '456:2@s.whatsapp.net', lid: '789@lid' },
      groupMetadata: async () => ({ participants: [{ id: '789@lid', admin: 'admin' }] }),
      groupFetchAllParticipating: async () => ({
        '123@g.us': { subject: 'Kentech Team', participants: [{ id: '789@lid', admin: 'admin' }] },
      }),
    },
    send: async text => sent.push(text),
    groupStatus: async (source, jid) => posted.push({ source, jid }),
  }
  return { message, sent, posted }
}

test('posts the replied image, video, or text to the current group status', async () => {
  assert.equal(command.options.fromMe, true)
  for (const reply of [{ image: true }, { video: true }, { txt: true, text: 'Hello' }]) {
    const { message, posted, sent } = fixture()
    message.reply_message = reply
    await command.handler(message, '')
    assert.equal(posted.length, 1)
    assert.equal(posted[0].jid, message.jid)
    assert.equal(posted[0].source, message)
    assert.equal(sent[0], 'Group status posted.')
  }
})

test('does not allow a different account, including sudo', async () => {
  const { message, posted, sent } = fixture()
  message.data.key.fromMe = false
  await command.handler(message, '')
  assert.equal(posted.length, 0)
  assert.equal(sent.length, 0)
})

test('requires a reply and group context', async () => {
  const { message, posted } = fixture()
  message.reply_message = null
  await command.handler(message, '')
  message.reply_message = { image: true }
  message.isGroup = false
  await command.handler(message, '')
  assert.equal(posted.length, 0)
})

test('does not report success when permissions or posting fail', async () => {
  const { message, posted, sent } = fixture()
  message.client.groupMetadata = async () => ({ participants: [{ id: '789@lid', admin: null }] })
  await command.handler(message, '')
  assert.equal(posted.length, 0)
  message.client.groupMetadata = async () => ({ participants: [{ id: '789@lid', admin: 'admin' }] })
  message.groupStatus = async () => { throw new Error('denied') }
  await command.handler(message, '')
  assert.equal(sent.some(text => text.includes('status posted')), false)
})

test('explicit group targets are deduplicated', async () => {
  const { message, posted } = fixture()
  await command.handler(message, '999@g.us 999@g.us')
  assert.equal(posted.length, 1)
  assert.equal(posted[0].jid, '999@g.us')
})

test('lists owned groups with stable git names from private chat', async () => {
  const { message, sent } = fixture()
  message.isGroup = false
  await listCommand.handler(message, '')
  assert.equal(sent[0], [
    'Your WhatsApp admin groups:', '',
    '1. Kentech Team',
    'Group ID: 123@g.us',
    'Code: kentech-team',
    'Post: gstatus/kentech-team',
  ].join('\n'))
})

test('posts to a git name from private chat', async () => {
  const { message, posted, sent } = fixture()
  message.isGroup = false
  await command.handler(message, '/kentech-team')
  assert.equal(posted.length, 1)
  assert.equal(posted[0].jid, '123@g.us')
  assert.equal(sent[0], 'Group status posted.')
})

test('accepts bare groupids text from the owner', async () => {
  const { message, sent } = fixture()
  message.text = 'groupids'
  await textListCommand.handler(message)
  assert.match(sent[0], /Group ID: 123@g\.us/)
})
