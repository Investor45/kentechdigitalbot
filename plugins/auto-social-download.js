const fs = require('fs')
const path = require('path')
const { bot, facebook, instagram, tiktok, video } = require('../lib/')

const STATE_FILE = path.join(__dirname, '..', 'auto-download-groups.json')
const URL_PATTERN = /https?:\/\/[^\s]+/i
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'])
const YOUTUBE_ID = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|v\/)|youtu\.be\/)([-_0-9A-Za-z]{11})/i

function loadGroups() {
  try {
    const groups = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    return new Set(Array.isArray(groups) ? groups.map(String) : [])
  } catch (_) {
    return new Set(['120363191116053479@g.us'])
  }
}

const enabledGroups = loadGroups()
const activeGroups = new Set()
function saveGroups() {
  fs.writeFileSync(STATE_FILE, JSON.stringify([...enabledGroups].sort(), null, 2))
}

function platformFor(url) {
  const host = new URL(url).hostname.toLowerCase()
  if (YOUTUBE_HOSTS.has(host)) return 'youtube'
  if (host.includes('facebook.com') || host === 'fb.watch') return 'facebook'
  if (host.includes('tiktok.com')) return 'tiktok'
  if (host.includes('instagram.com')) return 'instagram'
  return null
}

async function download(platform, url, message) {
  if (platform === 'youtube') {
    const id = url.match(YOUTUBE_ID)?.[1]
    return id ? video(id, message.id, {}) : null
  }
  if (platform === 'facebook') return facebook(url)
  if (platform === 'tiktok') return tiktok(url)
  if (platform === 'instagram') return instagram(url)
  return null
}

function bestMediaUrl(result) {
  const items = Array.isArray(result) ? result : [result]
  const candidates = items
    .map((item) => (typeof item === 'string' ? { url: item } : item))
    .filter((item) => item && typeof item.url === 'string')
  return candidates.find((item) => /(?:1080|720|hd)/i.test(String(item.quality || '')))?.url
    || candidates[0]?.url
}

async function handleLink(message) {
  const jid = String(message.jid || message.data?.key?.remoteJid || '')
  const isGroup = Boolean(message.isGroup || jid.endsWith('@g.us'))
  if (!isGroup || !enabledGroups.has(jid) || activeGroups.has(jid)) return
  const url = String(message.text || '').match(URL_PATTERN)?.[0]
  if (!url) return
  let platform
  try { platform = platformFor(url) } catch (_) { return }
  if (!platform) return

  activeGroups.add(jid)
  try {
    await message.send(`Downloading ${platform} video...`, { quoted: message.data })
    const media = await download(platform, url, message)
    if (!media) return message.send('I could not download that video.', { quoted: message.data })

    if (platform !== 'youtube') {
      const mediaUrl = bestMediaUrl(media)
      if (!mediaUrl) return message.send('I could not find a downloadable video.', { quoted: message.data })
      return message.client.sendMessage(jid, {
        video: { url: mediaUrl },
        caption: `${platform} video`,
      }, { quoted: message.data })
    }

    if (Buffer.isBuffer(media) && media.length > 60 * 1024 * 1024) {
      return message.send('That video is larger than the 60 MB automatic-download limit.', { quoted: message.data })
    }
    return message.send(media, { quoted: message.data, mimetype: 'video/mp4' }, 'video')
  } catch (error) {
    console.error('Automatic video download failed:', error)
    return message.send('The video could not be downloaded.', { quoted: message.data })
  } finally {
    activeGroups.delete(jid)
  }
}

async function control(message, match) {
  if (!message.isGroup) return message.send('Use this command inside a group.')
  const jid = String(message.jid || '')
  const action = String(match || '').trim().toLowerCase()
  if (action === 'on' || action === 'enable') {
    enabledGroups.add(jid)
    saveGroups()
    return message.send(`Automatic video downloads enabled for this group.\n${jid}`)
  }
  if (action === 'off' || action === 'disable') {
    enabledGroups.delete(jid)
    saveGroups()
    return message.send('Automatic video downloads disabled for this group.')
  }
  return message.send(`Auto-download is ${enabledGroups.has(jid) ? 'enabled' : 'disabled'} for this group.\nUse .autodownload on or .autodownload off`)
}

bot({ pattern: 'autodownload ?(.*)', fromMe: true, type: 'download' }, control)
bot({ on: 'text', fromMe: false, type: 'autoSocialDownload' }, handleLink)
bot({ on: 'text', fromMe: true, type: 'autoSocialDownloadOwner' }, handleLink)
