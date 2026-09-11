const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

const registered = []
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../plugins/setstatus.js'), 'utf8'), {
  require: name => name.endsWith('owner-commands') ? require('../owner-commands') : ({
    bot: (options, handler) => registered.push({ options, handler }),
    parsedJid: text => text.split(/\s+/).filter(jid => /^\d+@g\.us$/.test(jid)),
    lang: { plugins: { setstatus: {}, scstatus: {} } },
  }),
  setTimeout: () => ({ unref() {} }),
})
const mystatusCommand = registered.find(c => c.options.pattern?.startsWith('mystatus'))
const command = registered.find(c => c.options.pattern?.startsWith('gstatus'))
const listCommand = registered.find(c => c.options.pattern?.startsWith('groupids'))
const textListCommand = registered.find(c => c.options.type === 'groupidsOwner')
function fixture() {
  const sent = [], posted = []
  const message = {
    isGroup: true, jid: '123@g.us', message: { key: { fromMe: true } },
    reply_message: { image: true },
    client: {
      user: { id: '456:2@s.whatsapp.net', lid: '789@lid' },
      groupMetadata: async () => ({ participants: [{ id: '789@lid', admin: 'admin' }] }),
      groupFetchAllParticipating: async () => ({
        '123@g.us': { subject: 'Kentech Team', participants: [{ id: '789@lid', admin: 'admin' }] },
      }),
    },
    send: async text => sent.push(text),
    setStatus: async () => 1,
    groupStatus: async (source, jid) => posted.push({ source, jid }),
  }
  return { message, sent, posted }
}

test('posts the replied image, video, or text to the current group status', async () => {
  assert.equal(command.options.fromMe, undefined)
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
  message.message.key.fromMe = false
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
  await command.handler({ ...message }, '')
  assert.equal(posted.length, 0)
})

test('does not report success when permissions or posting fail', async () => {
  const { message, posted, sent } = fixture()
  message.client.groupMetadata = async () => ({ participants: [{ id: '789@lid', admin: null }] })
  message.groupStatus = async () => { throw new Error('denied') }
  await command.handler({ ...message }, '')
  assert.equal(posted.length, 0)
  assert.match(sent[0], /Could not post the group status/)
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
    'Your WhatsApp groups:', '',
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

test('accepts prefixed groupids text from the owner', async () => {
  const { message, sent } = fixture()
  message.text = '.groupids'
  await textListCommand.handler(message)
  assert.match(sent[0], /Group ID: 123@g\.us/)
})

test('posts replied content to personal status and schedules renewals', async () => {
  const { message, sent } = fixture()
  assert.match(mystatusCommand.options.pattern, /^mystatus/)
  assert.equal(mystatusCommand.options.fromMe, undefined)
  await mystatusCommand.handler(message, '')
  assert.equal(sent[0], 'Status posted to 1 contact(s). Renewals are scheduled while the bot stays running.')
})

test('pattern and text dispatch post only once for the same command', async () => {
  const { message, posted } = fixture()
  message.text = '.gstatus'
  message.message.key.id = 'dedup-test'
  await command.handler(message, '')
  await registered.find(c => c.options.type === 'gstatusOwner').handler({ ...message })
  assert.equal(posted.length, 1)
})

test('rejects incoming sudo messages even if the framework sets fromMe', async () => {
  const { message, sent } = fixture()
  message.fromMe = true
  message.message.key.fromMe = false
  await listCommand.handler(message)
  assert.equal(sent.length, 0)
})

test('supports the older raw data key without allowing it to override the current key', async () => {
  const { message, sent } = fixture()
  message.data = message.message
  delete message.message
  await listCommand.handler(message)
  assert.equal(sent.length, 1)
  message.message = { key: { fromMe: false } }
  await listCommand.handler({ ...message })
  assert.equal(sent.length, 1)
})

test('gid reads the actual group key without relying on isGroup', async () => {
  const entries = []
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../plugins/gid.js'), 'utf8'), {
    require: name => name.endsWith('owner-commands') ? require('../owner-commands') : {
      bot: (options, handler) => entries.push({ options, handler }),
    },
  })
  for (const text of ['.gid', 'gid']) {
    const sent = []
    const message = { text, message: { key: { fromMe: true, remoteJid: '123@g.us' } }, send: async value => sent.push(value) }
    await entries.find(c => c.options.on).handler(message)
    assert.deepEqual(sent, ['Group ID:\n123@g.us'])
  }
})
