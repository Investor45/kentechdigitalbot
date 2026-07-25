const { bot } = require('../lib/')
const fs = require('fs')
const path = require('path')

const STATE_FILE = path.join(__dirname, '..', 'sales-assistant-state.json')
const REGISTERED_CONTACTS_FILE = path.join(__dirname, '..', 'registered-contacts.json')

function normalizePhone(value) {
  let number = String(value || '').replace(/\D/g, '')
  if (number.startsWith('00')) number = number.slice(2)
  // Cameroon mobile numbers are commonly saved locally as nine digits.
  if (/^6\d{8}$/.test(number)) number = `237${number}`
  return number
}

function loadRegisteredContacts() {
  try {
    const numbers = JSON.parse(fs.readFileSync(REGISTERED_CONTACTS_FILE, 'utf8'))
    return new Set(numbers.map(normalizePhone).filter((number) => number.length >= 7))
  } catch (_) {
    return new Set()
  }
}

const registeredContacts = loadRegisteredContacts()

function loadModes() {
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))))
  } catch (_) {
    return new Map()
  }
}

const chatModes = loadModes()

function setMode(jid, mode) {
  chatModes.set(jid, mode)
  fs.writeFileSync(STATE_FILE, JSON.stringify(Object.fromEntries(chatModes), null, 2))
}

const PRODUCTS = [
  {
    names: ['google ai pro', 'google ai', 'gemini pro', 'gemini advanced'],
    label: 'Google AI Pro',
    price: 7500,
    duration: '18 months',
    accountType: 'Private',
    delivery: 'After purchase, send your email through the ADMIN support option.',
    guarantee: '10 months',
    benefits: [
      '5TB Google Drive Storage',
      'Google Antigravity',
      'Gemini 3.1 Pro & Gemini Advanced',
      'Lyria 3 for Music Generator',
      'Veo 3.1 (1,000 credits monthly)',
      'Nano Banana',
      'NotebookLM',
      'Longer Google Meet meeting duration',
      'Gemini AI in Gmail, Docs, Meet, and Slides',
    ],
  },
  {
    names: ['candy ai', 'candyai'],
    label: 'Candy AI Premium',
    price: 7000,
    duration: '1 month',
    accountType: 'Private',
    delivery: 'After purchase, the account and password will be delivered to you.',
    guarantee: '10 days',
    benefits: [
      'Create your own AI girlfriend(s)',
      'Unlimited text messages',
      '100 free tokens per month',
      'Remove image blur',
      'Generate images',
      'Make AI phone calls',
      'Fast response time',
    ],
  },
  {
    names: ['invideo ai', 'invideo', 'invideo plus'],
    label: 'InVideo AI Plus Plan',
    price: 15000,
    duration: '1 month',
    accountType: 'Private',
    delivery: 'After payment verification, the private Plus Plan account will be delivered to you.',
    guarantee: '10 days',
    benefits: [
      '75 credits per month',
      'All AI models, including Seedance 2.0, Veo 3.1, and Kling 3',
      'Access to all AI workflows',
      'Access to AI video trends',
      '4 AI avatars and voice clones',
      'Limited concurrency',
      '20 GB storage',
      '100 iStock assets',
      'Unlimited exports without watermark',
    ],
  },
  { names: ['chatgpt', 'chat gpt', 'gpt plus'], label: 'ChatGPT Plus', price: 4500, duration: '1 month' },
  { names: ['claude', 'claude ai'], label: 'Claude AI private account', price: 5000, duration: '1 month' },
  { names: ['grok', 'supergrok', 'super grok'], label: 'SuperGrok', price: 7000, duration: '1 month' },
  { names: ['canva', 'canva pro'], label: 'Canva Pro', price: 2500, duration: '1 year' },
  { names: ['capcut', 'capcut pro'], label: 'CapCut Pro', price: 2500, duration: '1 month' },
  { names: ['netflix private', 'private netflix'], label: 'Netflix Private', price: 2500, duration: '1 month' },
  { names: ['netflix shared', 'shared netflix', 'netflix'], label: 'Netflix Shared', price: 1500, duration: '1 month' },
  { names: ['express vpn', 'expressvpn'], label: 'ExpressVPN', price: 1500, duration: '1 month' },
  { names: ['proton vpn', 'protonvpn'], label: 'Proton VPN', price: 1500, duration: '1 month' },
]

