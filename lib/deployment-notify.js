const fs = require('node:fs')
const path = require('node:path')

const ADMIN_JID = '237670217260@s.whatsapp.net'

function phoneFromJid(value) {
  const match = String(value || '').match(/^(\d+)(?::\d+)?@s\.whatsapp\.net$/)
  return match ? match[1] : ''
}

function connectedPhone(client) {
  return phoneFromJid(client?.user?.id || client?.user?.jid || client?.user?.phone)
}

async function notifyDeployment(client, { botName, markerDirectory }) {
  const marker = path.join(markerDirectory, '.deployment-admin-notified')
  if (fs.existsSync(marker)) return false
  const phone = connectedPhone(client)
  if (!phone || typeof client?.sendMessage !== 'function') return false
  const text = [
    '*KENTECH BOT DEPLOYED*',
    '',
    `Bot name: ${botName || 'KENTECH AI'}`,
    `WhatsApp number: ${phone}`,
    'Status: online and ready',
  ].join('\n')
  await client.sendMessage(ADMIN_JID, { text })
  fs.writeFileSync(marker, `${new Date().toISOString()}\n`, { mode: 0o600, flag: 'wx' })
  return true
}

module.exports = { ADMIN_JID, connectedPhone, notifyDeployment }
