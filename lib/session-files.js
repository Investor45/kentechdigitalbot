const fs = require('node:fs/promises')
const path = require('node:path')
// Contact/device mappings are rebuildable caches, not authentication keys.
// Initial history sync can create tens of thousands of these files.
const AUTH_FILE = /^(?:creds|(?:pre-key|session|sender-key|sender-key-memory|app-state-sync-key|identity-key|tctoken)-.+)\.json$/

async function readSessionFiles(directory, { attempts = 40, pause = 250 } = {}) {
  let previous
  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const names = (await fs.readdir(directory)).filter(name => AUTH_FILE.test(name)).sort()
      const files = {}
      const contents = []
      for (const name of names) {
        const text = await fs.readFile(path.join(directory, name), 'utf8')
        files[name] = JSON.parse(text)
        contents.push([name, text])
      }
      if (!files['creds.json']) throw new Error('Session credentials are missing')
      const snapshot = JSON.stringify(contents)
      if (snapshot === previous) return files
      previous = snapshot
    } catch (error) {
      previous = undefined
      lastError = error
    }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, pause))
  }
  throw new Error('Session files did not finish saving', { cause: lastError })
}

module.exports = { readSessionFiles }
