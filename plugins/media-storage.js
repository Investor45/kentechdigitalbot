const { bot } = require('../lib/')
const { scan, cleanup, report } = require('../lib/media-cleanup')

bot({ pattern: 'clearmedia$', fromMe: true, desc: 'Clear old temporary download media safely', type: 'system' }, async message => {
  try { await message.send(report(await cleanup(), true)) }
  catch (_) { await message.send('Media cleanup unavailable. No general VPS folders were cleared.') }
})

bot({ pattern: 'mediastorage$', fromMe: true, desc: 'Check temporary download storage and free space', type: 'system' }, async message => {
  try { await message.send(report(await scan())) }
  catch (_) { await message.send('Media storage information is temporarily unavailable.') }
})
