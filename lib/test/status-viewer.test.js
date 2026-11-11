const test = require('node:test')
const assert = require('node:assert/strict')
const { attach, installClient } = require('../status-viewer')
const STATUS = 'status@broadcast'
const now = 1800000000000
function raw(id = 'status1', participant = '123@s.whatsapp.net', extra = {}) {
  return { key: { remoteJid: STATUS, participant, id }, messageTimestamp: now / 1000, message: { conversation: 'test' }, ...extra }
}
function fixture() {
  let processEvents
  const receipts = [], reports = []
  const socket = { ev: { process: cb => { processEvents = cb } }, sendReceipt: async (...args) => { receipts.push(args) } }
  attach(socket, { now: () => now, report: value => reports.push(value) })
  return { socket, receipts, reports, send: events => processEvents(events) }
}

test('fresh self-chat commands enter notify from append/history once without replaying other chats', async () => {
  let processEvents
  const listeners={},batches=[]
  const socket={user:{id:'123:1@s.whatsapp.net',lid:'456@lid'},ev:{
    on:(name,fn)=>{listeners[name]=fn},process:fn=>{processEvents=fn},
    emit:(name,event)=>{listeners[name]?.(event);return processEvents({[name]:event})}
  }}
  attach(socket,{now:()=>now,prefix:'^!'})
  socket.ev.process(async events=>{batches.push(events['messages.upsert'])})
  const self=id=>({key:{remoteJid:'456@lid',remoteJidAlt:'123@s.whatsapp.net',fromMe:true,id},messageTimestamp:now/1000,message:{conversation:'!ping'}})
  const ordinary={...self('other'),key:{...self().key,fromMe:false,remoteJid:'999@s.whatsapp.net',remoteJidAlt:undefined}}
  await socket.ev.emit('messages.upsert',{type:'append',messages:[self('one'),ordinary]})
  assert.equal(batches[0].type,'append');assert.deepEqual(batches[0].messages,[ordinary])
  assert.equal(batches[1].type,'notify');assert.equal(batches[1].messages[0].key.id,'one')
  await socket.ev.emit('messages.upsert',{type:'notify',messages:[self('one')]})
  assert.equal(batches.at(-1).messages.length,0)
  listeners['messaging-history.set']({messages:[self('two'),{...self('old'),messageTimestamp:now/1000-60},ordinary]})
  await new Promise(resolve=>setImmediate(resolve))
  assert.deepEqual(batches.at(-1).messages.map(raw=>raw.key.id),['two'])
})
test('phone and LID status receipts retain their own namespace without chat resolution', async () => {
  class Client { async _handleRead() { throw Error('chat resolver must not run') } }
  installClient(Client)
  const f = fixture(), client = new Client()
  client.session = f.socket
  for (const participant of ['123@s.whatsapp.net', '456@lid', '123:9@s.whatsapp.net']) {
    await client._handleRead({ chat: STATUS, participant, ids: ['s'] })
  }
  assert.deepEqual(f.receipts.map(r => r[1]), ['123@s.whatsapp.net', '456@lid', '123@s.whatsapp.net'])
  assert.ok(f.receipts.every(r => r[0] === STATUS && r[3] === 'read'))
  assert.equal(f.reports.at(-1).viewed, 3)
})
test('chat receipts and queue failures retain existing behavior; installation is idempotent', async () => {
  class Client { async _handleRead(task) { return task.chat } }
  installClient(Client)
  const handler = Client.prototype._handleRead
  installClient(Client)
  assert.equal(handler, Client.prototype._handleRead)
  const client = new Client(), f = fixture()
  client.session = f.socket
  assert.equal(await client._handleRead({ chat: 'group@g.us' }), 'group@g.us')
  f.socket.sendReceipt = async () => { throw Error('network unavailable') }
  await assert.rejects(client._handleRead({ chat: STATUS, participant: '123@lid', ids: ['s'] }), /network unavailable/)
  assert.equal(f.reports.at(-1).failed, 1)
  await assert.rejects(client._handleRead({ chat: STATUS, participant: 'group@g.us', ids: ['s'] }), /Invalid status receipt/)
})
test('fresh append statuses enter existing notify logic while chat history stays append', async () => {
  const f = fixture(), events = []
  f.socket.ev.process(async batch => { events.push(batch) })
  const chat = { ...raw(), key: { remoteJid: 'group@g.us', id: 'chat' } }
  await f.send({ 'messages.upsert': { type: 'append', messages: [chat, raw()] }, 'creds.update': { ok: true } })
  assert.equal(events.length, 2)
  assert.equal(events[0]['messages.upsert'].type, 'append')
  assert.deepEqual(events[0]['messages.upsert'].messages, [chat])
  assert.ok(events[0]['creds.update'])
  assert.equal(events[1]['messages.upsert'].type, 'notify')
  assert.deepEqual(events[1]['messages.upsert'].messages, [raw()])
  assert.equal(events[1]['creds.update'], undefined)
})
test('duplicate, expired, future, own and malformed statuses never enqueue receipts', async () => {
  const f = fixture(), batches = []
  f.socket.ev.process(async batch => batches.push(batch))
  const invalid = [
    raw('old', undefined, { messageTimestamp: now / 1000 - 86401 }),
    raw('future', undefined, { messageTimestamp: now / 1000 + 301 }),
    raw('own', undefined, { key: { ...raw().key, fromMe: true } }),
    raw('bad', 'bad@g.us'), raw('missing', undefined, { messageTimestamp: undefined }),
  ]
  await f.send({ 'messages.upsert': { type: 'notify', messages: [raw(), ...invalid] } })
  await f.send({ 'messages.upsert': { type: 'append', messages: [raw()] } })
  assert.equal(batches.flatMap(b => b['messages.upsert'].messages).length, 1)
  assert.equal(f.reports.at(-1).received, 1)
  assert.equal(f.receipts.length, 0) // Only the existing enabled/filter logic may request a view.
})
test('new sockets have independent deduplication and monitoring cannot break processing', async () => {
  const f = fixture()
  attach(f.socket)
  let received = 0
  f.socket.ev.process(async events => { received += events['messages.upsert'].messages.length })
  await f.send({ 'messages.upsert': { type: 'notify', messages: [raw()] } })
  assert.equal(received, 1)
  assert.ok(Object.keys(f.reports.at(-1)).every(k => ['connected', 'received', 'viewed', 'failed'].includes(k)))
})
test('the public client manager installs the receipt handler on its real child sessions', async () => {
  class Session { async _handleRead() { throw Error('old resolver') } }
  const manager = { sessions: { 0: new Session(), 1: new Session() } }
  installClient(manager)
  for (const session of Object.values(manager.sessions)) {
    const f = fixture()
    session.session = f.socket
    await session._handleRead({ chat: STATUS, participant: '123@lid', ids: ['status'] })
    assert.equal(f.receipts.length, 1)
  }
})
