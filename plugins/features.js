const { bot } = require('../lib')

const FEATURES = [
  'KENTECH AI BOT FEATURES',
  '',
  'SECURITY',
  '• Download-group bot filter with admin exemption',
  '• Unsupported-link filtering in protected download groups',
  '• Anti-link and group moderation tools',
  '• Owner-only administrative commands',
  '• Temporary and permanent user protection with .bug',
  '',
  'AUTOMATION',
  '• Automatic TikTok, Facebook, Instagram and YouTube downloads',
  '• Private delivery of group downloads to the requesting user',
  '• Source-link deletion after successful private delivery',
  '• Group status posting with text, photos and videos',
  '• Bulk group-status command generation with .bulkstatus',
  '',
  'COMMANDS',
  '.features  - show this feature list',
  '.groupids  - list group IDs',
  '.bulkstatus  - prepare bulk status commands',
  '.autodownload  - manage automatic downloads',
  '.botguard status  - view group protection status',
  '',
  'The bot can automate routine work while you are offline, but WhatsApp permissions and anti-spam limits still apply.',
].join('\n')

bot({ pattern: 'features', desc: 'Show bot security and automation features', type: 'info' }, message => message.send(FEATURES))
