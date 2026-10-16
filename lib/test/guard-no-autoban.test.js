const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')
const {createGuard}=require('../download-group-guard')
test('link detection never bans later ordinary images; explicit admin blocks persist',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'guard-no-autoban-'))
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}))
 const jid='123@g.us',sender='200@s.whatsapp.net'
 fs.writeFileSync(path.join(root,'auto-download-groups.json'),JSON.stringify([jid]))
 const guard=createGuard(root),key={remoteJid:jid,participant:sender,id:'PHONE1'}
 assert.equal(guard.shouldBlock({key,message:{conversation:'https://example.com/advert'}},{},true),true)
 const image={key:{...key,id:'PHONE2'},message:{imageMessage:{caption:'7 k'}}}
 assert.equal(guard.shouldBlock(image,{},true),false)
 assert.equal(createGuard(root).shouldBlock(image),false)
 guard.configure(jid,'block',[sender])
 assert.equal(createGuard(root).shouldBlock(image),true)
 guard.configure(jid,'release',[sender])
 assert.equal(createGuard(root).shouldBlock(image),false)
})
