const crypto = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const { decodeSession, encodeSession } = require('./session-bundle')
const SHORT_SESSION = /^KTECH_[A-Za-z0-9_-]{22}$/
const lookup = id => crypto.createHash('sha256').update(`lookup:${id}`).digest('hex')
const key = id => crypto.createHash('sha256').update(`encryption:${id}`).digest()

async function storeSession(directory, files) {
  const id = 'KTECH_' + crypto.randomBytes(16).toString('base64url')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(id), iv)
  cipher.setAAD(Buffer.from(lookup(id)))
  const data = Buffer.concat([cipher.update(encodeSession(files), 'utf8'), cipher.final()])
  const record = { iv: iv.toString('base64url'), tag: cipher.getAuthTag().toString('base64url'), data: data.toString('base64url') }
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  await fs.writeFile(path.join(directory, lookup(id) + '.json'), JSON.stringify(record), { mode: 0o600, flag: 'wx' })
  return id
}

function decryptSession(id, record) {
  if (!SHORT_SESSION.test(id)) throw new Error('Invalid short KENTECH session')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(id), Buffer.from(record.iv, 'base64url'))
  decipher.setAAD(Buffer.from(lookup(id)))
  decipher.setAuthTag(Buffer.from(record.tag, 'base64url'))
  return decodeSession(Buffer.concat([decipher.update(Buffer.from(record.data, 'base64url')), decipher.final()]).toString('utf8'))
}

async function resolveSession(id) {
  if (!SHORT_SESSION.test(id)) return decodeSession(id)
  const base = process.env.SESSION_SERVER_URL || 'http://172.236.137.138:3100'
  const response = await fetch(`${base.replace(/\/$/, '')}/api/session/${lookup(id)}`, { signal: AbortSignal.timeout(15000) })
  if (response.status === 404) throw new Error('KENTECH session was not found or has expired. Generate a new session ID and update this bot.')
  if (!response.ok) throw new Error(`KENTECH session server returned HTTP ${response.status}. Check SESSION_SERVER_URL and try again.`)
  const text = await response.text()
  if (text.length > 500000) throw new Error('Invalid session response size')
  return decryptSession(id, JSON.parse(text))
}
module.exports = { SHORT_SESSION, lookup, storeSession, decryptSession, resolveSession }