const PAYMENT = [
  '*PAYMENT METHODS*',
  '',
  '📤 *Withdrawal Code (MTN)*',
  '',
  'Dial:',
  '',
  '*126*14*670217260*Amount#',
  '',
  'Receiver Name: KENNEDY',
  'Reference: "0"',
  '',
  '---',
  '',
  '💳 *Direct Mobile Money Transfer*',
  '',
  '*MTN Mobile Money*',
  '',
  'Number: 650942463',
  'Name: KENNEDY',
  '',
  '*Orange Money*',
  '',
  'Number: 688918616',
  'Name: ASONGAZIE',
  '',
  '---',
  '',
  '✅ After completing your payment, please upload a screenshot of the transaction for verification.',
].join('\n')

function money(amount) {
  return `${Number(amount).toLocaleString('en-US')} CFA`
}

function catalogue() {
  return [
    '🚀 *KENTECH DIGITAL*',
    '*PREMIUM AI TOOLS & SUBSCRIPTIONS*',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '🤖 *AI PREMIUM*',
    '',
    '💎 *Google AI Pro*',
    '💰 7,500 CFA • ⏳ 18 Months',
    '',
    '💎 *ChatGPT Plus*',
    '💰 4,500 CFA • ⏳ 1 Month',
    '',
    '💎 *Claude AI Private*',
    '💰 5,000 CFA • ⏳ 1 Month',
    '',
    '💎 *SuperGrok*',
    '💰 7,000 CFA • ⏳ 1 Month',
    '',
    '💎 *Candy AI Premium*',
    '💰 7,000 CFA • ⏳ 1 Month',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '🎨 *CREATIVE TOOLS*',
    '',
    '✨ *Canva Pro*',
    '💰 2,500 CFA • ⏳ 1 Year',
    '',
    '✨ *CapCut Pro*',
    '💰 2,500 CFA • ⏳ 1 Month',
    '',
    '🎬 *InVideo AI Plus*',
    '💰 15,000 CFA • ⏳ 1 Month',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '🎬 *STREAMING*',
    '',
    '🍿 *Netflix Private*',
    '💰 2,500 CFA • ⏳ 1 Month',
    '',
    '👥 *Netflix Shared*',
    '💰 1,500 CFA • ⏳ 1 Month',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '🛡️ *VPN SERVICES*',
    '',
    '🔐 *ExpressVPN*',
    '💰 1,500 CFA • ⏳ 1 Month',
    '',
    '🔐 *Proton VPN*',
    '💰 1,500 CFA • ⏳ 1 Month',
    '',
    '━━━━━━━━━━━━━━━━━━',
    '',
    '👉 Reply with the exact product name to place your order.',
    '',
    '💙 Fast Delivery • Secure Payment • Trusted Service',
  ].join('\n')
}

function paymentFor(product) {
  return [
    `*You selected: ${product.label}*`,
    `*Amount to pay: ${money(product.price)}*`,
    '',
    'Please complete your payment using any of the methods below.',
    '',
    '*PAYMENT METHODS*',
    '',
    '📤 *MTN Withdrawal Code*',
    '',
    'Dial:',
    '',
    `*126*14*670217260*${product.price}#`,
    '',
    'Receiver Name: KENNEDY',
    'Reference: 0',
    '',
    '━━━━━━━━━━━━━━',
    '',
    '💳 *Direct Mobile Money Transfer*',
    '',
    '*MTN Mobile Money*',
    'Number: 650942463',
    'Name: KENNEDY',
    '',
    '*Orange Money*',
    'Number: 688918616',
    'Name: ASONGAZIE',
    '',
    '━━━━━━━━━━━━━━',
    '',
    '✅ After completing the payment, upload a clear screenshot of the successful transaction for verification.',
  ].join('\n')
}

function deletePaymentMessageLater(message, sentMessage) {
  const key = sentMessage?.key || sentMessage?.message?.key
  const client = message.client
  if (!key || !client?.sendMessage) return

  setTimeout(async () => {
    try {
      await client.sendMessage(message.jid, { delete: key })
    } catch (_) {
      // The message may already be deleted or the session may be offline.
    }
  }, 30 * 60 * 1000)
}

