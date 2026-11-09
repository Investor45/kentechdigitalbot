const sharp = require('sharp')
const SOURCES = { facebook: 'Facebook', instagram: 'Instagram', twitter: 'X / Twitter', tiktok: 'TikTok', youtube: 'YouTube', spotify: 'Spotify', pinterest: 'Pinterest', reddit: 'Reddit', mediafire: 'MediaFire', apk: 'APKMirror', web: 'Web' }
const MEDIA = new Set(['Video', 'Image', 'Audio', 'File', 'Media'])
const cache = new Map()

function cardSvg(source, media) {
  const name = Object.hasOwn(SOURCES, source) ? SOURCES[source] : 'Web'
  const type = MEDIA.has(media) ? media : 'Media'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="880" viewBox="0 0 960 880">
  <defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#061a22"/><stop offset="1" stop-color="#080c18"/></linearGradient>
    <linearGradient id="purple"><stop stop-color="#6925c5"/><stop offset=".5" stop-color="#c76bff"/><stop offset="1" stop-color="#782bda"/></linearGradient>
    <linearGradient id="green"><stop stop-color="#176b20"/><stop offset="1" stop-color="#214811"/></linearGradient>
  </defs>
  <rect width="960" height="880" rx="38" fill="url(#bg)"/>
  <rect x="9" y="9" width="942" height="862" rx="32" fill="none" stroke="#65408e" stroke-width="2"/>
  <g font-family="DejaVu Sans,Arial,sans-serif" fill="#fff">
    <rect x="45" y="45" width="870" height="178" rx="25" fill="#100c25" stroke="url(#purple)" stroke-width="4"/>
    <path d="M85 77h32v110H85z M121 131l56-54h43l-61 58 65 52h-49z" fill="url(#purple)"/>
    <text x="248" y="124" font-size="57" font-weight="bold" font-style="italic">KENTECH <tspan fill="#be69ff">AI</tspan></text>
    <text x="250" y="175" font-size="29" letter-spacing="3">SMART MEDIA ENGINE</text>
    <rect x="45" y="255" width="870" height="105" rx="24" fill="url(#green)"/>
    <circle cx="102" cy="308" r="33" fill="#22db26"/>
    <path d="M85 308l12 12 23-25" fill="none" stroke="white" stroke-width="8" stroke-linecap="round"/>
    <text x="156" y="322" font-size="46" font-weight="bold">Download Successful!</text>
    <rect x="45" y="391" width="870" height="225" rx="27" fill="#131e27" stroke="#9f6dc8" stroke-width="2"/>
    <circle cx="100" cy="446" r="24" fill="#7440bd"/><text x="100" y="455" text-anchor="middle" font-size="24" font-weight="bold">${name[0]}</text>
    <text x="150" y="457" font-size="35"><tspan font-weight="bold">Source:</tspan> ${name}</text>
    <path d="M79 490h43v32H79z" fill="#a964ea"/><path d="M94 497l14 9-14 9z" fill="white"/>
    <text x="150" y="520" font-size="35"><tspan font-weight="bold">Media:</tspan> ${type}</text>
    <path d="M82 571l13 13 27-29" fill="none" stroke="#32eb69" stroke-width="8" stroke-linecap="round"/>
    <text x="150" y="584" font-size="35"><tspan font-weight="bold">Status:</tspan> Ready to Use</text>
    <path d="M45 650h870 M45 776h870" stroke="url(#purple)" stroke-width="3"/>
    <text x="480" y="697" text-anchor="middle" font-size="32" font-weight="bold" font-style="italic">Smart • Fast • Reliable</text>
    <rect x="210" y="716" width="540" height="43" rx="20" fill="#6623a6"/>
    <text x="480" y="746" text-anchor="middle" font-size="26" font-weight="bold">Powered by KENTECH AI</text>
    <text x="480" y="832" text-anchor="middle" font-size="31">Support: <tspan fill="#16c5ff">wa.me/237670217260</tspan></text>
  </g></svg>`
}

function renderCard(source, media) {
  const safeSource = Object.hasOwn(SOURCES, source) ? source : 'web'
  const safeMedia = MEDIA.has(media) ? media : 'Media'
  const key = safeSource + ':' + safeMedia
  if (cache.has(key)) { const value = cache.get(key); cache.delete(key); cache.set(key, value); return value }
  const result = sharp(Buffer.from(cardSvg(safeSource, safeMedia))).jpeg({ quality: 86 }).toBuffer()
  cache.set(key, result)
  if (cache.size > 16) cache.delete(cache.keys().next().value)
  result.catch(() => { if (cache.get(key) === result) cache.delete(key) })
  return result
}

async function sendGraphicCard(send, source, media) {
  try {
    const image = await renderCard(source, media)
    await send(image, { mimetype: 'image/jpeg', caption: '💬 Support: https://wa.me/237670217260' }, 'image')
    return true
  } catch (_) { return false } // A cosmetic failure must never retry the downloaded media.
}
module.exports = { cardSvg, renderCard, sendGraphicCard }
