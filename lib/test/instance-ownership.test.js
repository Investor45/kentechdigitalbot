const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { setValues, selectProcess } = require('../../deploy/instance-tools')
const { readInstance } = require('../instance')

test('duplicate config keys are collapsed and instance metadata stays private', () => {
  const config = [
    'BOT_NAME="OLD"',
    'BOT_NAME="NEW"',
    'SESSION_ID="session-1"',
    'SUDO="123"',
    '',
  ].join('\n')
  const next = setValues(config, { BOT_NAME: 'BOT', SESSION_ID: 'session-2' })
  assert.ok(!next.includes('BOT_NAME="OLD"'))
  assert.ok(next.includes('BOT_NAME="BOT"'))
  assert.ok(next.includes('SESSION_ID="session-2"'))
  assert.equal(next.match(/BOT_NAME=/g)?.length, 1)
})

test('duplicate PM2 process identity is rejected before any restart', () => {
  const instance = { name: 'TEST', directory: '/tmp/bot-test', id: '123e4567-e89b-12d3-a456-426614174000' }
  const processes = [
    { name: 'TEST', pm_id: 1, pm2_env: { pm_cwd: '/tmp/bot-test', KENTECH_INSTANCE_ID: instance.id } },
    { name: 'TEST', pm_id: 2, pm2_env: { pm_cwd: '/tmp/bot-test', KENTECH_INSTANCE_ID: instance.id } },
  ]
  assert.throws(() => selectProcess(processes, instance), /Duplicate PM2 identity/)
})

test('managed instance markers reject mismatched directories and require a valid owner', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kentech-instance-'))
  const foreign = fs.mkdtempSync(path.join(os.tmpdir(), 'kentech-foreign-'))
  const marker = path.join(directory, '.kentech-instance.json')
  fs.writeFileSync(marker, JSON.stringify({ id: '123e4567-e89b-12d3-a456-426614174000', name: 'TEST', directory }))
  assert.deepEqual(readInstance(directory), { id: '123e4567-e89b-12d3-a456-426614174000', name: 'TEST', directory })
  fs.writeFileSync(path.join(foreign, '.kentech-instance.json'), JSON.stringify({ id: '11111111-2222-3333-4444-555555666666', name: 'FAKE', directory }))
  assert.throws(() => readInstance(foreign), /Invalid instance ownership marker/)
  fs.rmSync(directory, { recursive: true, force: true })
  fs.rmSync(foreign, { recursive: true, force: true })
})
