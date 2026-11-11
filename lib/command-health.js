// Counts and queue health only: never persist message text, JIDs or credentials.
const fs = require('node:fs')
const path = require('node:path')
const activity = new WeakMap()
const watched = new WeakSet()
function watch(socket) {
  if (!socket || watched.has(socket) || typeof socket.ev?.on !== 'function') return
  watched.add(socket)
  const note = (field, count=1) => {
    const stats=activity.get(socket) || {}
    stats[field]=(stats[field] || 0)+count
    stats[field+'_at']=new Date().toISOString()
    activity.set(socket,stats)
  }
  socket.ws?.on?.('CB:message',()=>note('transport_messages'))
  socket.ev.on('messages.upsert', event=>{
    note('message_events');note('message_count',event.messages?.length || 0)
    const own=(event.messages || []).filter(raw=>raw.key?.fromMe)
    if(own.length)note('own_messages',own.length)
  })
  socket.ev.on('messaging-history.set',()=>note('history_events'))
}
function isPing(raw) {
  let body=raw?.message || {}
  for(let i=0;i<3;i++) {
    const wrapped=body.ephemeralMessage || body.viewOnceMessage || body.viewOnceMessageV2 || body.deviceSentMessage
    if(!wrapped?.message)break
    body=wrapped.message
  }
  return /^!ping(?:\s|$)/i.test(String(body.conversation || body.extendedTextMessage?.text || '').trim())
}
function record(socket, raw, type, handled=false) {
  if(!socket || !isPing(raw))return
  const stats=activity.get(socket) || {ping_received:0,ping_dispatched:0}
  if(handled)stats.ping_dispatched=(stats.ping_dispatched || 0)+1
  else {stats.ping_received=(stats.ping_received || 0)+1;stats.last_ping_event=type;stats.last_ping_own=raw.key?.fromMe===true;stats.last_ping_group=String(raw.key?.remoteJid || '').endsWith('@g.us')}
  stats.last_ping_at=new Date().toISOString()
  activity.set(socket,stats)
}
function observe(socket, upsert) {
  for(const raw of upsert?.messages || [])record(socket,raw,upsert.type)
}
function createMonitor(client, options = {}) {
  const now = options.now || Date.now
  const file = options.file || path.join(process.cwd(), 'command-health.json')
  let previous, stalledAt, recoveredAt = 0
  function sample() {
    watch(client.session)
    const queue = client.queue
    const connected = client.botState?.connected === true && client.session?.ws?.isOpen === true
    const pending = typeof queue?.length === 'function' ? queue.length() : 0
    const running = typeof queue?.running === 'function' ? queue.running() : 0
    const processed = client.metrics?.totalProcessed || 0
    const signature = `${connected}:${pending > 0 || running > 0}:${processed}:${!!queue?.paused}`
    if (previous !== signature) { previous = signature; stalledAt = now() }
    let recovery = null
    if (connected && pending > 0 && queue?.paused && running === 0 && now() - stalledAt >= 60000 && now() - recoveredAt >= 60000) {
      queue.resume(); recoveredAt = now(); stalledAt = now(); recovery = 'resumed_paused_reply_queue'
    }
    // In-flight media may be slow. Only a connected queue with no progress for
    // ten minutes is considered wedged. Never replay uncertain outbound tasks.
    if (connected && (pending > 0 || running > 0) && !queue?.paused && now() - stalledAt >= 600000) {
      recovery = 'restart_stalled_reply_queue'
    }
    let state = {}
    try { state = options.state ? options.state() : {} } catch (_) { state = { registry_unavailable: true } }
    const health = { connected, command_enabled: client.botState?.E === true,
      pending, running, paused: !!queue?.paused, processed,
      failed: client.metrics?.totalFailed || 0, event_buffering:client.session?.ev?.isBuffering?.() ?? null,
      ...state, ...(activity.get(client.session) || {}), recovery, at: new Date(now()).toISOString() }
    try { fs.writeFileSync(file + '.tmp', JSON.stringify(health), { mode: 0o600 }); fs.renameSync(file + '.tmp', file) } catch (_) {}
    if (recovery === 'restart_stalled_reply_queue') (options.restart || (() => process.exit(75)))()
    return health
  }
  return { sample }
}
function attach(client) {
  if (client.sessions && typeof client.sessions === 'object') {
    return Object.values(client.sessions).map(attach)
  }
  const monitor = createMonitor(client, { state: () => {
    const state = require('./config')[client.botState?.id]
    const commands=Object.values(state?.pammands || {})
    const ping=commands.find(c=>c.name==='ping' || String(c.pattern?.source || '').includes('ping'))
    const matches=ping?.pattern ? new RegExp(ping.pattern.source,ping.pattern.flags.replace('g','').replace('y','')).test('!ping') : false
    return { group_commands: Object.keys(state?.cammands || {}).length,
      private_commands: commands.length,ping_registered:!!ping,ping_active:!!ping?.active,ping_matches:matches,
      formatter_ready:!!require('./index').formatter?.n }
  } })
  const timer = setInterval(() => { try { monitor.sample() } catch (_) {} }, 15000)
  timer.unref()
  return monitor
}
module.exports = { createMonitor, attach, observe, record }
