const rootDir = typeof __dirname === 'string'
  ? __dirname
  : (typeof process?.cwd === 'function' ? process.cwd() : '.')
const instanceModule = require('./lib/instance')
if (instanceModule && typeof instanceModule.lock === 'function') instanceModule.lock(rootDir)
const runtimeModule = require('./lib/kentech-runtime')
if (runtimeModule && typeof runtimeModule.install === 'function') runtimeModule.install()
const downloadGuardModule = require('./lib/download-group-guard')
if (downloadGuardModule && typeof downloadGuardModule.install === 'function') downloadGuardModule.install()
const { Client, logger } = require('./lib/client')
const { DATABASE, VERSION, SESSION_ID, BOT_INSTANCE_ID } = require('./config')
const { importSessionBundle } = require('./lib/import-session-bundle')
const { notifyDeployment } = require('./lib/deployment-notify')
const path = require('node:path')

const start = async () => {
  logger.info(`KENTECH AI ${VERSION}`)

  try {
    if (!SESSION_ID) throw new Error('SESSION_ID is missing from config.env')
    if (!BOT_INSTANCE_ID) logger.warn('BOT_INSTANCE_ID is missing; legacy namespace compatibility is active')
    await DATABASE.authenticate({ retry: { max: 3 } })
    await importSessionBundle(DATABASE, SESSION_ID)
  } catch (error) {
    logger.error({
      msg: 'Bot startup failed during database or session initialization',
      error: error.message,
      stack: error.stack,
    })
    process.exitCode = 1
    throw error
  }

  const bot = new Client()

  try {
    await bot.connect()
    try {
      await notifyDeployment(bot, { botName: require('./config').BOT_NAME, markerDirectory: path.dirname(__filename) })
    } catch (error) {
      logger.warn({ msg: 'Admin deployment notification failed', error: error.message })
    }
  } catch (error) {
    logger.error({ msg: 'Bot client failed to start', error: error.message, stack: error.stack })
    process.exitCode = 1
    throw error
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

init().catch(error => {
  logger.error({ msg: 'Bot initialization failed', error: error.message })
  process.exit(1)
})
