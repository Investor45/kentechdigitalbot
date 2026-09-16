const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const fs = require('node:fs')
const path = require('node:path')

async function startup({ id = 'KTECH_example', failure } = {}) {
  const events = [], exits = []
  const database = { authenticate: async () => { events.push('database') } }
  const context = {
    require(name) {
      if (name.endsWith('client')) return { Client: class { async connect() { events.push('connect') } }, logger: { info() {}, error() {} } }
      if (name === './config') return { DATABASE: database, VERSION: 'test', SESSION_ID: id }
      if (name.endsWith('import-session-bundle')) return { importSessionBundle: async () => { events.push('session'); if (failure) throw new Error('Session unavailable') } }
      return { install() {} }
    },
    process: { on() {}, exit(code) { exits.push(code) } },
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8'), context)
  await new Promise(setImmediate)
  return { events, exits }
}

test('startup imports authentication before connecting for both session formats', async () => {
  for (const id of ['KTECH_example', 'legacy-session']) {
    const result = await startup({ id })
    assert.deepEqual(result.events, ['database', 'session', 'connect'])
    assert.deepEqual(result.exits, [])
  }
})

test('missing and unavailable sessions exit with failure instead of remaining online', async () => {
  const missing = await startup({ id: '' })
  assert.deepEqual(missing.exits, [1])
  assert.deepEqual(missing.events, [])
  const unavailable = await startup({ failure: true })
  assert.deepEqual(unavailable.exits, [1])
  assert.deepEqual(unavailable.events, ['database', 'session'])
})
