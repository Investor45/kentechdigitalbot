const { bot } = require('../lib/')
const { viewOnceCommand, conversionCommand } = require('../lib/media-tools')
bot({ pattern: 'vv ?(.*)', fromMe: true, desc: 'Open available replied view-once media', type: 'whatsapp' }, viewOnceCommand)
bot({ pattern: 'convert ?(.*)', desc: 'Convert replied media: mp3, mp4, jpg, png, sticker', type: 'video' }, (message, match) => conversionCommand(message, String(match || '').trim().toLowerCase()))
