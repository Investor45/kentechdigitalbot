const form = document.querySelector('#form')
const button = form.querySelector('button')
const pair = document.querySelector('#pair')
const result = document.querySelector('#result')
const error = document.querySelector('#error')

form.addEventListener('submit', async event => {
  event.preventDefault()
  button.disabled = true
  error.textContent = ''
  result.classList.add('hidden')
  try {
    const response = await fetch('/api/pair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: document.querySelector('#phone').value }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    pair.classList.remove('hidden')
    poll(data.id)
  } catch (cause) {
    error.textContent = cause instanceof TypeError && cause.message === 'Failed to fetch'
      ? 'The session generator is offline or its API is not connected. Start the generator and make sure /api/ is forwarded to it.'
      : cause.message || 'Could not start pairing.'
    button.disabled = false
  }
})

async function poll(id) {
  try {
    const response = await fetch(`/api/pair/${encodeURIComponent(id)}`)
    const data = await response.json()
    if (!response.ok || data.state === 'failed') throw new Error(data.error)
    if (data.code) document.querySelector('#code').textContent = data.code
    if (data.sessionId) {
      document.querySelector('#session').value = data.sessionId
      document.querySelector('#delivery').textContent = data.state !== 'complete' && !data.messageSent
        ? 'Your SESSION_ID is ready. Copy it below while WhatsApp delivery finishes.'
        : data.messageSent
        ? 'WhatsApp accepted the SESSION_ID for your private chat. It may take a few seconds to appear.'
        : 'WhatsApp login succeeded, but the private message could not be sent. Copy the SESSION_ID below.'
      result.classList.remove('hidden')
      pair.classList.add('hidden')
      if (data.state === 'complete') {
        button.disabled = false
        return
      }
    }
    setTimeout(() => poll(id), 1500)
  } catch (cause) {
    error.textContent = cause.message || 'Pairing failed.'
    button.disabled = false
  }
}

document.querySelector('#shorten').addEventListener('click', async event => {
  const convert = event.currentTarget
  convert.disabled = true
  error.textContent = ''
  try {
    const response = await fetch('/api/shorten', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: document.querySelector('#long-session').value }) })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error)
    document.querySelector('#session').value = data.sessionId
    document.querySelector('#long-session').value = ''
    document.querySelector('#delivery').textContent = 'Your short SESSION_ID is ready. Use it in the bot installer.'
    result.classList.remove('hidden')
    result.scrollIntoView({ behavior: 'smooth' })
  } catch (cause) { error.textContent = cause.message || 'Could not shorten this session.' }
  finally { convert.disabled = false }
})

document.querySelector('#copy').addEventListener('click', async () => {
  const field = document.querySelector('#session')
  try {
    if (navigator.clipboard) await navigator.clipboard.writeText(field.value)
    else {
      field.focus()
      field.select()
      if (!document.execCommand('copy')) throw new Error('Copy manually')
    }
    document.querySelector('#copy').textContent = 'Copied'
  } catch (_) {
    field.focus()
    field.select()
    document.querySelector('#copy').textContent = 'Select and copy SESSION_ID'
  }
})
