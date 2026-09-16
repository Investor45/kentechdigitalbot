const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const http = require('node:http')
const { storeSession, lookup, decryptSession, resolveSession } = require('../short-session')
const { importSessionBundle } = require('../import-session-bundle')

test('28-character sessions persist encrypted and resolve without transmitting the decryption key', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'short-session-test-'))
  let server
  const previous = process.env.SESSION_SERVER_URL
  try {
    const files = { 'creds.json': { registered: true, secret: 'private-credential' }, 'pre-key-1.json': { key: 'saved' } }
    const id = await storeSession(directory, files)
    assert.equal(id.length, 28)
    const stored = await fs.readFile(path.join(directory, lookup(id) + '.json'), 'utf8')
    assert.equal(stored.includes('private-credential'), false)
    assert.equal(stored.includes(id), false)
    const record = JSON.parse(stored)
    assert.deepEqual(decryptSession(id, record), files)
    assert.throws(() => decryptSession(id, { ...record, tag: Buffer.alloc(16).toString('base64url') }))
    server = http.createServer((req, res) => {
      assert.equal(req.url, '/api/session/' + lookup(id))
      assert.equal(req.url.includes(id), false)
      res.end(stored)
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    process.env.SESSION_SERVER_URL = `http://127.0.0.1:${server.address().port}`
    assert.deepEqual(await resolveSession(id), files)
    await new Promise(resolve => server.close(resolve))
    const database = { sync: async () => {}, models: {
      wacred: { count: async () => 1 }, wakey: {},
    } }
    // Once imported, restart succeeds even when the generator is offline.
    assert.equal(await importSessionBundle(database, id), false)
  } finally {
    if (server?.listening) await new Promise(resolve => server.close(resolve))
    if (previous === undefined) delete process.env.SESSION_SERVER_URL
    else process.env.SESSION_SERVER_URL = previous
    await fs.rm(directory, { recursive: true, force: true })
  }
})
