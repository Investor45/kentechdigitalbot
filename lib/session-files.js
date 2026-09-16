const fs = require('node:fs/promises')
const path = require('node:path')

async function readSessionFiles(directory, { attempts = 40, pause = 250 } = {}) {
  let previous
  let lastError
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const names = (await fs.readdir(directory)).filter(name => name.endsWith('.json')).sort()
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
