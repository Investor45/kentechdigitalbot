const { brotliCompressSync, brotliDecompressSync, constants, gzipSync, gunzipSync } = require('node:zlib')
const { createHash } = require('node:crypto')
const { deserialize, serialize } = require('node:v8')

const PREFIX = 'KENTECH_'
const FILE_NAME = /^(creds|[a-z0-9-]+-[A-Za-z0-9_+=.-]+)\.json$/

function encodeSession(files) {
  const clean = {}
  for (const [name, value] of Object.entries(files || {})) {
    if (!FILE_NAME.test(name)) continue
    clean[name] = typeof value === 'string' ? JSON.parse(value) : value
  }
  if (!clean['creds.json']) throw new Error('Session credentials are incomplete')
  return PREFIX + brotliCompressSync(serialize({ version: 2, files: clean }), {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  })
    .toString('base64url')
}

function decodeSession(value) {
  if (!String(value || '').startsWith(PREFIX)) return null
  const encoded = String(value).slice(PREFIX.length)
  if (!encoded || encoded.length > 250000) throw new Error('Invalid KENTECH session size')
  const compressed = Buffer.from(encoded, 'base64url')
  let bundle
  let decoded
  try {
    decoded = brotliDecompressSync(compressed)
  } catch (_) {
    decoded = gunzipSync(compressed)
  }
  try {
    bundle = deserialize(decoded)
  } catch (_) {
    bundle = JSON.parse(decoded)
  }
  if (![1, 2].includes(bundle.version) || !bundle.files?.['creds.json']) throw new Error('Invalid KENTECH session')
  for (const name of Object.keys(bundle.files)) {
    if (!FILE_NAME.test(name)) throw new Error('Invalid session entry')
  }
  return bundle.files
}

function sessionName(value) {
  if (!String(value || '').startsWith(PREFIX)) return String(value || '')
  return `levanter_${createHash('sha1').update(String(value)).digest('hex')}`
}

module.exports = { PREFIX, encodeSession, decodeSession, sessionName }
