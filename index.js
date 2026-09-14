require('./lib/download-group-guard').install()
const { Client, logger } = require('./lib/client')
const { DATABASE, VERSION, RAW_SESSION_ID } = require('./config')
const { stopInstance } = require('./lib/pm2')
const { importSessionBundle } = require('./lib/import-session-bundle')

const start = async () => {
  logger.info(`KENTECH AI ${VERSION}`)

  try {
    await DATABASE.authenticate({ retry: { max: 3 } })
    await importSessionBundle(DATABASE, RAW_SESSION_ID)
  } catch (error) {
    logger.error({
      msg: 'Database connection failed',
      error: error.message,
      url: process.env.DATABASE_URL,
    })
    return stopInstance()
  }

  const bot = new Client()

  try {
    await bot.connect()
  } catch (error) {
    logger.error({ msg: 'Bot client failed to start', error: error.message })
  }

  return bot
}

const shutdown = async (bot) => {
  try {
    if (bot) await bot.close()
    await DATABASE.close()
    process.exit(0)
  } catch (error) {
    logger.error({ msg: 'Error during shutdown', error: error.message })
    process.exit(1)
  }
}

const init = async () => {
  const bot = await start()

  process.on('SIGINT', () => shutdown(bot))
  process.on('SIGTERM', () => shutdown(bot))
}

init()
