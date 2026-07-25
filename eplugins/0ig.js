const { bot, getJson, getBuffer } = require('../lib')

bot(
	{
		pattern: 'ig ?(.*)',
		fromMe: true,
		desc: 'Insta Profile Search',
		type: 'search',
	},
	async (message, match) => {
		if (!match)
			return await message.send('*Give me a instagram username*')
		const { result, status } = await getJson(
			`https://levanter.onrender.com/ig?q=${encodeURIComponent(match)}`
		)
		if (!status) return await message.send('*not found*')
		const { name, username, avatar, posts, following, followers, description } =
			result
		const { buffer } = await getBuffer(avatar)
		await message.send(
			buffer,
			{
				caption:
					'```' +
					`username : ${username}\nname : ${name}\nbio : ${description}\nposts : ${posts}\nfollowers : ${followers}\nfollowning : ${following}` +
					'```',
			},
			'image'
		)
	}
)