const { bot } = require('../lib')

bot(
	{
		pattern: 'doc ?(.*)',
		fromMe: true,
		desc: 'media to doc msg',
		type: 'whatsapp',
	},
	async (message, match) => {
		if (!message.reply_message || !message.reply_message.mimetype)
			return await message.send('Reply to a media message')
		match = !match ? 'file' : match
		match =
			match.split('.').length == 1
				? message.reply_message.audio
					? `${match}.mp3`
					: `${match}.${message.reply_message.mimetype.split('/').pop()}`
				: match
		return await message.send(
			await message.reply_message.downloadMediaMessage(),
			{ fileName: match, mimetype: message.reply_message.mimetype },
			'document'
		)
	}
)