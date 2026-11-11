// A missing IQ timeout can hold the shared receive/sync locks indefinitely.
function socketOptions(input = {}, env = process.env) {
  const timeout = input.defaultQueryTimeoutMs
  const options = { ...input, defaultQueryTimeoutMs:
    Number.isFinite(timeout) && timeout > 0 && timeout <= 60000 ? timeout : 15000 }
  if (/^[a-f0-9]{32}$/.test(String(env.BOT_INSTANCE_ID || ''))) {
    // Hosted command bots consume live messages, not a download of chat history.
    // Offline live-message delivery and status receipts are separate mechanisms.
    options.syncFullHistory = false
    options.shouldSyncHistoryMessage = () => false
  }
  return options
}
module.exports = { socketOptions }
