const { decodeSession, sessionName } = require('./session-bundle')

async function importSessionBundle(database, rawSessionId) {
  const files = decodeSession(rawSessionId)
  if (!files) return false
  const session = sessionName(rawSessionId)
  await database.sync()
  const keys = database.models.wakey || database.models.wakeys ||
    Object.values(database.models).find(model => model.getTableName?.() === 'wakeys')
  const credentials = database.models.wacred || database.models.wacreds ||
    Object.values(database.models).find(model => model.getTableName?.() === 'wacreds')
  if (!keys || !credentials) throw new Error('WhatsApp session storage is unavailable')

  const count = await credentials.count({ where: { session } })
  if (count) return false
  await credentials.create({ session, type: 'wacreds', value: JSON.stringify(files['creds.json']) })
  const rows = Object.entries(files).filter(([file]) => file !== 'creds.json').map(([file, value]) => ({
    session,
    type: file.slice(0, -5).replace(/^((?:pre-key|session|sender-key|app-state-sync-key|app-state-sync-version|sender-key-memory))-/, '$1'),
    value: JSON.stringify(value),
  }))
  if (rows.length) await keys.bulkCreate(rows, { ignoreDuplicates: true })
  return true
}

module.exports = { importSessionBundle }