function findProduct(text) {
  return PRODUCTS.find((product) => product.names.some((name) => text.includes(name)))
}

function productDetails(product) {
  const lines = [
    `*${product.label.toUpperCase()}*`,
    '',
    `Price: ${money(product.price)}`,
    `Duration: ${product.duration}`,
    `Account type: ${product.accountType || 'Premium account'}`,
    `Delivery: ${product.delivery || 'After payment verification'}`,
  ]
  if (product.guarantee) lines.push(`Guarantee: ${product.guarantee}`)
  if (product.benefits?.length) {
    lines.push('', '*BENEFITS:*', ...product.benefits.map((benefit) => `› ${benefit}`))
  }
  lines.push('', 'Reply *payment* for payment details or *admin* for human assistance.')
  return lines.join('\n')
}

function asksForHuman(text) {
  return /\b(?:human|admin|agent|person|support|call|talk to|speak to)\b/.test(text)
}

function isSavedContact(message) {
  const jid = String(message.jid || '')
  const client = message.client || {}
  const contactStores = [client.store && client.store.contacts, client.contacts]

  for (const contacts of contactStores) {
    if (!contacts) continue
    const contact = contacts instanceof Map ? contacts.get(jid) : contacts[jid]
    if (contact && (contact.name || contact.verifiedName || contact.shortName)) return true
  }

  // Some Levanter/Baileys builds attach the resolved address-book contact to
  // the serialized message instead of exposing the socket store.
  const contact = message.contact || (message.data && message.data.contact)
  if (contact && (contact.name || contact.verifiedName || contact.shortName)) return true

  // Modern WhatsApp messages can use an opaque @lid as the main address while
  // carrying the phone-number address in an alternate JID field.
  const key = message.data?.key || {}
  const candidates = [
    message.jid,
    message.sender,
    key.remoteJid,
    key.remoteJidAlt,
    key.participant,
    key.participantAlt,
    message.data?.participant,
    message.data?.participantAlt,
  ]
  return candidates.some((candidate) => registeredContacts.has(normalizePhone(candidate)))
}

async function showOffers(message) {
  setMode(String(message.jid || ''), 'offers')
  return message.send(catalogue(), { quoted: message.data })
}

async function showPremiumOrderPrompt(message) {
  setMode(String(message.jid || ''), 'offers')
  return message.send(catalogue(), { quoted: message.data })
}

async function chooseAdmin(message) {
  setMode(String(message.jid || ''), 'admin')
  return message.send(
    'You are now connected for human assistance. Automated replies are paused. An administrator will respond when available. Type *OFFERS* anytime to view products again.',
    { quoted: message.data }
  )
}

async function welcomeMenu(message) {
  return message.send(
    '━━━━━━━━━━━━━━━━━━\nWELCOME TO KENTECH DIGITAL\n━━━━━━━━━━━━━━━━━━\n\nReply *OFFERS* to view premium tools and prices.\nReply *ADMIN* to chat with a human administrator.',
    { quoted: message.data }
  )
}

