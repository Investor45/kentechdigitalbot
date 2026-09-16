const { execFile } = require('node:child_process')
const path = require('node:path')
let updating = false
function run(file, args, options = {}) {
  return new Promise((resolve, reject) => execFile(file, args,
    { timeout: 600000, maxBuffer: 4 * 1024 * 1024, ...options },
    (error, stdout) => error ? reject(error) : resolve(stdout)))
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
    const output = await execute('bash', [path.join(directory, 'deploy/update.sh'), directory], { cwd: directory })
    if (output.includes('KENTECH_ALREADY_CURRENT')) return await message.send('Your bot already has the latest GitHub version.')
    if (!output.includes('KENTECH_UPDATED')) throw new Error('Update did not complete')
    await message.send('Latest KENTECH features installed. The bot is restarting now.')
    const restart = () => execute(path.join(directory, 'node_modules/.bin/pm2'), ['restart', String(processId)], { cwd: directory })
      .catch(() => { updating = false; message.send('The update finished, but restart failed. Run pm2 restart for this bot.').catch(() => {}) })
    if (dependencies.schedule) dependencies.schedule(restart)
    else setTimeout(restart, 1500)
  } catch (error) {
    await message.send('Update failed; the bot was not restarted. Check the server update log. Local edits are kept in Git stash backups when an update begins.')
    process.stderr.write(`[kentech-update] ${error.message}\n`)
  } finally {
    updating = false
  }
}
module.exports = { updateRepository }
