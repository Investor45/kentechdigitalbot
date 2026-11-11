const {test}=require('node:test'),assert=require('node:assert/strict')
const {createSelfCommands}=require('../self-chat-commands')
const time=Date.now(),socket={user:{id:'123:1@s.whatsapp.net',lid:'456@lid'}}
const raw=(id='phone-command')=>({key:{id,fromMe:true,remoteJid:'456@lid',remoteJidAlt:'123@s.whatsapp.net'},messageTimestamp:Math.floor(time/1000),message:{conversation:'!ping'}})
test('fresh Message Yourself commands are promoted once across append and notify',()=>{
  const monitor=createSelfCommands(socket,{now:()=>time,prefix:'^!'})
  assert.equal(monitor.split({type:'append',messages:[raw()]}).commands.length,1)
  assert.equal(monitor.split({type:'notify',messages:[raw()]}).commands.length,0)
})
test('history, other senders/chats, groups, generated replies and plain text are never promoted',()=>{
  const monitor=createSelfCommands(socket,{now:()=>time,prefix:'^!'})
  const cases=[{...raw(),messageTimestamp:time/1000-60},{...raw(),key:{...raw().key,fromMe:false}},
    {...raw(),key:{...raw().key,remoteJid:'999@s.whatsapp.net',remoteJidAlt:undefined}},
    {...raw(),key:{...raw().key,remoteJid:'1@g.us'}},raw('3EB0ABC123'),
    {...raw(),message:{conversation:'Pong'}},{...raw(),message:{conversation:'hello !ping'}}]
  for(const value of cases)assert.equal(monitor.split({type:'append',messages:[value]}).commands.length,0)
})
test('wrapped own commands retain their original sender identity and content',()=>{
  const monitor=createSelfCommands(socket,{now:()=>time,prefix:'^!'})
  const value=raw();value.message={deviceSentMessage:{message:{conversation:'!ping'}}}
  const result=monitor.split({type:'append',messages:[value]})
  assert.equal(result.commands[0],value);assert.equal(result.commands[0].key.fromMe,true)
})
