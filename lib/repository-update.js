const { execFile } = require('node:child_process')
const path = require('node:path')
let updating = false
function run(file, args, options = {}) {
  return new Promise((resolve, reject) => execFile(file, args,
    { timeout: 120000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, ...options },
    (error, stdout, stderr) => {
      if (error) {
        error.details = String(stderr || '').trim().slice(-600)
        reject(error)
      } else resolve(stdout)
    }))
}
async function updateRepository(message, dependencies = {}) {
  if (updating) return message.send('An update is already running. Please wait.')
  const execute = dependencies.run || run
  const directory = dependencies.directory || path.resolve(__dirname, '..')
  const processId = dependencies.processId ?? process.env.pm_id
  if (process.platform === 'win32' && !dependencies.run) return message.send('Run the GitHub installer to update this Windows deployment.')
  if (processId === undefined) return message.send('Start this bot with PM2 before using the update command.')
  updating = true
  try {
    await message.send('Checking KENTECH GitHub for updates. Your session and saved group settings will be preserved.')
    const output = await execute('bash', [path.join(directory, 'deploy/update.sh'), directory], { cwd: directory, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    if (output.includes('KENTECH_ALREADY_CURRENT')) return await message.send('Your bot already has the latest GitHub version.')
    if (!output.includes('KENTECH_UPDATED')) throw new Error('Update did not complete')
    await message.send([
      'Latest KENTECH features installed. The bot is restarting now.',
      '',
      'New and updated commands:',
      '• .features - view security and automation features',
      '• .autodownload save GROUP_GID - add a download group manually',
      '• .autodownload off GROUP_GID - remove a download group',
      '• .bulkstatus - generate bulk group-status commands',
      '• .disablebotdownloads - filter other bot downloads while exempting admins',
      '• .bug temp 1h / .bug permanent - protect a user account',
      '• .gstatus - post replied text, photos or videos to group status',
    ].join('\n'))
    const restart = () => execute(path.join(directory, 'node_modules/.bin/pm2'), ['restart', String(processId)], { cwd: directory })
      .catch(() => { updating = false; message.send('The update finished, but restart failed. Run pm2 restart for this bot.').catch(() => {}) })
    if (dependencies.schedule) dependencies.schedule(restart)
    else setTimeout(restart, 1500)
  } catch (error) {
    const reason = String(error.details || error.message || 'unknown failure')
      .replace(/[\r\n]+/g, ' ')
      .replace(/(KTECH_[A-Za-z0-9_-]+)/g, 'KTECH_[redacted]')
      .slice(0, 300)
    await message.send(`Update failed; the bot was not restarted. Reason: ${reason}`)
    process.stderr.write(`[kentech-update] ${reason}\n`)
  } finally {
    updating = false
  }
}
module.exports = { updateRepository }
