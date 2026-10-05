const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { once } = require('node:events')
const { EventEmitter } = require('node:events')
const { startBridge } = require('../admin-notification-bridge')

test('localhost authentication, request validation, durable dedup and ambiguity', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kentech-bridge-test-'))
  let calls = 0
  const client = { user: { id: 'test' }, sendMessage: async (jid, content) => {
    calls++; assert.equal(jid, '237670217260@s.whatsapp.net')
    if (content.text === 'fail') throw new Error('PRIVATE ERROR')
    return { key: { id: 'message' } }
  } }
  const token = 'test'.repeat(12)
  let server = startBridge(client, { directory, token, port: 0 })
  await once(server, 'listening')
  const request = async (id, text = 'safe', auth = token, recipient = '237670217260') => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/internal/admin-notification`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + auth }, body: JSON.stringify({ id, text, recipient })
    })
    return { status: res.status, body: await res.json() }
  }
  try {
    assert.equal(server.address().address, '127.0.0.1')
    assert.equal((await request('kentech:1', 'safe', 'bad')).status, 401)
    assert.equal((await request('kentech:1', 'safe', token, '123@g.us')).status, 400)
    assert.equal((await request('kentech:1')).body.status, 'SENT')
    assert.equal((await request('kentech:1')).body.status, 'SENT')
    assert.equal(calls, 1)
    assert.equal((await request('kentech:1', 'changed')).status, 409)
    assert.equal((await request('kentech:2', 'fail')).body.status, 'AMBIGUOUS')
    assert.equal((await request('kentech:2', 'fail')).body.status, 'AMBIGUOUS')
    assert.equal(calls, 2)
    await new Promise(resolve => server.close(resolve))
    server = startBridge(client, { directory, token, port: 0 }); await once(server, 'listening')
    assert.equal((await request('kentech:1')).body.status, 'SENT')
    assert.equal((await request('kentech:2', 'fail')).body.status, 'AMBIGUOUS')
    assert.equal(calls, 2)
  } finally {
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true })
  }
})

test('integration observes existing sockets and waits for connection without creating a client', async () => {
  const { install } = require('../admin-notification-bridge')
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kentech-bridge-hook-test-'))
  let created = 0
  let sent = 0
  const loader = { loadBaileys: async () => ({ DisconnectReason: { loggedOut: 401 }, makeWASocket: () => {
    created++
    return { user: { id: 'existing' }, ev: new EventEmitter(), sendMessage: async () => { sent++; return { key: { id: 'message' } } } }
  } }) }
  const token = 'test'.repeat(12)
  const server = install({ loader, directory, token, port: 0 })
  await once(server, 'listening')
  const request = async id => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/internal/admin-notification`, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token },
      body: JSON.stringify({ id, recipient: '237670217260', text: 'test' })
    })
    return response.status
  }
  const health = async () => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/internal/admin-notification/health`, { headers: { Authorization: 'Bearer ' + token } })
    return (await response.json()).status
  }
  try {
    assert.equal(created, 0)
    assert.equal(await health(), 'CONNECTING')
    assert.equal(await request('kentech:1'), 503)
    const api = await loader.loadBaileys()
    const originalSocket = api.makeWASocket()
    assert.equal(created, 1)
    assert.equal(await request('kentech:1'), 503)
    originalSocket.ev.emit('connection.update', { connection: 'open' })
    assert.equal(await health(), 'CONNECTED')
    assert.equal(await request('kentech:1'), 200)
    const reconnectedSocket = api.makeWASocket()
    reconnectedSocket.ev.emit('connection.update', { connection: 'open' })
    originalSocket.ev.emit('connection.update', { connection: 'close' })
    assert.equal(await request('kentech:2'), 200)
    reconnectedSocket.ev.emit('connection.update', { connection: 'close' })
    assert.equal(await health(), 'DISCONNECTED')
    reconnectedSocket.ev.emit('connection.update', { connection: 'close', lastDisconnect: { error: { output: { statusCode: 401 } } } })
    assert.equal(await health(), 'UNLINKED')
    assert.equal(await request('kentech:3'), 503)
    assert.equal(sent, 2)
    assert.equal(created, 2) // Only the two explicit application factory calls above.
  } finally {
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true })
  }
})
