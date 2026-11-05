// Keep status receipts in the author's original WhatsApp address namespace.
// Ordinary chat receipts still use the client's existing resolver and queue.
const STATUS = 'status@broadcast'
const DAY = 24 * 60 * 60
const viewers = new WeakMap()
function healthReporter() {
  const fs = require('node:fs'), path = require('node:path')
  const file = path.join(process.cwd(), 'status-viewer-health.json')
  let latest, timer
  function flush() {
    timer = undefined
    try {
      fs.writeFileSync(file + '.tmp', JSON.stringify({ installed: true, ...latest, at: new Date().toISOString() }), { mode: 0o600 })
      fs.renameSync(file + '.tmp', file)
    } catch (_) { /* Monitoring must never interrupt WhatsApp processing. */ }
  }
  return value => {
    const first = !latest
    latest = value
    if (first) flush()
    else if (!timer) { timer = setTimeout(flush, 5000); timer.unref() }
  }
}
const normalize = jid => String(jid || '').replace(/:\d+(?=@)/, '')
const author = jid => /^\d+@(s\.whatsapp\.net|lid)$/.test(normalize(jid))

function attach(socket, options = {}) {
  if (viewers.has(socket)) return socket
  const now = options.now || (() => Date.now())
  const seen = new Map()
  const stats = { connected: false, received: 0, viewed: 0, failed: 0 }
  const report = () => {
    // Counts only: never persist status contents, authors, or session data.
    if (options.report) { try { options.report({ ...stats }) } catch (_) {} }
  }
  const process = socket.ev.process.bind(socket.ev)
  if (typeof socket.ev.on === 'function') socket.ev.on('connection.update', update => {
    if (update.connection === 'open' || update.connection === 'close') {
      stats.connected = update.connection === 'open'
      report()
    }
  })
  socket.ev.process = callback => process(async events => {
    const upsert = events['messages.upsert']
    if (!upsert || !['notify', 'append'].includes(upsert.type)) return callback(events)
    const messages = [], statuses = []
    for (const raw of upsert.messages || []) {
      if (raw.key?.remoteJid !== STATUS) { messages.push(raw); continue }
      const participant = raw.key.participant || raw.participant
      const timestamp = Number(raw.messageTimestamp)
      if (!raw.key.id || !author(participant) || !raw.message || raw.key.fromMe ||
          !Number.isFinite(timestamp) || timestamp < now() / 1000 - DAY || timestamp > now() / 1000 + 300) continue
      const key = normalize(participant) + ':' + raw.key.id
      if (seen.has(key)) continue
      seen.set(key, now())
      while (seen.size > 2048) seen.delete(seen.keys().next().value)
      statuses.push(raw)
      stats.received++
    }
    if (statuses.length) report()
    // Preserve append semantics for chats; only fresh statuses become notify.
    if (upsert.type === 'append') {
      await callback({ ...events, 'messages.upsert': { ...upsert, messages } })
      if (statuses.length) await callback({ 'messages.upsert': { ...upsert, type: 'notify', messages: statuses } })
    } else await callback({ ...events, 'messages.upsert': { ...upsert, messages: [...messages, ...statuses] } })
  })
  viewers.set(socket, { stats, report })
  report()
  return socket
}

function installClient(Client) {
  if (Client.sessions && typeof Client.sessions === 'object') {
    for (const session of Object.values(Client.sessions)) installClient(session)
    return
  }
  const prototype = typeof Client === 'function' ? Client.prototype : Object.getPrototypeOf(Client)
  const original = prototype._handleRead
  if (typeof original !== 'function') throw Error('Status viewer requires the client receipt handler')
  if (original.kentechStatusViewer) return
  async function read(task, ...args) {
    if (task.chat !== STATUS) return original.call(this, task, ...args)
    const participant = normalize(task.participant)
    if (!author(participant) || !Array.isArray(task.ids) || !task.ids.length ||
        !task.ids.every(id => typeof id === 'string' && id.length > 0)) throw Error('Invalid status receipt')
    const viewer = viewers.get(this.session)
    try {
      // Explicit auto-view uses visible read receipts; SEND_READ for chats is separate.
      const result = await this.session.sendReceipt(STATUS, participant, task.ids, 'read')
      if (viewer) { viewer.stats.viewed += task.ids.length; viewer.report() }
      return result
    } catch (error) {
      if (viewer) { viewer.stats.failed++; viewer.report() }
      throw error // Retain the existing queue's retry and error handling.
    }
  }
  read.kentechStatusViewer = true
  prototype._handleRead = read
}

function install() {
  const loader = require('./baileys')
  if (loader.loadBaileys.kentechStatusViewer) return
  const original = loader.loadBaileys
  async function load(...args) {
    const api = await original.apply(this, args)
    const makeWASocket = (...options) => attach(api.makeWASocket(...options), { report: healthReporter() })
    return { ...api, default: makeWASocket, makeWASocket }
  }
  load.kentechStatusViewer = true
  loader.loadBaileys = load
}

module.exports = { attach, install, installClient }
