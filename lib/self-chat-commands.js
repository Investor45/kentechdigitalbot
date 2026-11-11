const normalize = jid => String(jid || '').replace(/:\d+(?=@)/, '')
function createSelfCommands(socket, options={}) {
  const now=options.now || Date.now, started=Math.floor(now()/1000)*1000, seen=new Set()
  function command(raw) {
    const key=raw?.key || {}
    if(!key.fromMe || !key.id || String(key.remoteJid || '').endsWith('@g.us'))return false
    const own=[socket.user?.id,socket.user?.jid,socket.user?.lid].map(normalize).filter(Boolean)
    if(![key.remoteJid,key.remoteJidAlt].map(normalize).some(jid=>own.includes(jid)))return false
    const timestamp=Number(raw.messageTimestamp)*1000
    if(!Number.isFinite(timestamp) || timestamp<started || timestamp<now()-120000 || timestamp>now()+60000)return false
    // Do not turn the bot's own generated replies back into commands.
    if(/^(?:3EB0|BAE5)/i.test(key.id))return false
    let body=raw.message || {}
    for(let i=0;i<4;i++) {
      const wrapped=body.ephemeralMessage || body.viewOnceMessage || body.viewOnceMessageV2 || body.deviceSentMessage
      if(!wrapped?.message)break
      body=wrapped.message
    }
    const text=String(body.conversation || body.extendedTextMessage?.text || '').trim()
    if(!text || text.length>2048)return false
    const prefix=String(options.prefix || process.env.PREFIX || '^[.,!+]').replace(/^\^/,'')
    try {return new RegExp(`^(?:${prefix})[a-z]`,'i').test(text)}catch(_){return false}
  }
  function split(upsert) {
    const ordinary=[], commands=[]
    for(const raw of upsert.messages || []) {
      if(!command(raw)){ordinary.push(raw);continue}
      if(seen.has(raw.key.id))continue
      seen.add(raw.key.id);if(seen.size>512)seen.delete(seen.values().next().value)
      commands.push(raw)
    }
    return {ordinary,commands}
  }
  return {split,eligible:command}
}
module.exports={createSelfCommands}
