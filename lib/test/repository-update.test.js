const { test } = require('node:test')
const assert = require('node:assert/strict')
const { updateRepository } = require('../repository-update')

test('latest version does not install or restart another process', async () => {
  const sent = [], calls = []
  await updateRepository({ send: async text => sent.push(text) }, {
    processId: '14', run: async (...args) => { calls.push(args); return 'KENTECH_ALREADY_CURRENT' },
    schedule() { throw new Error('Unexpected restart') },
  })
  assert.equal(calls.length, 1)
  assert.match(sent.at(-1), /already has/)
})

test('successful update notifies before restarting only its PM2 ID', async () => {
  const sent = [], calls = []
  let restart
  await updateRepository({ send: async text => sent.push(text) }, {
    processId: '14', run: async (...args) => { calls.push(args); return 'KENTECH_UPDATED' },
    schedule: callback => { restart = callback },
  })
  assert.match(sent.at(-1), /restarting/)
  assert.equal(calls.length, 1)
  await restart()
  assert.deepEqual(calls[1][1], ['restart', '14'])
})

test('failed Git or dependency update does not restart', async () => {
  const sent = []
  await updateRepository({ send: async text => sent.push(text) }, {
    processId: '14', run: async () => { throw new Error('fetch unavailable') },
    schedule() { throw new Error('Unexpected restart') },
  })
  assert.match(sent.at(-1), /Update failed/)
})
