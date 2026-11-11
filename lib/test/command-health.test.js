const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const { createMonitor, observe, record } = require('../command-health')
function setup() {
  let time=1000000, pending=2, running=0, resumes=0, restarts=0
  const client={ botState:{connected:true,E:true},session:{ws:{isOpen:true}},metrics:{totalProcessed:0},
    queue:{paused:true,length:()=>pending,running:()=>running,resume(){this.paused=false;resumes++}} }
  const monitor=createMonitor(client,{now:()=>time,file:path.join(fs.mkdtempSync(path.join(os.tmpdir(),'health-')),'health.json'),restart:()=>{restarts++}})
  return {client,monitor,advance:n=>{time+=n},pending:n=>{pending=n},running:n=>{running=n},counts:()=>({resumes,restarts})}
}
test('resumes an idle paused reply queue only after a stable connected minute',()=>{
  const x=setup();x.monitor.sample();x.advance(59999);x.monitor.sample();assert.equal(x.counts().resumes,0)
  x.advance(1);x.monitor.sample();assert.equal(x.counts().resumes,1)
})
test('never resumes disconnected queues or restarts idle bots',()=>{
  const x=setup();x.client.session.ws.isOpen=false;x.monitor.sample();x.advance(1000000);x.monitor.sample();assert.deepEqual(x.counts(),{resumes:0,restarts:0})
  x.client.session.ws.isOpen=true;x.pending(0);x.monitor.sample();x.advance(1000000);x.monitor.sample();assert.equal(x.counts().restarts,0)
})
test('allows slow media and progressing queues; restarts only a stable ten minute stall',()=>{
  const x=setup();x.client.queue.paused=false;x.running(1);x.monitor.sample();x.advance(599999);x.monitor.sample();assert.equal(x.counts().restarts,0)
  x.client.metrics.totalProcessed++;x.monitor.sample();x.advance(600000);x.monitor.sample();assert.equal(x.counts().restarts,1)
})
test('new pending messages do not hide a stalled worker; first work after idle gets a grace period',()=>{
  const x=setup();x.client.queue.paused=false;x.pending(0);x.monitor.sample();x.advance(1000000);x.monitor.sample()
  x.pending(1);x.monitor.sample();assert.equal(x.counts().restarts,0)
  x.advance(300000);x.pending(3);x.monitor.sample();x.advance(300000);x.monitor.sample();assert.equal(x.counts().restarts,1)
})
test('ping tracing records only counts and metadata, including wrapped append messages',()=>{
  const x=setup(),socket=x.client.session
  const raw={key:{id:'private-id',remoteJid:'123@s.whatsapp.net',fromMe:true},message:{ephemeralMessage:{message:{conversation:'!ping'}}}}
  observe(socket,{type:'append',messages:[raw]});record(socket,raw,undefined,true)
  const health=x.monitor.sample()
  assert.equal(health.ping_received,1);assert.equal(health.ping_dispatched,1);assert.equal(health.last_ping_event,'append')
  assert.equal(health.last_ping_generated_id,false)
  assert.equal(health.last_ping_timestamp_type,'undefined');assert.equal(health.last_ping_age_ms,null)
  assert.ok(!JSON.stringify(health).includes('private-id'));assert.ok(!JSON.stringify(health).includes('123@s.whatsapp.net'))
})

test('transport and event diagnostics are attached once and never retain message content',()=>{
  const {EventEmitter}=require('node:events'),x=setup(),socket=x.client.session
  socket.ev=new EventEmitter();socket.ws=new EventEmitter();socket.ws.isOpen=true
  socket.ev.isBuffering=()=>true
  x.monitor.sample();x.monitor.sample()
  assert.equal(socket.ws.listenerCount('CB:message'),1)
  const raw={key:{fromMe:true,remoteJid:'private-address'},message:{conversation:'private-text'}}
  socket.ws.emit('CB:message',{secret:'private-transport'})
  socket.ev.emit('messages.upsert',{messages:[raw]})
  observe(socket,{messages:[{...raw,message:{deviceSentMessage:{message:{conversation:'!ping'}}}}]})
  const health=x.monitor.sample(),encoded=JSON.stringify(health)
  assert.equal(health.transport_messages,1);assert.equal(health.message_count,1)
  assert.equal(health.own_messages,1);assert.equal(health.event_buffering,true)
  assert.equal(health.ping_received,1)
  assert.ok(!encoded.includes('private-'))
})
