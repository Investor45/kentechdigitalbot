function normalizePhoneNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!/^\d{10,15}$/.test(digits)) return ''
  return digits
}

function sessionBelongsToPhone(creds, phone) {
  const expected = normalizePhoneNumber(phone)
  if (!expected) return false
  const candidates = []
  const me = creds?.me || creds
  if (typeof me?.id === 'string') candidates.push(me.id)
  if (typeof creds?.registered === 'string') candidates.push(creds.registered)
  if (typeof creds?.registration?.phoneNumber === 'string') candidates.push(creds.registration.phoneNumber)
  for (const candidate of candidates) {
    if (normalizePhoneNumber(candidate) === expected) return true
  }
  return false
}

module.exports = { normalizePhoneNumber, sessionBelongsToPhone }
