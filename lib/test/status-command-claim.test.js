const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { claimStatusCommand } = require('../status-command-claim')

test('status receipts suppress another linked device and survive module reload', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'status-claim-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  const message = { client: { user: { id: '237670217260:1@s.whatsapp.net' } },
    message: { key: { remoteJid: '123@g.us', id: 'one' } } }
  assert.equal(claimStatusCommand(message, directory), true)
  message.client.user.id = '237670217260:2@s.whatsapp.net'
  delete require.cache[require.resolve('../status-command-claim')]
  assert.equal(require('../status-command-claim').claimStatusCommand(message, directory), false)
  message.message.key.id = 'two'
  assert.equal(claimStatusCommand(message, directory), true)
  message.client.user.id = '999@s.whatsapp.net'
  assert.equal(claimStatusCommand(message, directory), true)
})
