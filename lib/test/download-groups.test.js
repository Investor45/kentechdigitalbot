const { test } = require('node:test')
const assert = require('node:assert/strict')
const { parseGroupIds } = require('../download-groups')

test('normalizes numeric, full and legacy GIDs and removes duplicates', () => {
  assert.deepEqual(parseGroupIds('120363191116053479,120363191116053479@g.us 12345-67890@g.us'), ['120363191116053479@g.us', '12345-67890@g.us'])
  assert.throws(() => parseGroupIds(''), /at least one/)
  assert.throws(() => parseGroupIds('237670217260@s.whatsapp.net'), /Invalid/)
})
