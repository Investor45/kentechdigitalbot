const { test } = require('node:test')
const assert = require('node:assert/strict')
const { normalizePhoneNumber, sessionBelongsToPhone } = require('../session-ownership')

test('generator accepts only the requested WhatsApp account and rejects mismatched sessions', () => {
  assert.equal(normalizePhoneNumber('+1 (555) 123-4567'), '15551234567')
  assert.equal(normalizePhoneNumber('15551234567@s.whatsapp.net'), '15551234567')
  assert.equal(normalizePhoneNumber('invalid'), '')

  const creds = { me: { id: '15551234567@s.whatsapp.net' } }
  assert.equal(sessionBelongsToPhone(creds, '15551234567'), true)
  assert.equal(sessionBelongsToPhone(creds, '15557654321'), false)
  assert.equal(sessionBelongsToPhone(null, '15551234567'), false)
})
