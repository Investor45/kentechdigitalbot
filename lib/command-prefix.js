// The legacy loader hardcodes '+' for private-chat command patterns. Keep that
// alias, but also accept the bot's configured prefix in private chats.
const patched = new WeakMap()
function synchronize(states) {
  let count=0
  for(const state of Object.values(states)) {
    if(!state || !state.cammands || !state.pammands)continue
    for(const [key, command] of Object.entries(state.pammands)) {
      const group=state.cammands[key]
      if(!(command?.pattern instanceof RegExp) || !(group?.pattern instanceof RegExp))continue
      const previous=patched.get(command)
      if(previous?.assigned===command.pattern && previous.group===group.pattern)continue
      const legacy=previous?.assigned===command.pattern ? previous.legacy : command.pattern
      const flags=[...new Set((legacy.flags+group.pattern.flags).replace(/[gy]/g,''))].join('')
      const pattern=new RegExp(`(?:${group.pattern.source})|(?:${legacy.source})`,flags)
      command.pattern=pattern
      patched.set(command,{assigned:pattern,group:group.pattern,legacy});count++
    }
  }
  return count
}
function install(library=require('./index'), states=require('./config')) {
  if(library.bot.kentechPrivatePrefix)return
  const original=library.bot
  const wrapped=function(...args) { const result=original.apply(this,args);synchronize(states);return result }
  wrapped.kentechPrivatePrefix=true;library.bot=wrapped
  if(typeof states.patchPrefix==='function') {
    const patch=states.patchPrefix
    states.patchPrefix=function(...args) {const result=patch.apply(this,args);synchronize(states);return result}
  }
  synchronize(states)
}
module.exports={synchronize,install}
