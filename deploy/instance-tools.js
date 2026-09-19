const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { NAME, readInstance } = require('../lib/instance')

function setValues(text, values) {
  const seen = new Set()
  const lines = text.split(/\r?\n/).filter(line => {
    const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1]
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return !Object.hasOwn(values, key)
  })
  for (const [key, value] of Object.entries(values)) {
    if (/[\r\n"\\]/.test(value)) throw new Error('Unsupported configuration characters')
    lines.push(`${key}="${value}"`)
  }
  return lines.join('\n') + '\n'
}

function selectProcess(processes, instance) {
  const matches = processes.filter(p => p.name === instance.name || p.pm2_env?.pm_cwd === instance.directory)
  if (matches.length > 1) throw new Error('Duplicate PM2 identity or directory; ownership review required')
  const p = matches[0]
  if (p && (p.name !== instance.name || p.pm2_env?.pm_cwd !== instance.directory ||
      p.pm2_env?.KENTECH_INSTANCE_ID !== instance.id &&
      p.pm2_env?.BOT_INSTANCE_ID !== instance.id)) throw new Error('PM2 ownership mismatch; no process was modified')
  return p
}

async function deploy(root) {
  const instance = readInstance(root)
  if (!instance) throw new Error('Unmanaged directory: create an isolated instance with install.sh')
  require('../lib/instance').configure(root)
  const lock = path.join(root, '.kentech-deploy.lock')
  const fd = fs.openSync(lock, 'wx', 0o600)
  const pm2 = require('pm2')
  const call = (method, ...args) => new Promise((resolve, reject) => pm2[method](...args, (error, result) => error ? reject(error) : resolve(result)))
  try {
    await call('connect')
    const processes = await call('list')
    const selected = selectProcess(processes, instance)
    const backup = path.join(root, '.deployment-backups', String(Date.now()))
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 })
    // This snapshot contains environment secrets and must never be printed.
    fs.writeFileSync(path.join(backup, 'pm2.json'), JSON.stringify(processes), { mode: 0o600 })
    fs.copyFileSync(path.join(root, 'config.env'), path.join(backup, 'config.env'))
    fs.chmodSync(path.join(backup, 'config.env'), 0o600)
    if (selected) await call('restart', selected.pm_id)
    else await call('start', {
      name: instance.name, cwd: root, script: path.join(root, 'index.js'),
      instances: 1, exec_mode: 'fork', autorestart: false,
      env: { KENTECH_INSTANCE_ID: instance.id, BOT_INSTANCE_ID: instance.id },
    })
    selectProcess(await call('list'), instance)
    await call('dump')
    console.log('Exactly one owned PM2 entry saved. WhatsApp command acceptance remains required.')
  } finally {
    pm2.disconnect()
    fs.closeSync(fd)
    fs.unlinkSync(lock)
  }
}

async function main() {
  const [action, directory, name] = process.argv.slice(2)
  const root = fs.realpathSync(directory || process.cwd())
  if (action === 'init') {
    if (!NAME.test(name)) throw new Error('Unsafe instance name')
    const marker = path.join(root, '.kentech-instance.json')
    const instance = { id: crypto.randomUUID(), name, directory: root }
    fs.writeFileSync(marker, JSON.stringify(instance), { flag: 'wx', mode: 0o600 })
    const template = fs.readFileSync(path.join(root, 'config.env.example'), 'utf8')
    // Never copy another checkout's real configuration or database.
    fs.writeFileSync(path.join(root, 'config.env'), setValues(template, {
      BOT_NAME: name, BOT_INSTANCE_ID: instance.id, INSTANCE_ID: instance.id, DATABASE_URL: '', SESSION_ID: '', SUDO: '',
    }), { flag: 'wx', mode: 0o600 })
  } else if (action === 'configure') {
    const instance = readInstance(root)
    if (!instance) throw new Error('Unmanaged instance')
    let input = ''
    for await (const chunk of process.stdin) input += chunk
    const values = JSON.parse(input)
    const file = path.join(root, 'config.env')
    const previous = fs.readFileSync(file, 'utf8')
    const old = require('dotenv').parse(previous)
    if (old.SESSION_ID && old.SESSION_ID !== values.SESSION_ID) throw new Error('Session replacement requires a new isolated instance; existing authentication preserved')
    if (!require('../lib/short-session').SHORT_SESSION.test(values.SESSION_ID) && !require('../lib/session-bundle').decodeSession(values.SESSION_ID)) throw new Error('Unsupported session')
    const backup = path.join(root, '.deployment-backups', String(Date.now()))
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 })
    fs.writeFileSync(path.join(backup, 'config.env'), previous, { mode: 0o600 })
    fs.writeFileSync(file + '.tmp', setValues(previous, { ...values, BOT_NAME: instance.name, BOT_INSTANCE_ID: instance.id, INSTANCE_ID: instance.id, DATABASE_URL: '' }), { mode: 0o600 })
    fs.renameSync(file + '.tmp', file)
    fs.chmodSync(file, 0o600)
  } else if (action === 'deploy') await deploy(root)
  else throw new Error('Unknown instance action')
}
if (require.main === module) main().catch(() => { console.error('Instance operation refused or failed; check ownership, configuration, and PM2 availability. No credentials are displayed.'); process.exitCode = 1 })
module.exports = { setValues, selectProcess }
