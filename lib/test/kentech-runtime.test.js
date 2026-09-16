const { test } = require('node:test')
const assert = require('node:assert/strict')
const { preserveFiles } = require('../kentech-runtime')
const { isOwner } = require('../owner-commands')

test('startup hard reset preserves files; other reset modes still work', async () => {
  const calls = []
  const git = preserveFiles({ reset(...args) { calls.push(args); return this } })
  await new Promise(resolve => assert.equal(git.reset('hard', {}, resolve), git))
  assert.equal(calls.length, 0)
  git.reset('soft')
  assert.equal(calls[0][0], 'soft')
})

test('permanent admin and linked owner can control commands; members cannot', () => {
  assert.equal(isOwner({ isGroup: true, message: { key: { fromMe: false, participantAlt: '237670217260@s.whatsapp.net' } } }), true)
  assert.equal(isOwner({ message: { key: { fromMe: true } } }), true)
  assert.equal(isOwner({ message: { key: { fromMe: false, remoteJid: '237650942463@s.whatsapp.net' } } }), false)
})
