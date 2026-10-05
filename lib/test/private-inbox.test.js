const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { startBridge } = require('../admin-notification-bridge')
const token = 'private-test-token-'.repeat(3)
const crypto = require('node:crypto')
async function fixture(t, client) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kentech-private-test-'))
  const server=startBridge(client || {user:{},connectionState:'CONNECTED',sendMessage:async()=>({key:{id:'sent'}})}, {directory,mediaDirectory:directory,token,port:0})
  await new Promise(resolve=>server.once('listening',resolve))
  t.after(()=>{server.close();fs.rmSync(directory,{recursive:true,force:true})})
  const call=async(action,body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/internal/private-inbox/${action}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
    return {code:response.status,...await response.json()}
  }
  await call('settings',{enabled:true,retention:30})
  return {server,call,directory}
}
const raw=(jid='237000111222@s.whatsapp.net',extra={})=>({key:{remoteJid:jid,id:'a',...extra},messageTimestamp:Math.floor(Date.now()/1000),pushName:'Test',message:{conversation:'Harmless test'}})
test('only private notify messages are captured; commands are not consumed',async t=>{
  const {server,call}=await fixture(t)
  const events=[raw(),raw('123@lid',{id:'lid'}),...['123@g.us','status@broadcast','123@broadcast','123@newsletter'].map((jid,i)=>raw(jid,{id:'bad'+i})),raw(undefined,{id:'own',fromMe:true}),raw(undefined,{id:'participant',participant:'123@s.whatsapp.net'})]
  await server.privateInbox.capture({type:'notify',messages:events})
  await server.privateInbox.capture({type:'append',messages:[raw(undefined,{id:'old'})]})
  await server.privateInbox.capture({type:'notify',messages:[{...raw(undefined,{id:'reaction'}),message:{reactionMessage:{text:'ok'}}}]})
  const data=await call('events');assert.equal(data.events.length,2);assert.equal(events[0].message.conversation,'Harmless test')
})
test('media is a safe notice without URLs, keys or data',async t=>{
  const {server,call}=await fixture(t)
  for(const type of ['imageMessage','documentMessage','audioMessage','videoMessage']) await server.privateInbox.capture({type:'notify',messages:[{...raw(undefined,{id:type}),message:{[type]:{caption:'Error screenshot',mediaKey:'PRIVATE',url:'PRIVATE'}}}]})
  const events=(await call('events')).events
  assert.equal(events.length,4);assert.ok(!JSON.stringify(events).includes('PRIVATE'))
})
test('duplicate/reconnect events and acknowledged replay do not duplicate',async t=>{
  const {server,call}=await fixture(t);const event={type:'notify',messages:[raw()]}
  await server.privateInbox.capture(event);await server.privateInbox.capture(event)
  assert.equal((await call('events')).events.length,1)
  await call('ack',{ids:['a']});await server.privateInbox.capture(event)
  assert.equal((await call('events')).events.length,0)
})
test('exact chat destination and durable send identity prevent duplicates',async t=>{
  const sends=[];const {call}=await fixture(t,{user:{},connectionState:'CONNECTED',sendMessage:async(jid,body)=>{sends.push({jid,body});return {key:{id:'sent'}}}})
  const body={id:'inbox:'+'a'.repeat(32),jid:'237000111222@s.whatsapp.net',text:'Harmless reply'}
  assert.equal((await call('send',body)).status,'SENT');assert.equal((await call('send',body)).status,'SENT')
  assert.equal((await call('send',{...body,jid:'237000333444@s.whatsapp.net'})).code,400)
  assert.equal((await call('send',{...body,id:'inbox:'+'b'.repeat(32),jid:'123@g.us'})).code,400)
  assert.deepEqual(sends,[{jid:body.jid,body:{text:body.text}}])
})
test('ambiguous failures cannot resend; offline attempts can recover',async t=>{
  let calls=0;const client={user:null,connectionState:'DISCONNECTED',sendMessage:async()=>{calls++;throw Error('private')}}
  const {call}=await fixture(t,client);const body={id:'inbox:'+'a'.repeat(32),jid:'123@lid',text:'Harmless'}
  assert.equal((await call('send',body)).status,'OFFLINE');client.user={};client.connectionState='CONNECTED'
  assert.equal((await call('send',body)).status,'AMBIGUOUS');assert.equal((await call('send',body)).status,'AMBIGUOUS');assert.equal(calls,1)
})

test('saved name and verified phone mapping replace profile names without changing destination',async t=>{
  const {server,call}=await fixture(t,{contact:async()=>({name:'Saved Contact',phoneNumber:'237000111222@s.whatsapp.net'})})
  await server.privateInbox.capture({type:'notify',messages:[raw('123@lid')]})
  const [row]=(await call('events')).events
  assert.equal(row.number,'237000111222');assert.equal(row.saved_name,'Saved Contact');assert.equal(row.jid,'123@lid')
  assert.ok(!JSON.stringify(row).includes('Test'))
})

test('media replies preserve identity after deletion and reject altered bytes',async t=>{
  const sends=[];const {call,directory}=await fixture(t,{user:{},connectionState:'CONNECTED',sendMessage:async(jid,body)=>{sends.push({jid,body});return {key:{id:'media'}}}})
  for(const [i,kind] of ['photo','document','voice','audio','video'].entries()) {
    const file_id=String(i+1).repeat(32),data=Buffer.from('Harmless media '+kind)
    fs.writeFileSync(path.join(directory,file_id),data)
    const media={kind,file_id,size:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),mime:'application/octet-stream',filename:'test.dat'}
    const body={id:'inbox:'+file_id,jid:'123@lid',text:'Caption',media}
    assert.equal((await call('send',body)).status,'SENT')
    fs.unlinkSync(path.join(directory,file_id))
    assert.equal((await call('send',body)).status,'SENT')
    assert.equal((await call('send',{...body,media:{...media,sha256:'a'.repeat(64)}})).code,400)
    assert.equal(sends[i].jid,'123@lid')
    const field={photo:'image',document:'document',voice:'audio',audio:'audio',video:'video'}[kind]
    assert.deepEqual(sends[i].body[field],data)
    if(kind==='voice')assert.equal(sends[i].body.ptt,true)
    if(kind==='document')assert.equal(sends[i].body.fileName,'test.dat')
  }
  assert.equal(sends.length,5)
})
