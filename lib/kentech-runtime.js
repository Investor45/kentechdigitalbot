// The upstream startup update check calls reset(HARD) even when updates are off.
// Preserve the deployed custom files while retaining the rest of its Git API.
function preserveFiles(git) {
  const reset = git.reset
  git.reset = function (mode, ...args) {
    if (String(mode).replace(/^--/, '').toLowerCase() === 'hard') {
      const callback = args.find(value => typeof value === 'function')
      if (callback) queueMicrotask(() => callback(null))
      return this
    }
    return reset.call(this, mode, ...args)
  }
  return git
}

function install() {
  const git = require('simple-git')
  if (git.simpleGit.kentechPreservesFiles) return
  const original = git.simpleGit
  const wrapped = (...args) => preserveFiles(original(...args))
  wrapped.kentechPreservesFiles = true
  git.simpleGit = wrapped
}

module.exports = { install, preserveFiles }
