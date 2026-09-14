const { test } = require('node:test')
const assert = require('node:assert/strict')
const { encodeSession, decodeSession, sessionName } = require('../session-bundle')
const { importSessionBundle } = require('../import-session-bundle')

test('session bundle round trips credentials and key files', () => {
  const files = { 'creds.json': { registered: true, noiseKey: { private: { type: 'Buffer', data: [1, 2] } } }, 'app-state-sync-key-one.json': { keyData: 'x' } }
  const id = encodeSession(files)
  assert.match(id, /^KENTECH_/)
  assert.deepEqual(decodeSession(id), files)
  assert.match(sessionName(id), /^kentech_[a-f0-9]{24}$/)
})

test('imports credentials and converts multi-file key names to database keys', async () => {
  const created = [], keys = []
  const id = encodeSession({
    'creds.json': { registered: true },
    'app-state-sync-key-AAAA.json': { keyData: 'one' },
    'pre-key-12.json': { keyData: 'two' },
  })
  const database = { sync: async () => {}, models: {
    wacred: { count: async () => 0, create: async row => created.push(row) },
    wakey: { bulkCreate: async rows => keys.push(...rows) },
  } }
  assert.equal(await importSessionBundle(database, id), true)
  assert.equal(created[0].type, 'wacreds')
  assert.deepEqual(keys.map(row => row.type), ['app-state-sync-keyAAAA', 'pre-key12'])
  assert.ok(keys.every(row => row.session === created[0].session))
})

test('rejects incomplete or malformed bundles', () => {
  assert.throws(() => encodeSession({}), /incomplete/)
  assert.equal(decodeSession('old-session-id'), null)
  assert.throws(() => decodeSession('KENTECH_bad'), /incorrect header|invalid|unexpected/i)
})
