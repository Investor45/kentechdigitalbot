const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'user-bans.json')

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {} } catch (_) { return {} }
}

function save(value) {
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(value, null, 2))
  fs.renameSync(`${FILE}.tmp`, FILE)
}

function setBan(jid, expiresAt = null) {
  const bans = load()
  bans[String(jid)] = { expiresAt, updatedAt: new Date().toISOString() }
  save(bans)
  return bans[String(jid)]
}

function clearBan(jid) {
  const bans = load()
  delete bans[String(jid)]
  save(bans)
}

function isBanned(jid) {
  const bans = load()
  const entry = bans[String(jid)]
  if (!entry) return false
  if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) { delete bans[String(jid)]; save(bans); return false }
  return true
}

module.exports = { setBan, clearBan, isBanned }
