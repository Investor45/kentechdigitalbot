const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ADMIN, sudoNumbers, prepare } = require('../sudo-access')
const { isOwner } = require('../owner-commands')

test('permanent admin preserves customer sudo and normalizes local admin alias', () => {
  assert.equal(sudoNumbers('15551234567,670217260,237670217260'), '15551234567,' + ADMIN)
  assert.equal(sudoNumbers(''), ADMIN)
})
test('verified private and group LID messages resolve without impersonating the bot owner', async () => {
  for (const group of [false, true]) {
    const state = { env: { SUDO: '15551234567' } }
    const key = group ? { remoteJid: '1@g.us', participant: '123@lid', fromMe: false }
      : { remoteJid: '123@lid', fromMe: false }
    const raw = { key, message: { conversation: '.ping' } }
    const client = { session: { signalRepository: { lidMapping: { getPNForLID: async () => ADMIN + '@s.whatsapp.net' } } } }
    const result = await prepare(raw, client, state)
    assert.equal(result.key[group ? 'participantAlt' : 'remoteJidAlt'], ADMIN + '@s.whatsapp.net')
    assert.equal(result.key.fromMe, false)
    assert.equal(isOwner({ isGroup: group, key: result.key }), true)
    assert.equal(raw.key[group ? 'participantAlt' : 'remoteJidAlt'], undefined)
    assert.ok(state.TEMP_SUDO.includes(ADMIN))
    assert.ok(state.TEMP_SUDO.includes('15551234567'))
  }
})
test('unverified identities and mentions never gain admin identity', async () => {
  const raw = { key: { remoteJid: '999@lid', fromMe: false }, message: { extendedTextMessage: { contextInfo: { mentionedJid: [ADMIN + '@s.whatsapp.net'] } } } }
  assert.equal(await prepare(raw, {}, {}), raw)
  const client = { session: { signalRepository: { lidMapping: { getPNForLID: async () => { throw Error('unavailable') } } } } }
  assert.equal(await prepare(raw, client, {}), raw)
  assert.equal(isOwner({ key: raw.key }), false)
})
