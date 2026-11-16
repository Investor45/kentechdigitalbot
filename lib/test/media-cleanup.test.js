const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { scan, report, activeJobs, MIN_AGE } = require('../media-cleanup')

async function fixture(t) {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'media-cleanup-test-'))
  t.after(() => fs.rm(base, { recursive: true, force: true }))
  const root = path.join(base, 'bot'), temp = path.join(base, 'scratch')
  await fs.mkdir(path.join(root, 'temp'), { recursive: true }); await fs.mkdir(temp)
  const now = Date.now() + MIN_AGE + 10000
  async function put(name, content = 'video') {
    const file = path.join(base, name)
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content)
    return file
  }
  return { base, root, temp, now, put }
}

test('preview does not delete; cleanup removes only old disposable media', async t => {
  const f = await fixture(t)
  const old = await f.put('bot/temp/download.mp4')
  await f.put('scratch/kentech-youtube-Ab12Cd/input.mp4')
  await f.put('scratch/kentech-youtube-Ab12Cd/output.mp4')
  const protectedNames = ['bot/config.env', 'bot/temp/session.json', 'bot/temp/state.db', 'bot/media/welcome.mp4', 'bot/temp/nested/keep.mp4', 'scratch/kentech-session-Ab12Cd/input.mp4', 'scratch/kentech-youtube-Ab12Cd/creds.json', 'scratch/other.mp4']
  for (const name of protectedNames) await f.put(name)
  const recent = await f.put('bot/temp/current.mp4')
  await fs.utimes(recent, new Date(f.now), new Date(f.now))
  const preview = await scan(f)
  assert.equal(preview.files, 3); assert.equal(preview.bytes, 15)
  assert.ok(await fs.stat(old))
  const result = await scan({ ...f, remove: true })
  assert.equal(result.files, 3); assert.equal(result.errors, 0)
  await assert.rejects(fs.stat(old), { code: 'ENOENT' })
  for (const name of protectedNames) assert.ok(await fs.stat(path.join(f.base, name)))
  assert.ok(await fs.stat(recent))
  assert.equal((await scan({ ...f, remove: true })).files, 0)
})

test('active converter jobs survive cleanup even when their files are old', async t => {
  const f = await fixture(t)
  const file = await f.put('scratch/kentech-youtube-Ab12Cd/input.mp4')
  const job = await fs.realpath(path.dirname(file))
  activeJobs.add(job); t.after(() => activeJobs.delete(job))
  assert.equal((await scan({ ...f, remove: true })).files, 0)
  assert.ok(await fs.stat(file))
})

test('symlinks and hardlinks cannot redirect cleanup to customer data', async t => {
  const f = await fixture(t)
  const source = await f.put('protected/input.mp4')
  await fs.link(source, path.join(f.root, 'temp', 'linked.mp4'))
  try {
    await fs.symlink(source, path.join(f.root, 'temp', 'shortcut.mp4'))
    await fs.symlink(path.dirname(source), path.join(f.temp, 'kentech-youtube-Ab12Cd'), 'dir')
  } catch (error) { if (error.code !== 'EPERM') throw error }
  assert.equal((await scan({ ...f, remove: true })).files, 0)
  assert.ok(await fs.stat(source))
})

test('symlinked bot temp directory is never traversed', async t => {
  const f = await fixture(t)
  const source = await f.put('protected/input.mp4')
  await fs.rmdir(path.join(f.root, 'temp'))
  try { await fs.symlink(path.dirname(source), path.join(f.root, 'temp'), 'dir') }
  catch (error) { if (error.code === 'EPERM') return t.skip('Symlink privilege unavailable'); throw error }
  assert.equal((await scan({ ...f, remove: true })).files, 0)
  assert.ok(await fs.stat(source))
})

test('empty or missing media directories are safe and storage figures are available', async t => {
  const f = await fixture(t)
  await fs.rmdir(path.join(f.root, 'temp'))
  const result = await scan(f)
  assert.equal(result.files, 0); assert.equal(result.errors, 0)
  assert.ok(result.diskFree > 0); assert.ok(result.tempFree > 0)
  assert.match(report(result), /Safe to clear: 0/)
  assert.match(report({ ...result, errors: 1 }, true), /1 cleanup checks failed/)
})

test('commands are owner/sudo only, use configured prefix matching, and handle failures', async () => {
  const commands = []; const replies = []; let fail = false
  const source = await fs.readFile(path.join(__dirname, '../../plugins/media-storage.js'), 'utf8')
  vm.runInNewContext(source, { require(name) {
    if (name === '../lib/') return { bot: (options, handler) => commands.push({ options, handler }) }
    if (name === '../lib/media-cleanup') return {
      scan: async () => { if (fail) throw Error('private path'); return { files: 2, bytes: 20 } },
      cleanup: async () => { if (fail) throw Error('private path'); return { files: 2, bytes: 20 } }, report,
    }
    throw Error(name)
  } })
  assert.equal(commands.length, 2)
  for (const command of commands) {
    assert.equal(command.options.fromMe, true)
    assert.ok(command.options.pattern.endsWith('$'))
    await command.handler({ send: async text => replies.push(text) })
  }
  assert.match(replies[0], /Removed: 2/); assert.match(replies[1], /Safe to clear: 2/)
  fail = true
  for (const command of commands) await command.handler({ send: async text => replies.push(text) })
  assert.ok(replies.slice(2).every(text => /unavailable/.test(text) && !text.includes('private path')))
})

test('converter removes scratch files and releases active protection on success and failure', async () => {
  const source = await fs.readFile(path.join(__dirname, '../whatsapp-video.js'), 'utf8')
  for (const fail of [false, true]) {
    const jobs = new Set(); let removed = 0
    const module = { exports: {} }
    vm.runInNewContext(source, { module, Buffer, require(name) {
      if (name === 'fs/promises') return {
        mkdtemp: async () => '/tmp/kentech-youtube-Ab12Cd', realpath: async p => p,
        writeFile: async () => assert.equal(jobs.size, 1),
        rm: async () => { removed++; assert.equal(jobs.size, 1) },
      }
      if (name === './media-cleanup') return { activeJobs: jobs }
      if (name === 'child_process') return { execFile() {} }
      if (name === 'util') return { promisify: () => async () => {
        if (fail) throw Error('probe failed')
        return { stdout: JSON.stringify({ streams: [{ codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p' }, { codec_type: 'audio', codec_name: 'aac' }] }) }
      } }
      return require(name)
    } })
    const content = Buffer.from('video')
    if (fail) await assert.rejects(module.exports.prepareVideo(content), /probe failed/)
    else assert.equal(await module.exports.prepareVideo(content), content)
    assert.equal(removed, 1); assert.equal(jobs.size, 0)
  }
})
