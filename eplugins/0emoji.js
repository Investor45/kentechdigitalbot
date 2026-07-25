const { getJson, sticker, bot } = require('../lib')

bot(
	{
		pattern: 'emoji ?(.*)',
		fromMe: true,
		desc: 'emojis',
		type: 'search',
	},
	async (message, match) => {
		if (!match) return await message.send('Example .emoji 🙂')
		const { status, url } = await getJson(
			`https://levanter.onrender.com/emoji?q=${encodeURIComponent(match)}`
		)
		if (!status)
			return await message.send('_Emoji not found_', {
				quoted: message.data,
			})
		await message.send(
			await sticker('emoji', url),
			{
				quoted: message.data,
			},
			'sticker'
		)
	}
)