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
    if (data.state === 'complete') {
      document.querySelector('#session').value = data.sessionId
      document.querySelector('#delivery').textContent = data.messageSent
        ? 'The SESSION_ID was sent to your WhatsApp private chat.'
        : 'WhatsApp login succeeded, but the private message could not be sent. Copy the SESSION_ID below.'
      result.classList.remove('hidden')
      pair.classList.add('hidden')
      button.disabled = false
      return
    }
    setTimeout(() => poll(id), 1500)
  } catch (cause) {
    error.textContent = cause.message || 'Pairing failed.'
    button.disabled = false
  }
}

document.querySelector('#copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.querySelector('#session').value)
  document.querySelector('#copy').textContent = 'Copied'
})
