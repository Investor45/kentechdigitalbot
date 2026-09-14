const { gzipSync, gunzipSync } = require('node:zlib')
const { createHash } = require('node:crypto')

const PREFIX = 'KENTECH_'
const FILE_NAME = /^(creds|[a-z0-9-]+-[A-Za-z0-9_+=.-]+)\.json$/

function encodeSession(files) {
  const clean = {}
  for (const [name, value] of Object.entries(files || {})) {
    if (!FILE_NAME.test(name)) continue
    clean[name] = typeof value === 'string' ? JSON.parse(value) : value
  }
  if (!clean['creds.json']) throw new Error('Session credentials are incomplete')
  return PREFIX + gzipSync(JSON.stringify({ version: 1, files: clean }))
    .toString('base64url')
}

function decodeSession(value) {
  if (!String(value || '').startsWith(PREFIX)) return null
  const encoded = String(value).slice(PREFIX.length)
  if (!encoded || encoded.length > 250000) throw new Error('Invalid KENTECH session size')
  const bundle = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64url')))
  if (bundle.version !== 1 || !bundle.files?.['creds.json']) throw new Error('Invalid KENTECH session')
  for (const name of Object.keys(bundle.files)) {
    if (!FILE_NAME.test(name)) throw new Error('Invalid session entry')
  }
  return bundle.files
}

function sessionName(value) {
  if (!String(value || '').startsWith(PREFIX)) return String(value || '')
  return `kentech_${createHash('sha256').update(String(value)).digest('hex').slice(0, 24)}`
}

module.exports = { PREFIX, encodeSession, decodeSession, sessionName }
