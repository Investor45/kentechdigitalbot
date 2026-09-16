const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { createHash } = require('node:crypto')

// All local bot copies share this receipt store, including after a restart.
function claimStatusCommand(message, directory = path.join(os.homedir(), '.kentech-status-claims')) {
  const key = message.message?.key || message.data?.key || message.key || {}
  const account = message.client?.user?.id || message.client?.user?.jid
  if (!key.id || !account) return true
  const owner = String(account).replace(/:\d+(?=@)/, '')
  const digest = createHash('sha256').update(JSON.stringify([owner, key.remoteJid || message.jid, key.id])).digest('hex')
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  try {
    fs.writeFileSync(path.join(directory, digest), '', { flag: 'wx', mode: 0o600 })
    return true
  } catch (error) {
    if (error.code === 'EEXIST') return false
    throw error
  }
}

module.exports = { claimStatusCommand }
