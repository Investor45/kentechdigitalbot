const {test}=require('node:test')
const assert=require('node:assert/strict')
const {socketOptions}=require('../connection-policy')

test('unbounded legacy IQ waits receive a finite timeout without replacing authentication or filters',()=>{
  const auth={creds:{private:'not-logged'}},filter=()=>true,getMessage=async()=>({})
  for(const timeout of [undefined,null,0,-1,Infinity,NaN,120000]) {
    const original={auth,shouldIgnoreJid:filter,getMessage,defaultQueryTimeoutMs:timeout}
    const options=socketOptions(original,{})
    assert.equal(options.defaultQueryTimeoutMs,15000)
    assert.equal(options.auth,auth);assert.equal(options.shouldIgnoreJid,filter)
    assert.equal(options.getMessage,getMessage);assert.equal(original.defaultQueryTimeoutMs,timeout)
  }
  assert.equal(socketOptions({defaultQueryTimeoutMs:30000},{}).defaultQueryTimeoutMs,30000)
})

test('managed bots skip history downloads while standalone history preferences and live filters remain intact',()=>{
  const history=()=>true,live=()=>false
  const input={shouldSyncHistoryMessage:history,shouldIgnoreJid:live,syncFullHistory:true}
  const managed=socketOptions(input,{BOT_INSTANCE_ID:'a'.repeat(32)})
  assert.equal(managed.shouldSyncHistoryMessage({syncType:3}),false)
  assert.equal(managed.syncFullHistory,false);assert.equal(managed.shouldIgnoreJid,live)
  assert.equal(input.shouldSyncHistoryMessage,history);assert.equal(input.syncFullHistory,true)
  const standalone=socketOptions(input,{BOT_INSTANCE_ID:'personal-bot'})
  assert.equal(standalone.shouldSyncHistoryMessage,history);assert.equal(standalone.syncFullHistory,true)
})
