const fs = require('node:fs')
const path = require('node:path')

const NAME = /^[A-Za-z][A-Za-z0-9_-]{1,39}$/
function readInstance(root) {
  const file = path.join(root, '.kentech-instance.json')
  if (!fs.existsSync(file)) return null // Existing installations remain opt-in.
  const instance = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!NAME.test(instance.name) || !/^[a-f0-9-]{36}$/.test(instance.id) ||
      fs.realpathSync(root) !== instance.directory) throw new Error('Invalid instance ownership marker')
  return instance
}

function configure(root) {
  const instance = readInstance(root)
  if (!instance) return null
  const values = require('dotenv').parse(fs.readFileSync(path.join(root, 'config.env')))
  if (values.BOT_NAME !== instance.name ||
      (values.BOT_INSTANCE_ID !== instance.id && values.INSTANCE_ID !== instance.id) || values.DATABASE_URL) {
    throw new Error('Managed instance configuration does not match its private database and identity')
  }
  // PM2 can retain another deployment's environment. A managed config is authoritative.
  for (const key of Object.keys(process.env)) {
    if (/^[A-Z][A-Z0-9_]*$/.test(key) && !['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'TERM', 'TMPDIR', 'SYSTEMROOT', 'WINDIR'].includes(key)) {
      if (key in require('dotenv').parse(fs.readFileSync(path.join(root, 'config.env.example'))) ||
          ['SESSION_ID', 'DATABASE_URL', 'BOT_NAME', 'SUDO', 'INSTANCE_ID', 'BOT_INSTANCE_ID', 'FORCE_LOGOUT'].includes(key)) delete process.env[key]
    }
  }
  Object.assign(process.env, values)
  delete process.env.DATABASE_URL
  return instance
}

function lock(root) {
  if (!readInstance(root)) return
  const file = path.join(root, '.kentech-runtime.lock')
  // Never guess whether an existing lock is stale: inspect ownership offline.
  const fd = fs.openSync(file, 'wx', 0o600)
  fs.writeFileSync(fd, String(process.pid))
  fs.closeSync(fd)
  process.once('exit', () => { try { fs.unlinkSync(file) } catch (_) {} })
}

module.exports = { NAME, readInstance, configure, lock }
