const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')
const { storeSession } = require('../lib/short-session')
const { decodeSession } = require('../lib/session-bundle')
const { readSessionFiles } = require('../lib/session-files')
const { normalizePhoneNumber, sessionBelongsToPhone } = require('../lib/session-ownership')

const PORT = Number(process.env.SESSION_PORT || 3100)
const TTL = 10 * 60 * 1000
const MAX_ACTIVE = 20
const PAIRING_DELAY = 6000
const jobs = new Map()
const phoneJobs = new Map()
const requests = new Map()
const STORE = process.env.SESSION_STORE_DIR || path.join(os.homedir(), '.kentech-session-vault')

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

function redact(value) {
  return String(value || '')
    .replace(/KENTECH_[A-Za-z0-9_-]+/g, '[session-redacted]')
    .replace(/(?:auth|creds|noise|identity|private|secret)[^\s,]*/gi, '[private-redacted]')
}

function disconnectInfo(update) {
  const error = update?.lastDisconnect?.error
  const status = error?.output?.statusCode || error?.data?.statusCode || 'unknown'
  return {
    status,
    reason: redact(error?.output?.payload?.error || error?.data?.reason || update?.lastDisconnect?.reason || 'unknown'),
    message: redact(error?.message || 'unknown'),
  }
}

function logDisconnect(info) {
  process.stderr.write(`[session-generator] pairing socket closed status=${info.status} reason=${info.reason} message=${info.message}\n`)
}

function maskPhone(value) {
  const digits = normalizePhoneNumber(value)
  return digits ? `******${digits.slice(-4)}` : '[unavailable]'
}

async function createPairing(job, phone) {
  try {
    const api = await loadWhatsApp()
    const auth = await api.useMultiFileAuthState(job.directory)
    const { version } = await api.fetchLatestBaileysVersion()
    let completionStarted = false
    let restartScheduled = false
    let restartAttempts = 0

    const completeLogin = async socket => {
      if (completionStarted || job.socket !== socket) return
      completionStarted = true
      job.state = 'finalizing'
      // Let the authenticated socket finish its initial app-state sync before
      // sending to the account's own inbox.
      await api.delay(5000)
      await auth.saveCreds()
      const files = await readSessionFiles(job.directory)
      const creds = files?.['creds.json']
      if (!creds || creds.registered !== true || !creds.me?.id) {
        throw new Error('Pairing completed without a complete registered credentials file')
      }
      const pairedPhone = normalizePhoneNumber(socket.user?.id || creds.me.id || '')
      const expectedPhone = normalizePhoneNumber(phone)
      if (!pairedPhone || pairedPhone !== expectedPhone || !sessionBelongsToPhone(creds, phone)) {
        job.state = 'failed'
        job.error = `The paired WhatsApp account does not match the requested number (requested ${maskPhone(expectedPhone)}, detected ${maskPhone(pairedPhone)}). Generate a new code for this phone.`
        if (phoneJobs.get(phone) === job.id) phoneJobs.delete(phone)
        try { socket.ws?.close() } catch (_) {}
        fs.rmSync(job.directory, { recursive: true, force: true })
        return
      }
      job.sessionId = await storeSession(STORE, files)
      const selfJid = api.jidNormalizedUser(socket.user?.id || `${phone}@s.whatsapp.net`)
      const message = job.sessionId.length <= 55000
        ? { text: `KENTECH AI login successful.\n\nYour SESSION_ID is:\n\n${job.sessionId}\n\nKeep this message private.` }
        : {
            document: Buffer.from(job.sessionId),
            mimetype: 'text/plain',
            fileName: 'KENTECH_SESSION_ID.txt',
            caption: 'KENTECH AI login successful. Your private SESSION_ID is attached.',
          }
      let messageError
      for (let attempt = 0; attempt < 2 && !job.messageSent; attempt += 1) {
        try {
          await Promise.race([
            socket.sendMessage(selfJid, message),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Message delivery timed out')), 20000)),
          ])
          job.messageSent = true
        } catch (error) {
          messageError = error
          if (attempt === 0) await api.delay(1500)
        }
      }
      if (!job.messageSent) {
        logDisconnect({ status: 'message-delivery', reason: 'sendMessage failed', message: redact(messageError?.message) })
      } else {
        // Keep the temporary socket alive long enough for the sent message and
        // self-chat app-state update to reach the primary phone.
        await api.delay(8000)
      }
      job.state = 'complete'
      if (phoneJobs.get(phone) === job.id) phoneJobs.delete(phone)
      job.socket = null
      try { socket.ws?.close() } catch (_) {}
      fs.rmSync(job.directory, { recursive: true, force: true })
    }

    const connect = () => {
      if (job.state === 'failed' || job.state === 'complete') return
      const socket = api.makeWASocket({
        auth: auth.state,
        version,
        printQRInTerminal: false,
        logger: { trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {}, child() { return this } },
        // A canonical browser tuple avoids WhatsApp rejecting the pairing IQ.
        browser: ['Ubuntu', 'Chrome', '22.04.4'],
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
      })
      job.socket = socket
      socket.ev.on('creds.update', auth.saveCreds)

      const restart = async info => {
        if (restartScheduled || completionStarted || job.socket !== socket) return
        if (restartAttempts >= 3) {
          job.state = 'failed'
          job.error = 'WhatsApp linked the account but could not finish reconnecting. Please create a new request.'
          if (phoneJobs.get(phone) === job.id) phoneJobs.delete(phone)
          logDisconnect(info)
          return
        }
        restartScheduled = true
        restartAttempts += 1
        job.state = 'connecting'
        await auth.saveCreds()
        try { socket.ws?.close() } catch (_) {}
        await api.delay(1500)
        restartScheduled = false
        if (!completionStarted && job.state !== 'failed') connect()
      }

      socket.ev.on('connection.update', async update => {
        if (job.socket !== socket || completionStarted) return
        if (update.connection === 'open' && auth.state.creds.registered) {
          return completeLogin(socket).catch(error => {
            job.state = 'failed'
            job.error = 'WhatsApp linked, but the session could not finish saving. Please generate a new code.'
            if (phoneJobs.get(phone) === job.id) phoneJobs.delete(phone)
            logDisconnect({ status: 'finalizing', reason: error.name, message: redact(error.message) })
            try { socket.ws?.close() } catch (_) {}
          })
        }
        if (update.isNewLogin) {
          await auth.saveCreds()
          // Keep the authenticated socket alive while WhatsApp finishes its
          // initial sync. The open event finalizes and stores the session.
          return
        }
        if (update.connection === 'close') {
          const info = disconnectInfo(update)
          if (Number(info.status) === 515) return restart(info)
          job.state = 'failed'
          job.error = `WhatsApp closed the pairing request (status ${info.status}). Please create a new code.`
          if (phoneJobs.get(phone) === job.id) phoneJobs.delete(phone)
          logDisconnect(info)
        }
      })
      return socket
    }

    const socket = connect()
    // WhatsApp returns HTTP 428 when this is sent before its socket handshake.
    await api.delay(PAIRING_DELAY)
    if (job.state === 'failed' || job.socket !== socket) return
    job.code = await socket.requestPairingCode(phone)
    job.notificationRequested = true
    job.state = 'pairing'
  } catch (error) {
    job.state = 'failed'
    if (phoneJobs.get(phone) === job.id) phoneJobs.delete(phone)
    const info = { status: error?.output?.statusCode || error?.data?.statusCode || 'unknown', reason: error?.name || 'Error', message: redact(error?.message) }
    job.error = Number(info.status) === 428
      ? 'WhatsApp was not ready to issue a pairing code. Wait a moment and create one new request.'
      : 'Could not create a pairing code. Please try again.'
    logDisconnect(info)
  }
}

