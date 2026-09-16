function parseGroupIds(value) {
  const parts = String(value || '').trim().split(/[\s,]+/).filter(Boolean)
  if (!parts.length) throw new Error('Enter at least one group GID. Use the gid command inside your group.')
  return [...new Set(parts.map(part => {
    const id = part.endsWith('@g.us') ? part : part + '@g.us'
    if (!/^\d{5,30}(?:-\d{5,30})?@g\.us$/.test(id)) throw new Error('Invalid group GID. Copy the ID returned by gid.')
    return id
  }))]
}
module.exports = { parseGroupIds }
