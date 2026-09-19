const { SHORT_SESSION, resolveSession } = require('./short-session')
const { createHash } = require('node:crypto')
const { DataTypes } = require('sequelize')
const pending = new WeakMap()

async function importSessionBundle(database, rawSessionId, session = process.env.BOT_INSTANCE_ID || '0') {
  if (arguments.length < 3) session = resolveAuthNamespace(database, session)
  if (!session || (String(session) !== '0' && !/^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$/.test(String(session)))) {
    throw new Error('A valid BOT_INSTANCE_ID/auth namespace is required')
  }
  if (!SHORT_SESSION.test(rawSessionId) && !String(rawSessionId).startsWith('KENTECH_')) return false
  // Serialize imports on a SQLite connection, including schema initialization.
  const previous = pending.get(database) || Promise.resolve()
  const next = previous.catch(() => {}).then(() => importBundle(database, rawSessionId, session))
  pending.set(database, next)
  return next
}

// The bundled Levanter client reads auth rows from namespace "0". Managed
// bots use a private SQLite database, so using that legacy namespace remains
// isolated per bot. Shared databases must retain their explicit instance
// namespace to avoid cross-bot credentials.
function resolveAuthNamespace(database, instanceId = process.env.BOT_INSTANCE_ID || '0') {
  const storage = database?.options?.storage
  const privateSqlite = typeof storage === 'string' && storage.length > 0
  return privateSqlite ? '0' : instanceId
}

async function importBundle(database, rawSessionId, session) {
  const bindings = database.models.kentech_session_binding ||
    (typeof database.define === 'function'
      ? database.define('kentech_session_binding', {
          session: { type: DataTypes.STRING, primaryKey: true },
          fingerprint: { type: DataTypes.STRING, allowNull: false },
        }, { timestamps: false })
      : {
          store: database.__session_bindings || (database.__session_bindings = {}),
          async findByPk(key) {
            return this.store[key] || null
          },
          async create(record) {
            this.store[record.session] = record
            return record
          },
        })
  if (typeof database.sync === 'function') await database.sync()
  const keys = database.models.wakey || database.models.wakeys ||
    Object.values(database.models).find(model => model.getTableName?.() === 'wakeys')
  const credentials = database.models.wacred || database.models.wacreds ||
    Object.values(database.models).find(model => model.getTableName?.() === 'wacreds')
  if (!keys || !credentials) throw new Error('WhatsApp session storage is unavailable')
  const countKeys = typeof keys.count === 'function' ? keys.count.bind(keys) : async () => 0
  const countCredentials = typeof credentials.count === 'function' ? credentials.count.bind(credentials) : async () => 0
  const bindingAvailable = !!database.models.kentech_session_binding || typeof database.define === 'function'
  const fingerprint = createHash('sha256').update(rawSessionId).digest('hex')
  const existing = await bindings.findByPk(session)
  if (existing && existing.fingerprint !== fingerprint) throw new Error('Session differs from this instance binding; use a new isolated deployment or an explicit offline replacement')
  if (await countCredentials({ where: { session } })) {
    if (!existing && bindingAvailable) throw new Error('Existing authentication has no verified session binding; refusing to reuse or overwrite it')
    return false
  }
  if (await countKeys({ where: { session } })) throw new Error('Orphaned authentication keys require an offline ownership review')
  const files = await resolveSession(rawSessionId)

  const rows = Object.entries(files).filter(([file]) => file !== 'creds.json').map(([file, value]) => ({
    session,
    type: file.slice(0, -5).replace(/^((?:pre-key|session|sender-key|app-state-sync-key|app-state-sync-version|sender-key-memory|identity-key|tctoken|lid-mapping))-/, '$1'),
    value: JSON.stringify(value),
  }))
  const runInTransaction = typeof database.transaction === 'function'
    ? callback => database.transaction(callback)
    : callback => callback({})
  return runInTransaction(async transaction => {
    const count = await credentials.count({ where: { session }, transaction })
    if (count) throw new Error('Authentication changed during import; refusing concurrent initialization')
    if (!existing) await bindings.create({ session, fingerprint }, { transaction })
    await credentials.create({ session, type: 'wacreds', value: JSON.stringify(files['creds.json']) }, { transaction })
    if (rows.length) await keys.bulkCreate(rows, { transaction })
    return true
  })
}

module.exports = { importSessionBundle, resolveAuthNamespace }
