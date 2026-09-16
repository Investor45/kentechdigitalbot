const { bot } = require('../lib/')
const { registerOwnerCommand } = require('../lib/owner-commands')
const { updateRepository } = require('../lib/repository-update')
registerOwnerCommand(bot, 'update', updateRepository, 'Install the latest KENTECH GitHub features and restart')
