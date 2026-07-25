const { bot, getJson } = require('../lib')

bot(
	{
		pattern: 'calc ?(.*)',
		fromMe: true,
		desc: 'calculator',
		type: 'misc',
	},
	async (message, match) => {
		if (!match) return await message.send('*Example :* 4 * 4')
		const { result } = await getJson(`https://levanter.onrender.com/calc?q=${encodeURIComponent(match)}`)
		return await message.send('```' + result + '```')
	}
)