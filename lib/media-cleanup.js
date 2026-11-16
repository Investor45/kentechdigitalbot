// Only disposable media in this bot's temp directory and converter scratch jobs.
// Never traverse media assets, sessions, databases, inboxes, or arbitrary paths.
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const MIN_AGE = 6 * 60 * 60 * 1000
const MEDIA = /\.(?:mp4|webm|mov|mkv|mp3|m4a|aac|ogg|opus|wav|jpg|jpeg|png|webp|gif)$/i
const activeJobs = new Set()
let sweeping
let timer

async function scan({ root = path.resolve(__dirname, '..'), temp = os.tmpdir(), now = Date.now(), remove = false } = {}) {
  const result = { files: 0, bytes: 0, errors: 0 }
  async function files(directory, accept) {
    try {
      // Refuse symlinked cleanup directories, even if the destination exists.
      if ((await fs.lstat(directory)).isSymbolicLink()) return
      if (await fs.realpath(directory) !== directory) return
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !accept(entry.name)) continue
        const file = path.join(directory, entry.name)
        try {
          const stat = await fs.lstat(file)
          if (!stat.isFile() || stat.nlink !== 1 || now - Math.max(stat.mtimeMs, stat.ctimeMs) < MIN_AGE) continue
          if (remove) await fs.unlink(file)
          result.files++; result.bytes += stat.size
        } catch (error) { if (error.code !== 'ENOENT') result.errors++ }
      }
    } catch (error) { if (error.code !== 'ENOENT') result.errors++ }
  }
  root = await fs.realpath(root)
  temp = await fs.realpath(temp)
  await files(path.join(root, 'temp'), name => MEDIA.test(name))
  try {
    for (const entry of await fs.readdir(temp, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^kentech-youtube-[A-Za-z0-9]{6}$/.test(entry.name)) continue
      const directory = path.join(temp, entry.name)
      if (activeJobs.has(directory)) continue
      await files(directory, name => name === 'input.mp4' || name === 'output.mp4')
      // Leave the tiny directory itself: another worker may have just opened it.
    }
  } catch (error) { if (error.code !== 'ENOENT') result.errors++ }
  try {
    const disk = await fs.statfs(root)
    result.diskFree = Number(disk.bavail) * Number(disk.bsize)
    const scratch = await fs.statfs(temp)
    result.tempFree = Number(scratch.bavail) * Number(scratch.bsize)
  } catch (_) { result.diskFree = null; result.tempFree = null }
  return result
}

function cleanup() {
  if (!sweeping) sweeping = scan({ remove: true }).finally(() => { sweeping = undefined })
  return sweeping
}
function install() {
  if (timer) return
  const sweep = () => cleanup().catch(() => console.warn('Temporary media cleanup unavailable'))
  sweep()
  timer = setInterval(sweep, 60 * 60 * 1000)
  timer.unref()
}
const size = bytes => bytes == null ? 'Unavailable' : `${(bytes / 1024 / 1024).toFixed(1)} MB`
function report(result, removed = false) {
  return `*KENTECH AI · MEDIA STORAGE*\n\n${removed ? 'Removed' : 'Safe to clear'}: ${result.files} temporary files (${size(result.bytes)})\nVPS disk free: ${size(result.diskFree)}\nTemporary filesystem free: ${size(result.tempFree)}\n\nOnly download media older than 6 hours is cleared. Active conversions and recent files are kept. Automatic cleanup runs hourly.${result.errors ? `\n⚠️ ${result.errors} cleanup checks failed; some files could not be checked or removed.` : ''}`
}
module.exports = { scan, cleanup, install, report, activeJobs, MIN_AGE }
