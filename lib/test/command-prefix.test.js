const { test }=require('node:test')
const assert=require('node:assert/strict')
const {synchronize,install}=require('../command-prefix')
function setup(prefix='!') {
  const privateCommand={pattern:/^[+](ping ?(.*)| ping ?(.*))/is,active:true,fromMe:true}
  const group={pattern:new RegExp('^'+prefix+'(ping ?(.*)| ping ?(.*))','is')}
  return {privateCommand,group,states:{0:{pammands:{ping:privateCommand},cammands:{ping:group}}}}
}
test('private commands accept configured prefix and legacy plus without changing permissions',()=>{
  const x=setup();assert.equal(x.privateCommand.pattern.test('!ping'),false)
  synchronize(x.states)
  for(const text of ['!ping','+ping'])assert.equal(x.privateCommand.pattern.test(text),true)
  for(const text of ['ping','.ping','hello !ping'])assert.equal(x.privateCommand.pattern.test(text),false)
  assert.equal(x.privateCommand.fromMe,true);assert.equal(x.privateCommand.active,true)
  assert.equal(x.group.pattern.test('+ping'),false)
  const pattern=x.privateCommand.pattern;synchronize(x.states);assert.equal(x.privateCommand.pattern,pattern)
})
test('prefix changes replace the previous configured prefix and retain the legacy alias',()=>{
  const x=setup();synchronize(x.states);x.group.pattern=/^\.(ping ?(.*)| ping ?(.*))/is;synchronize(x.states)
  assert.ok(x.privateCommand.pattern.test('.ping'));assert.ok(x.privateCommand.pattern.test('+ping'))
  assert.equal(x.privateCommand.pattern.test('!ping'),false)
})
test('new plugin registration and prefix changes are synchronized idempotently',()=>{
  const x=setup(),library={bot:()=>42};x.states.patchPrefix=()=>{x.group.pattern=/^#(ping ?(.*)| ping ?(.*))/is}
  install(library,x.states);const bot=library.bot;install(library,x.states);assert.equal(bot,library.bot)
  assert.equal(library.bot({}),42);x.states.patchPrefix();assert.ok(x.privateCommand.pattern.test('#ping'))
})
