const { bot } = require('../lib/')

function escapeVcard(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1')
}

function phoneFrom(value) {
  const jid = String(value || '')
  if (jid.endsWith('@lid')) return ''
  const number = jid.split('@')[0].replace(/\D/g, '')
  return number.length >= 7 ? number : ''
}

function contactFor(message, participant) {
  const ids = [
    participant.id,
    participant.jid,
    participant.phoneNumber,
    participant.phoneJid,
  ].filter(Boolean)
  const stores = [
    message.client?.store?.contacts,
    message.client?.contacts,
    global.store?.contacts,
  ]
  for (const store of stores) {
    if (!store) continue
    for (const id of ids) {
      const contact = store instanceof Map ? store.get(id) : store[id]
      if (contact) return contact
    }
  }
  return {}
}

function participantDetails(message, participant, index) {
  const contact = contactFor(message, participant)
  const candidates = [
    participant.phoneNumber,
    participant.phoneJid,
    contact.phoneNumber,
    contact.jid,
    contact.id,
    participant.jid,
    participant.id,
  ]
  const phone = candidates.map(phoneFrom).find(Boolean)
  if (!phone) return null
  const name = [
    contact.name,
    contact.verifiedName,
    contact.notify,
    contact.shortName,
    participant.name,
    participant.notify,
  ].find(Boolean) || `Group Member ${String(index + 1).padStart(3, '0')}`
  return {
    name: String(name).trim(),
    phone,
    fallback: ![
      contact.name,
      contact.verifiedName,
      contact.notify,
      contact.shortName,
      participant.name,
      participant.notify,
    ].some(Boolean),
  }
}

function safeFileName(value) {
  return String(value || 'WhatsApp Group')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim()
    .slice(0, 80) || 'WhatsApp Group'
}

bot(
  {
    pattern: 'vcf',
    fromMe: true,
    onlyGroup: true,
    desc: 'Export all group members as a VCF contact file',
    type: 'group',
  },
  async (message) => {
    const jid = String(message.jid || message.data?.key?.remoteJid || '')
    let metadata = {}
    try {
      metadata = await message.client.groupMetadata(jid)
    } catch (_) {}
    const participants = metadata.participants || await message.groupMetadata(jid)
    if (!Array.isArray(participants) || !participants.length) {
      return message.send('I could not read this group participant list.')
    }

    const contacts = participants
      .map((participant, index) => participantDetails(message, participant, index))
      .filter(Boolean)
    const uniqueContacts = new Map()
    for (const contact of contacts) {
      const previous = uniqueContacts.get(contact.phone)
      if (!previous || (previous.fallback && !contact.fallback)) {
        uniqueContacts.set(contact.phone, contact)
      }
    }
    const deduplicatedContacts = [...uniqueContacts.values()]
    if (!deduplicatedContacts.length) {
      return message.send('No group members with resolvable phone numbers were found.')
    }

    const cards = deduplicatedContacts.map(({ name, phone }) => [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVcard(name)}`,
      `N:${escapeVcard(name)};;;;`,
      `TEL;TYPE=CELL:+${phone}`,
      'END:VCARD',
    ].join('\r\n')).join('\r\n')
    const fileName = `${safeFileName(metadata.subject)} Members.vcf`
    await message.send(
      Buffer.from(`${cards}\r\n`, 'utf8'),
      { fileName, mimetype: 'text/vcard', quoted: message.data },
      'document'
    )
    return message.send(`Created ${fileName} with ${deduplicatedContacts.length} unique contact(s).`)
  }
)