async function salesAssistant(message) {
  if (message.isGroup || message.fromMe) return

  const jid = String(message.jid || '')
  const raw = String(message.text || '').trim()
  if (!raw || /^[.!/]/.test(raw)) return

  // PREMIUM is an explicit storefront request, so it must work even when the
  // sender is a saved contact. Saved contacts remain exempt from unsolicited
  // automatic business replies.
  if (/^premium$/i.test(raw)) {
    return showPremiumOrderPrompt(message)
  }

  // Explicit exemptions use the exact JID received by this linked session.
  // This remains reliable when WhatsApp represents a saved number as @lid.
  if (chatModes.get(jid) === 'personal') return

  // Personal contacts should always reach the account owner normally. The
  // automated storefront is only for numbers absent from the address book.
  const activeShopMode = String(chatModes.get(jid) || '')
  if (isSavedContact(message) && activeShopMode !== 'offers' && !activeShopMode.startsWith('payment:')) return

  const text = raw.toLowerCase()
  const wantsOffers = /^offers?$/i.test(raw) || /^catalog(?:ue)?$/i.test(raw)
  const wantsPremium = /^premium$/i.test(raw)
  const wantsAdmin = asksForHuman(text)
  const mode = chatModes.get(jid)

  if (wantsAdmin) {
    return chooseAdmin(message)
  }

  if (wantsOffers) {
    return showOffers(message)
  }

  if (wantsPremium) {
    return showPremiumOrderPrompt(message)
  }

  // Never interrupt a customer who selected human assistance.
  if (mode === 'admin') return

  // Do not send an unsolicited offer prompt on first contact. Customers can
  // still start the storefront explicitly with OFFERS, PREMIUM, or ADMIN.
  if (!mode) return

  if (mode === 'pending') return

  const product = findProduct(text)
  if (product) {
    setMode(jid, `payment:${product.label}`)
    const sentMessage = await message.send(paymentFor(product), { quoted: message.data })
    deletePaymentMessageLater(message, sentMessage)
    return sentMessage
  }

  if (/\b(?:price|prices|cost|offer|offers|available|catalog|catalogue|list|products|tools)\b/.test(text)) {
    return message.send(catalogue(), { quoted: message.data })
  }

  if (/\b(?:pay|payment|momo|mobile money|orange money|buy|purchase|order)\b/.test(text)) {
    return message.send(PAYMENT, { quoted: message.data })
  }

  if (/\b(?:delivery|receive|activate|activation|how long|duration)\b/.test(text)) {
    return message.send(
      'Delivery starts after an administrator verifies your payment. Please send your payment screenshot and the product name. Never send your PIN or OTP.',
      { quoted: message.data }
    )
  }

  // Unknown messages in offer mode stay silent to avoid repeated inbox spam.
  return
}

async function paymentScreenshotReceived(message) {
  if (message.isGroup || message.fromMe) return
  // Levanter 6.0.6 also invokes this listener for the product-selection text.
  // Ignore that specific text, but allow an uploaded image to have a caption.
  const mediaText = String(message.text || '').trim()
  if (mediaText && findProduct(mediaText.toLowerCase())) return
  const jid = String(message.jid || '')
  if (!String(chatModes.get(jid) || '').startsWith('payment:')) return
  setMode(jid, 'screenshot-received')
  return message.send(
    '✅ *Your payment screenshot has been received.*\n\nPlease be patient while the admin verifies and confirms your payment.\n\nYou will receive an update once the verification is completed.',
    { quoted: message.data }
  )
}

async function confirmPayment(message) {
  setMode(String(message.jid || ''), 'confirmed')
  return message.send(
    '✅ *PAYMENT CONFIRMED*\n\nYour payment has been successfully verified.\n\nPlease wait while your order is being prepared and delivered. Thank you for choosing KENTECH DIGITAL.',
    { quoted: message.data }
  )
}

bot({ on: 'text', fromMe: false, type: 'Kentech Sales Assistant' }, salesAssistant)
bot({ on: 'image', fromMe: false, type: 'Kentech Sales Assistant' }, paymentScreenshotReceived)

bot({ pattern: 'offers', fromMe: false, type: 'Kentech Sales Assistant' }, showOffers)
bot({ pattern: 'premium', fromMe: false, type: 'Kentech Sales Assistant' }, showPremiumOrderPrompt)
bot({ pattern: 'admin', fromMe: false, type: 'Kentech Sales Assistant' }, chooseAdmin)
bot({ pattern: 'confirmed', fromMe: true, type: 'Kentech Sales Assistant' }, confirmPayment)

bot(
  { pattern: 'personal', fromMe: true, type: 'Kentech Sales Assistant' },
  async (message) => {
    const jid = String(message.reply_message?.jid || (!message.isGroup ? message.jid : '') || '')
    if (!jid) return message.send('Reply to the registered contact\'s message with .personal')
    setMode(jid, 'personal')
    return message.send('Personal contact saved. Automatic business replies are disabled for this chat.')
  }
)

bot(
  { pattern: 'business', fromMe: true, type: 'Kentech Sales Assistant' },
  async (message) => {
    const jid = String(message.reply_message?.jid || (!message.isGroup ? message.jid : '') || '')
    if (!jid) return message.send('Reply to the contact\'s message with .business')
    chatModes.delete(jid)
    fs.writeFileSync(STATE_FILE, JSON.stringify(Object.fromEntries(chatModes), null, 2))
    return message.send('Automatic business replies are enabled again for this chat.')
  }
)
