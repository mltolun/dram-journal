const ICON_ALIASES = {
  'glass-water': 'glass-water',
  GlassWater: 'glass-water',
  first_dram: 'glass-water',
  hash: 'hash',
  Hash: 'hash',
  tenner: 'hash',
  trophy: 'trophy',
  Trophy: 'trophy',
  'check-circle': 'trophy',
  century: 'trophy',
  globe: 'globe',
  Globe: 'globe',
  globe_trotter: 'globe',
  flame: 'flame',
  Flame: 'flame',
  peat_freak: 'flame',
  star: 'star',
  Star: 'star',
  the_critic: 'star',
  'flask-conical': 'flask-conical',
  FlaskConical: 'flask-conical',
  flavor_arch: 'flask-conical',
  users: 'users',
  Users: 'users',
  social_butterfly: 'users',
  'book-open': 'book-open',
}

const ICON_GLYPHS = {
  'glass-water': '🥃',
  hash: '#',
  trophy: '🏆',
  globe: '🌍',
  flame: '🔥',
  star: '★',
  'flask-conical': '🧪',
  users: '👥',
  'book-open': '📖',
}

function normalizeIcon(iconName) {
  if (!iconName) return null
  return ICON_ALIASES[iconName] || null
}

export function emailIcon(iconName, fallback = '◆') {
  const normalized = normalizeIcon(iconName)
  return normalized ? ICON_GLYPHS[normalized] || fallback : fallback
}

export function emailIconUrl(iconName, appUrl) {
  const normalized = normalizeIcon(iconName)
  return normalized ? `${appUrl}/icons/email/${normalized}.png` : null
}

export function emailIconImg(iconName, appUrl, { size = 24, alt = '' } = {}) {
  const src = emailIconUrl(iconName, appUrl)
  if (!src) return ''
  return `<img src="${src}" alt="${alt}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border:0;outline:none;text-decoration:none;" />`
}
