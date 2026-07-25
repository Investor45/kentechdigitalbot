const { bot, getJson } = require('../lib')

bot(
	{
		pattern: 'time ?(.*)',
		fromMe: true,
		desc: 'find time by timeZone or name or shortcode',
		type: 'search',
	},
	async (message, match) => {
		if (!match)
			return await message.send(
				'```Give me country name or code\nEx .time US\n.time United Arab Emirates\n.time America/new_york```'
			)
		const { status, result } = await getJson(
			`https://levanter.onrender.com/time?code=${encodeURIComponent(match)}`
		)
		if (!status) return await message.send(`*Not found*`)
		let msg = ''
		result.forEach(
			(zone) =>
				(msg += `Name     : ${zone.name}\nTimeZone : ${zone.timeZone}\nTime     : ${zone.time}\n\n`)
		)
		return await message.send('```' + msg.trim() + '```')
	}
)