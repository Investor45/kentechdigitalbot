const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { readSessionFiles } = require('../session-files')

test('retries a partial authentication write and waits for a stable snapshot', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'session-files-test-'))
  try {
    await fs.writeFile(path.join(directory, 'creds.json'), '')
    const reading = readSessionFiles(directory, { pause: 10, attempts: 100 })
    await new Promise(resolve => setTimeout(resolve, 30))
    await fs.writeFile(path.join(directory, 'pre-key-1.json'), '{"key":"saved"}')
    await fs.writeFile(path.join(directory, 'creds.json'), '{"registered":true}')
    assert.deepEqual(await reading, { 'creds.json': { registered: true }, 'pre-key-1.json': { key: 'saved' } })
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})

test('persistent incomplete files fail with an actionable error', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'session-files-test-'))
  try {
    await fs.writeFile(path.join(directory, 'creds.json'), '')
    await assert.rejects(readSessionFiles(directory, { pause: 1, attempts: 3 }), /did not finish saving/)
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})
