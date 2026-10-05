// Uses the existing connected client; never creates or imports a WhatsApp session.
const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

function startBridge(client, options = {}) {
  let token = options.token || process.env.WHATSAPP_ADMIN_BRIDGE_TOKEN
  if (!token) {
    const envFile = path.join(process.cwd(), 'config.env')
    if (fs.existsSync(envFile)) token = require('dotenv').parse(fs.readFileSync(envFile)).WHATSAPP_ADMIN_BRIDGE_TOKEN
  }
  if (!token || token.length < 32) return null
  const directory = options.directory || path.join(process.cwd(), '.admin-notification-inbox')
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  let running = false
  let requests = 0
  let window = Date.now()
  const save = (file, value) => {
    fs.writeFileSync(file + '.tmp', JSON.stringify(value), { mode: 0o600 })
    fs.renameSync(file + '.tmp', file)
  }
  const server = http.createServer(async (req, res) => {
    const reply = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    const provided = String(req.headers.authorization || '')
    const expected = 'Bearer ' + token
    if (Buffer.byteLength(provided) !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return reply(401, { status: 'REJECTED' })
    if (req.method !== 'POST' || req.url !== '/internal/admin-notification') return reply(404, { status: 'REJECTED' })
    if (Date.now() - window > 60000) { window = Date.now(); requests = 0 }
    if (++requests > 60 || running) return reply(429, { status: 'BUSY' })
    let raw = ''
    try {
      for await (const chunk of req) {
        raw += chunk.toString()
        if (Buffer.byteLength(raw) > 20000) return reply(413, { status: 'REJECTED' })
      }
      const input = JSON.parse(raw)
      if (!/^kentech:\d+$/.test(input.id) || !/^[1-9]\d{7,14}$/.test(input.recipient) || typeof input.text !== 'string' || !input.text.length || input.text.length > 3900) return reply(400, { status: 'REJECTED' })
      if (running) return reply(429, { status: 'BUSY' })
      const file = path.join(directory, crypto.createHash('sha256').update(input.id).digest('hex') + '.json')
      const hash = crypto.createHash('sha256').update(input.recipient + '\n' + input.text).digest('hex')
      if (fs.existsSync(file)) {
        const receipt = JSON.parse(fs.readFileSync(file))
        if (receipt.hash !== hash) return reply(409, { status: 'REJECTED' })
        return reply(200, { status: receipt.status === 'SENT' ? 'SENT' : 'AMBIGUOUS' })
      }
      // No send attempt if client is disconnected. Safe for bounded caller retry.
      if (!client.user || typeof client.sendMessage !== 'function') return reply(503, { status: 'OFFLINE' })
      running = true
      save(file, { hash, status: 'SENDING' })
      try {
        const result = await client.sendMessage(input.recipient + '@s.whatsapp.net', { text: input.text })
        if (!result?.key?.id) { save(file, { hash, status: 'AMBIGUOUS' }); return reply(200, { status: 'AMBIGUOUS' }) }
        save(file, { hash, status: 'SENT', messageId: result.key.id })
        return reply(200, { status: 'SENT' })
      } catch (_) {
        // A failed promise may still have sent: do not perform another send.
        save(file, { hash, status: 'AMBIGUOUS' })
        return reply(200, { status: 'AMBIGUOUS' })
      } finally { running = false }
    } catch (_) { return reply(400, { status: 'REJECTED' }) }
  })
  server.listen(options.port ?? 8768, '127.0.0.1')
  return server
}

function install(options = {}) {
  let activeSocket
  let connected = false
  const adapter = {
    get user() { return connected ? activeSocket?.user : undefined },
    sendMessage(...args) { return activeSocket.sendMessage(...args) }
  }
  const loader = options.loader || require('./baileys')
  if (loader.loadBaileys.adminNotifications) return null
  const server = startBridge(adapter, options)
  if (!server) return null
  const original = loader.loadBaileys
  const wrapped = async function (...args) {
    const api = await original.apply(this, args)
    return { ...api, makeWASocket: (...socketOptions) => {
      // Only observe a socket that the existing application itself creates.
      const socket = api.makeWASocket(...socketOptions)
      activeSocket = socket
      connected = false
      socket.ev.on('connection.update', update => {
        if (activeSocket !== socket) return
        if (update.connection === 'open') connected = true
        if (update.connection === 'close') connected = false
      })
      return socket
    } }
  }
  wrapped.adminNotifications = true
  loader.loadBaileys = wrapped
  return server
}

module.exports = { startBridge, install }
