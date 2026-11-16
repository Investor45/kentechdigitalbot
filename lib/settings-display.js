const PUBLIC_KEYS = new Set(['BOT_NAME', 'BOT_INSTANCE_NAME', 'PREFIX', 'SUDO', 'AUTO_STATUS_VIEW', 'SEND_READ', 'AUTO_UPDATE', 'MAX_UPLOAD', 'API_MODE', 'VPS', 'LOG_MSG', 'AJOIN', 'LANG', 'LANGUAGE', 'TIME_ZONE', 'TIMEZONE', 'STICKER_PACKNAME', 'STICKER_AUTHOR', 'HANDLERS', 'WORK_TYPE', 'ALWAYS_ONLINE', 'AUTO_READ', 'AUTO_REACT', 'DISABLE_START_MESSAGE'])
function settingsPages(values) {
  const lines = Object.entries(values && typeof values === 'object' ? values : {}).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key} = ${PUBLIC_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value) ? String(value).slice(0, 300) : '[hidden]'}`)
  if (!lines.length) return ['No saved bot settings were found.']
  const pages = []; let page = '*BOT SETTINGS*\nSensitive values are hidden.\n\n'
  for (const line of lines) {
    if (page.length + line.length + 1 > 3000) { pages.push(page); page = '*BOT SETTINGS · CONTINUED*\n\n' }
    page += line + '\n'
  }
  pages.push(page); return pages
}
module.exports = { settingsPages }
