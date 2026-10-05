// Private-message mirror attached to the application's existing socket only.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const privateJid = jid => typeof jid === 'string' && /^[0-9]+@(s\.whatsapp\.net|lid)$/.test(jid)
function createInbox(client, directory, options = {}) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  const settingsFile = path.join(directory, 'settings.json')
  const save = (file, data) => {
    fs.writeFileSync(file + '.tmp', JSON.stringify(data), { mode: 0o600 })
    fs.renameSync(file + '.tmp', file)
  }
  let settings = fs.existsSync(settingsFile) ? JSON.parse(fs.readFileSync(settingsFile)) : { enabled: false, since: Date.now(), retention: 30 }
  let sending = false
  const digest = value => crypto.createHash('sha256').update(value).digest('hex')
  const files = () => fs.readdirSync(directory).filter(n => n.startsWith('incoming-') && n.endsWith('.json'))
  const mediaDirectory = options.mediaDirectory || '/root/kentech-bot/whatsapp-inbox-media'
  const phone = value => {
    const match = String(value || '').match(/^([1-9]\d{7,14})(?::\d+)?(?:@s\.whatsapp\.net)?$/)
    return match ? match[1] : ''
  }
  async function identity(jid, alternate) {
    const contact = typeof client.contact === 'function' ? await client.contact(jid) : {}
    return { number: jid.endsWith('@s.whatsapp.net') ? phone(jid) : phone(alternate) || phone(contact.phoneNumber), saved_name: typeof contact.name === 'string' ? contact.name.slice(0,120) : null }
  }
  function purge() {
    for (const name of files()) {
      const file = path.join(directory, name)
      if (fs.statSync(file).mtimeMs < Date.now() - settings.retention * 86400000) fs.unlinkSync(file)
    }
  }
  async function capture(event) {
    if (!settings.enabled || event.type !== 'notify') return
    for (const raw of event.messages || []) {
      try {
        const key = raw.key || {}
        if (key.fromMe || key.participant || !privateJid(key.remoteJid) || !key.id || raw.messageStubType) continue
        const timestamp = Number(raw.messageTimestamp) * 1000
        if (!Number.isFinite(timestamp) || timestamp < Math.floor(settings.since / 1000) * 1000 || timestamp < Date.now() - settings.retention * 86400000) continue
        let message = raw.message || {}
        for (let i = 0; i < 3; i++) {
          const wrapper = message.ephemeralMessage || message.viewOnceMessage || message.viewOnceMessageV2
          if (!wrapper) break
          message = wrapper.message || {}
        }
        // View-once media is described only; no media/auth payload is persisted.
        let type, body
        if (typeof message.conversation === 'string') { type = 'text'; body = message.conversation }
        else if (message.extendedTextMessage) { type = 'text'; body = message.extendedTextMessage.text }
        else {
          const types = { imageMessage: 'Photo', documentMessage: 'Document', audioMessage: 'Voice / Audio', videoMessage: 'Video', stickerMessage: 'Sticker', contactMessage: 'Contact', contactsArrayMessage: 'Contacts', locationMessage: 'Location', liveLocationMessage: 'Live location' }
          const field = Object.keys(types).find(k => message[k])
          if (!field) continue
          type = field; body = '[' + types[field] + ']'
          if (typeof message[field].caption === 'string') body += '\n' + message[field].caption
        }
        if (!body) continue
        const contact = await identity(key.remoteJid,key.remoteJidAlt)
        const file = path.join(directory, 'incoming-' + digest(key.id) + '.json')
        if (fs.existsSync(file)) continue
        save(file, { message_id: String(key.id).slice(0,200), jid: key.remoteJid, ...contact, type, body: String(body).slice(0,3500), received_at: timestamp, acknowledged: false })
      } catch (_) { /* Never log private message data; mirror cannot break commands. */ }
    }
  }
  async function handle(req, reply) {
    if (!req.url.startsWith('/internal/private-inbox')) return false
    try {
      purge()
      if (req.method === 'GET' && req.url === '/internal/private-inbox/events') {
        const events = files().map(n => JSON.parse(fs.readFileSync(path.join(directory,n)))).filter(r => !r.acknowledged).sort((a,b) => a.received_at-b.received_at).slice(0,50)
        reply(200, { events }); return true
      }
      let raw = ''
      for await (const chunk of req) {
        raw += chunk.toString()
        if (Buffer.byteLength(raw)>20000) { reply(413,{status:'REJECTED'});return true }
      }
      if (req.method !== 'POST') { reply(404,{status:'REJECTED'});return true }
      const input = JSON.parse(raw)
      if (req.url === '/internal/private-inbox/settings') {
        if (typeof input.enabled !== 'boolean' || ![7,30,90].includes(input.retention)) throw Error()
        if (input.enabled && !settings.enabled) settings.since = Date.now()
        settings.enabled = input.enabled; settings.retention = input.retention; save(settingsFile,settings)
        reply(200,{status:'OK'});return true
      }
      if (req.url === '/internal/private-inbox/ack') {
        if (!Array.isArray(input.ids) || input.ids.length>50) throw Error()
        for (const id of input.ids) {
          const file=path.join(directory,'incoming-'+digest(String(id))+'.json')
          if (fs.existsSync(file)) { const row=JSON.parse(fs.readFileSync(file));row.acknowledged=true;save(file,row) }
        }
        reply(200,{status:'OK'});return true
      }
      if (req.url === '/internal/private-inbox/identities') {
        if (!Array.isArray(input.jids) || input.jids.length>50 || !input.jids.every(privateJid)) throw Error()
        const identities=[]
        for (const jid of input.jids) identities.push({jid,...await identity(jid)})
        reply(200,{identities});return true
      }
      if (req.url !== '/internal/private-inbox/send' || !/^inbox:[a-f0-9]{32}$/.test(input.id) || !privateJid(input.jid) || typeof input.text !== 'string' || input.text.length>3500 || (!input.text.length && !input.media)) throw Error()
      const media=input.media
      if (media && (!['photo','document','voice','audio','video'].includes(media.kind) || !/^[a-f0-9]{32}$/.test(media.file_id) || !/^[a-f0-9]{64}$/.test(media.sha256) || !Number.isInteger(media.size) || media.size<1 || media.size>20*1024*1024 || typeof media.mime!=='string' || media.mime.length>100 || typeof media.filename!=='string' || media.filename.length>100 || /[\\/\x00-\x1f]/.test(media.filename))) throw Error()
      const file=path.join(directory,'outgoing-'+digest(input.id)+'.json')
      const hash=digest(input.jid+'\n'+input.text+(media?'\n'+JSON.stringify([media.kind,media.file_id,media.sha256,media.size,media.mime,media.filename]):''))
      if (fs.existsSync(file)) {
        const receipt=JSON.parse(fs.readFileSync(file))
        if (receipt.hash!==hash) throw Error()
        reply(200,{status:receipt.status==='SENT'?'SENT':'AMBIGUOUS'});return true
      }
      if (sending) { reply(200,{status:'OFFLINE'});return true }
      if (!client.user || client.connectionState!=='CONNECTED') { reply(200,{status:'OFFLINE'});return true }
      let payload={text:input.text}
      if (media) {
        const file=path.join(mediaDirectory,media.file_id)
        const stat=fs.lstatSync(file)
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size!==media.size) throw Error()
        const buffer=fs.readFileSync(file)
        if (digest(buffer)!==media.sha256) throw Error()
        const field={photo:'image',document:'document',voice:'audio',audio:'audio',video:'video'}[media.kind]
        payload={[field]:buffer,mimetype:media.mime}
        if (media.kind==='document') payload.fileName=media.filename
        if (media.kind==='voice') payload.ptt=true
        if (input.text && !['voice','audio'].includes(media.kind)) payload.caption=input.text
      }
      sending=true
      try {
        save(file,{hash,status:'SENDING'})
        const result=await client.sendMessage(input.jid,payload)
        const status=result?.key?.id?'SENT':'AMBIGUOUS'
        save(file,{hash,status});reply(200,{status})
      } catch (_) { save(file,{hash,status:'AMBIGUOUS'});reply(200,{status:'AMBIGUOUS'}) }
      finally { sending=false }
      return true
    } catch (_) { reply(400,{status:'REJECTED'});return true }
  }
  return { capture, handle }
}
module.exports = { createInbox, privateJid }