function removeJob(id) {
  const job = jobs.get(id)
  if (!job) return
  try { job.socket?.ws?.close() } catch (_) {}
  if (phoneJobs.get(job.phone) === id) phoneJobs.delete(job.phone)
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
  if (req.method === 'GET' && /^\/api\/session\/[a-f0-9]{64}$/.test(url.pathname)) {
    try {
      const record = JSON.parse(fs.readFileSync(path.join(STORE, url.pathname.split('/').pop() + '.json'), 'utf8'))
      return json(res, 200, record)
    } catch (_) { return json(res, 404, { error: 'Session not found' }) }
  }
  if (req.method === 'POST' && url.pathname === '/api/shorten') {
    if (!allowed(clientIp(req))) return json(res, 429, { error: 'Too many requests. Please wait.' })
    let body = ''
    req.on('data', chunk => { if ((body += chunk).length > 251000) req.destroy() })
    return req.on('end', async () => {
      try {
        const value = String(JSON.parse(body).sessionId || '').trim()
        const files = decodeSession(value)
        if (!files) throw new Error('Unsupported session')
        const sessionId = await storeSession(STORE, files)
        return json(res, 200, { sessionId })
      } catch (_) { return json(res, 400, { error: 'Paste the complete long KENTECH_ session ID.' }) }
    })
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
      if (!/^\d{10,15}$/.test(phone || '')) return json(res, 400, { error: 'Enter the full international WhatsApp number, including country code. Example: 237670217260.' })
      const existingId = phoneJobs.get(phone)
      if (existingId && jobs.has(existingId)) return json(res, 409, { error: 'A pairing request for this number is already active. Wait for it to finish before requesting another code.' })
      const id = crypto.randomBytes(18).toString('base64url')
      const job = { id, phone, createdAt: Date.now(), state: 'starting', directory: fs.mkdtempSync(path.join(os.tmpdir(), 'kentech-session-')) }
      jobs.set(id, job)
      phoneJobs.set(phone, id)
      createPairing(job, phone)
      return json(res, 202, { id })
    })
  }
  if (req.method === 'GET' && url.pathname.startsWith('/api/pair/')) {
    const job = jobs.get(url.pathname.split('/').pop())
    if (!job) return json(res, 404, { error: 'This pairing request expired.' })
    return json(res, 200, { state: job.state, code: job.code, sessionId: job.sessionId, messageSent: job.messageSent, notificationRequested: job.notificationRequested, error: job.error })
  }
  json(res, 404, { error: 'Not found' })
})

const HOST = process.env.SESSION_HOST || '127.0.0.1'
server.listen(PORT, HOST, () => process.stdout.write(`KENTECH AI session generator listening on ${HOST}:${PORT}\n`))
