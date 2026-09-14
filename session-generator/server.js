const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { encodeSession } = require('../lib/session-bundle')

const PORT = Number(process.env.SESSION_PORT || 3100)
const TTL = 10 * 60 * 1000
const MAX_ACTIVE = 20
const jobs = new Map()
const requests = new Map()

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'",
  })
  res.end(JSON.stringify(body))
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()
}

function allowed(ip) {
  const now = Date.now()
  const hits = (requests.get(ip) || []).filter(time => now - time < 60 * 60 * 1000)
  if (hits.length >= 10) return false
  hits.push(now)
  requests.set(ip, hits)
  return true
}

async function loadWhatsApp() {
  return require('../lib/baileys').loadBaileys()
}

async function createPairing(job, phone) {
  try {
    const api = await loadWhatsApp()
    const auth = await api.useMultiFileAuthState(job.directory)
    const socket = api.makeWASocket({
      auth: auth.state,
      printQRInTerminal: false,
      logger: { trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return this } },
      browser: ['KENTECH AI', 'Chrome', '1.0.0'],
    })
    job.socket = socket
    socket.ev.on('creds.update', auth.saveCreds)
    socket.ev.on('connection.update', async update => {
      if (update.connection === 'open') {
        await auth.saveCreds()
        const files = {}
        for (const name of fs.readdirSync(job.directory)) {
          if (name.endsWith('.json')) files[name] = JSON.parse(fs.readFileSync(path.join(job.directory, name), 'utf8'))
        }
        job.sessionId = encodeSession(files)
        job.state = 'complete'
        job.socket = null
        try { socket.ws?.close() } catch (_) {}
        fs.rmSync(job.directory, { recursive: true, force: true })
      } else if (update.connection === 'close' && job.state !== 'complete') {
        job.state = 'failed'
        job.error = 'WhatsApp closed the pairing request. Please create a new code.'
      }
    })
    job.code = await socket.requestPairingCode(phone)
    job.state = 'pairing'
  } catch (error) {
    job.state = 'failed'
    job.error = 'Could not create a pairing code. Please try again.'
    process.stderr.write(`[session-generator] ${error?.name || 'Error'}\n`)
  }
}

function removeJob(id) {
  const job = jobs.get(id)
  if (!job) return
  try { job.socket?.ws?.close() } catch (_) {}
  fs.rmSync(job.directory, { recursive: true, force: true })
  jobs.delete(id)
}

setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) if (now - job.createdAt > TTL) removeJob(id)
}, 60_000).unref()

const page = fs.readFileSync(path.join(__dirname, 'index.html'))
const script = fs.readFileSync(path.join(__dirname, 'app.js'))
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(page)
  }
  if (req.method === 'GET' && url.pathname === '/app.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' })
    return res.end(script)
  }
  if (req.method === 'POST' && url.pathname === '/api/pair') {
    if (jobs.size >= MAX_ACTIVE) return json(res, 503, { error: 'The generator is busy. Please try again shortly.' })
    const ip = clientIp(req)
    if (!allowed(ip)) return json(res, 429, { error: 'Too many requests. Please wait before trying again.' })
    let body = ''
    req.on('data', chunk => { if ((body += chunk).length > 1000) req.destroy() })
    return req.on('end', () => {
      let phone
      try { phone = String(JSON.parse(body).phone || '').replace(/\D/g, '') } catch (_) {}
      if (!/^\d{8,15}$/.test(phone || '')) return json(res, 400, { error: 'Enter your full number with country code using digits only.' })
      const id = crypto.randomBytes(18).toString('base64url')
      const job = { id, createdAt: Date.now(), state: 'starting', directory: fs.mkdtempSync(path.join(os.tmpdir(), 'kentech-session-')) }
      jobs.set(id, job)
      createPairing(job, phone)
      return json(res, 202, { id })
    })
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/pair/')) {
    const job = jobs.get(url.pathname.split('/').pop())
    if (!job) return json(res, 404, { error: 'This pairing request expired.' })
    return json(res, 200, { state: job.state, code: job.code, sessionId: job.sessionId, error: job.error })
  }
  json(res, 404, { error: 'Not found' })
})

server.listen(PORT, '127.0.0.1', () => process.stdout.write(`KENTECH AI session generator listening on 127.0.0.1:${PORT}\n`))
