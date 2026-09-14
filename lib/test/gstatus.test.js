const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

function setup() {
  const entries = []
  const lib = { bot: (options, handler) => entries.push({ options, handler }),
    lang: { plugins: { setstatus: {}, scstatus: {} } } }
  for (const file of ['setstatus.js', 'status-commands-custom.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../plugins', file), 'utf8'), {
      require: name => name.endsWith('owner-commands') ? require('../owner-commands') : lib,
      process: { stderr: { write() {} } },
    })
  }
  const posted = [], sent = []
  const message = {
    text: '.gstatus', isGroup: true, jid: '123@g.us',
    message: { key: { remoteJid: '123@g.us', id: 'command-1', fromMe: true } },
    reply_message: { image: true },
    groupStatus: async (_, jid) => { posted.push(jid); await new Promise(setImmediate) },
    send: async text => sent.push(text),
  }
  return { entries, message, posted, sent,
    command: entries.find(e => e.options.pattern?.startsWith('gstatus')),
    listener: entries.find(e => e.options.type === 'gstatusOwner') }
}

test('only one plugin registers gstatus; scheduled status commands remain available', () => {
  const { entries } = setup()
  assert.equal(entries.filter(e => e.options.pattern?.startsWith('gstatus')).length, 1)
  assert.ok(entries.some(e => e.options.pattern?.startsWith('scstatus')))
})

test('simultaneous pattern and text dispatch posts and confirms only once', async () => {
  const { command, listener, message, posted, sent } = setup()
  await Promise.all([command.handler(message, ''), listener.handler({ ...message }),
    command.handler({ ...message }, '')])
  assert.deepEqual(posted, ['123@g.us'])
  assert.deepEqual(sent, ['Group status posted.'])
})

test('replayed command keys are suppressed but a new command can repost the same media', async () => {
  const { command, message, posted } = setup()
  await command.handler(message, '')
  await command.handler({ ...message, message: { key: { ...message.message.key } } }, '')
  await command.handler({ ...message, message: { key: { ...message.message.key, id: 'command-2' } } }, '')
  assert.equal(posted.length, 2)
})

test('bare and slash-target commands work and duplicate destinations post once each', async () => {
  const { listener, message, posted } = setup()
  message.text = 'gstatus/456@g.us 456@g.us 789@g.us'
  await listener.handler(message)
  assert.deepEqual(posted, ['456@g.us', '789@g.us'])
})

test('incoming sudo messages cannot post', async () => {
  const { command, message, posted } = setup()
  message.fromMe = true
  message.message.key.fromMe = false
  await command.handler(message, '')
  assert.equal(posted.length, 0)
})

test('failure is reported once without an automatic duplicate attempt', async () => {
  const { command, listener, message, sent } = setup()
  let attempts = 0
  message.groupStatus = async () => { attempts++; throw new Error('denied') }
  await Promise.all([command.handler(message, ''), listener.handler({ ...message })])
  assert.equal(attempts, 1)
  assert.equal(sent.length, 1)
  assert.match(sent[0], /Could not post/)
})
