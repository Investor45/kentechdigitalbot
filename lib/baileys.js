let pending
async function loadBaileys() {
  if (!pending) {
    pending = import('baileys').then(api => ({
      ...api,
      makeWASocket: api.default,
      isJidUser: jid => Boolean(jid && (jid.endsWith('@s.whatsapp.net') || jid.endsWith('@lid'))),
    })).catch(error => { pending = undefined; throw error })
  }
  return pending
}
module.exports = { loadBaileys }
