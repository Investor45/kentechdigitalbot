const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { createSupport } = require('../ai-support')
function setup(fetcher) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'support-'))
  let now = Date.now(), serial = 0
  const sent = [], calls = []
  const support = createSupport({ file: path.join(dir, 'settings.json'), now: () => now,
    env: { GEMINI_API_KEY: 'test-only' }, fetch: async (...args) => {
      calls.push(args); return fetcher ? fetcher(...args) : { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Approved answer' }] } }] }) }
    } })
  const msg = (text, own = false, jid = '123@s.whatsapp.net') => ({ text, jid, message: { key: { id: String(++serial), remoteJid: jid, fromMe: own } }, send: async text => { sent.push(text) } })
  const enable = async () => { await support.control(msg('', true), 'facts Opening hours: 9–5.'); await support.control(msg('', true), 'on'); sent.length = 0 }
  return { support, msg, sent, calls, enable, tick: () => { now += 6000 }, file: path.join(dir, 'settings.json') }
}
test('disabled and unauthorized controls never process customer chats', async () => {
  const x = setup(); await x.support.control(x.msg(''), 'on'); await x.support.handle(x.msg('hello'))
  assert.equal(x.sent.length, 0); assert.equal(x.calls.length, 0)
})
test('consent, isolated bounded memory, duplicate handling and opt-out', async () => {
  const x = setup(); await x.enable()
  await x.support.handle(x.msg('hello')); assert.match(x.sent[0], /Google Gemini/); assert.equal(x.calls.length, 0)
  await x.support.handle(x.msg('support start'))
  const question = x.msg('When are you open?'); await x.support.handle(question); await x.support.handle(question)
  assert.equal(x.calls.length, 1)
  const payload = JSON.parse(x.calls[0][1].body); assert.match(payload.systemInstruction.parts[0].text, /Opening hours/)
  await x.support.handle(x.msg('question', false, '456@s.whatsapp.net')); assert.equal(x.calls.length, 1)
  await x.support.handle(x.msg('support stop')); x.tick(); await x.support.handle(x.msg('hello again')); assert.equal(x.calls.length, 1)
  assert.doesNotMatch(fs.readFileSync(x.file, 'utf8'), /When are you open/)
})
test('group, status, stale messages and credentials are not sent to AI', async () => {
  const x = setup(); await x.enable()
  for (const jid of ['123@g.us', 'status@broadcast', '1@newsletter']) await x.support.handle(x.msg('hello', false, jid))
  await x.support.handle(x.msg('support start')); await x.support.handle(x.msg('OTP: 123456'))
  const old = x.msg('old'); old.message.messageTimestamp = 1; await x.support.handle(old)
  assert.equal(x.calls.length, 0)
})
test('human reply and disable cancel pending AI sends', async () => {
  let release
  const x = setup(async () => { await new Promise(resolve => { release = resolve }); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'late answer' }] } }] }) } })
  await x.enable(); await x.support.handle(x.msg('support start'))
  const pending = x.support.handle(x.msg('hours?')); await x.support.handle(x.msg('Human answering', true)); release(); await pending
  assert.ok(!x.sent.some(text => text.includes('late answer')))
  x.tick(); await x.support.handle(x.msg('hello')); assert.equal(x.calls.length, 1)
  await x.support.control(x.msg('', true), 'off'); assert.equal(x.support.reserves(x.msg('hello')), false)
})
test('automated replies do not trigger human pause; off cancels pending response', async () => {
  let release
  const x = setup(async () => { await new Promise(resolve => { release = resolve }); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'late answer' }] } }] }) } })
  await x.enable(); await x.support.handle(x.msg('support start'))
  await x.support.handle(x.msg('🤖 AI Support\nPrevious answer', true))
  const pending = x.support.handle(x.msg('hours?')); assert.equal(x.calls.length, 1)
  await x.support.control(x.msg('', true), 'off'); release(); await pending
  assert.ok(!x.sent.some(text => text.includes('late answer')))
})
test('provider error returns safe fallback without leaking secrets', async () => {
  const x = setup(async () => { throw Error('secret-key') }); await x.enable(); await x.support.handle(x.msg('support start')); await x.support.handle(x.msg('hours?'))
  assert.match(x.sent.at(-1), /temporarily unavailable/); assert.ok(!x.sent.join('').includes('secret-key'))
})
