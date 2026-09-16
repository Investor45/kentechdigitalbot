const { test } = require('node:test')
const assert = require('node:assert/strict')
const { Sequelize, DataTypes } = require('sequelize')
const { encodeSession } = require('../session-bundle')
const { importSessionBundle } = require('../import-session-bundle')

test('fresh SQLite import is atomic and repeated startup preserves existing credentials', async () => {
  const database = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false })
  const attributes = { session: DataTypes.STRING, type: DataTypes.STRING, value: DataTypes.TEXT }
  const credentials = database.define('wacred', attributes)
  const keys = database.define('wakey', attributes)
  const id = encodeSession({ 'creds.json': { registered: true }, 'pre-key-12.json': { public: 'key' } })
  try {
    const original = keys.bulkCreate
    keys.bulkCreate = async () => { throw new Error('write failed') }
    await assert.rejects(importSessionBundle(database, id), /write failed/)
    assert.equal(await credentials.count(), 0)
    keys.bulkCreate = original
    assert.equal(await importSessionBundle(database, id), true)
    const row = await credentials.findOne({ where: { session: '0' } })
    assert.equal(JSON.parse(row.value).registered, true)
    await row.update({ value: JSON.stringify({ registered: true, updated: true }) })
    assert.equal(await importSessionBundle(database, id), false)
    assert.equal(JSON.parse((await row.reload()).value).updated, true)
    assert.equal(await keys.count(), 1)
    assert.equal(await importSessionBundle(database, 'legacy-session-id'), false)
    assert.equal(await credentials.count(), 1)
  } finally { await database.close() }
})
