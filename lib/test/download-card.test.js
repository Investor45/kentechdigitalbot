const { test } = require('node:test')
const assert = require('node:assert/strict')
const sharp = require('sharp')
const { cardSvg, renderCard } = require('../download-card')
const { sendDownload } = require('../download-presentation')

test('card has dynamic labels, safe fallbacks and a small valid JPEG', async () => {
  const svg = cardSvg('youtube', 'Audio')
  assert.match(svg, /YouTube/)
  assert.match(svg, /> Audio</)
  assert.ok(!cardSvg('<script>', '<script>').includes('<script>'))
  const image = await renderCard('facebook', 'Video')
  const metadata = await sharp(image).metadata()
  assert.equal(metadata.format, 'jpeg')
  assert.equal(metadata.width, 960)
  assert.equal(metadata.height, 880)
  assert.ok(image.length < 200000)
  assert.equal(await renderCard('facebook', 'Video'), image)
})

test('a card delivery failure does not fail or resend the successful video', async () => {
  let videoCalls = 0, cardCalls = 0
  const receipt = { key: { id: 'video-sent' } }
  const message = { send: async (content, options, type) => {
    if (type === 'video') { videoCalls++; return receipt }
    cardCalls++; throw new Error('card failed')
  } }
  assert.equal(await sendDownload(message, 'facebook', Buffer.from('video'), {}, 'video'), receipt)
  assert.equal(videoCalls, 1)
  assert.equal(cardCalls, 1)
})

test('a failed video never produces a success graphic', async () => {
  const calls = []
  const message = { send: async (content, options, type) => { calls.push(type); throw new Error('media failed') } }
  await assert.rejects(sendDownload(message, 'facebook', Buffer.from('video'), {}, 'video'))
  assert.deepEqual(calls, ['video'])
})
