const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { startBridge } = require('../admin-notification-bridge')
const token = 'private-test-token-'.repeat(3)
async function fixture(t, client) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kentech-private-test-'))
  const server=startBridge(client || {user:{},connectionState:'CONNECTED',sendMessage:async()=>({key:{id:'sent'}})}, {directory,token,port:0})
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
  server.privateInbox.capture({type:'notify',messages:events})
  server.privateInbox.capture({type:'append',messages:[raw(undefined,{id:'old'})]})
  server.privateInbox.capture({type:'notify',messages:[{...raw(undefined,{id:'reaction'}),message:{reactionMessage:{text:'ok'}}}]})
  const data=await call('events');assert.equal(data.events.length,2);assert.equal(events[0].message.conversation,'Harmless test')
})
test('media is a safe notice without URLs, keys or data',async t=>{
  const {server,call}=await fixture(t)
  for(const type of ['imageMessage','documentMessage','audioMessage','videoMessage']) server.privateInbox.capture({type:'notify',messages:[{...raw(undefined,{id:type}),message:{[type]:{caption:'Error screenshot',mediaKey:'PRIVATE',url:'PRIVATE'}}}]})
  const events=(await call('events')).events
  assert.equal(events.length,4);assert.ok(!JSON.stringify(events).includes('PRIVATE'))
})
test('duplicate/reconnect events and acknowledged replay do not duplicate',async t=>{
  const {server,call}=await fixture(t);const event={type:'notify',messages:[raw()]}
  server.privateInbox.capture(event);server.privateInbox.capture(event)
  assert.equal((await call('events')).events.length,1)
  await call('ack',{ids:['a']});server.privateInbox.capture(event)
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
