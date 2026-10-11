// Old share links look like  https://dramjournal.online/#/share/<id>.
// The app now uses real paths (/share/<id>) so crawlers and link-preview bots
// can see them. Rewrite legacy hash URLs in place before the router starts.

const LEGACY = /^#\/(share|wishlist|app|reset)(\/[^?#]*)?(\?[^#]*)?$/

/** Pure helper: returns the new path for a legacy hash, or null. */
export function legacyHashToPath(hash, base = '/') {
  if (!hash || hash.includes('access_token=')) return null  // never touch auth fragments
  const m = hash.match(LEGACY)
  if (!m) return null
  const prefix = base.endsWith('/') ? base : base + '/'
  return `${prefix}${m[1]}${m[2] || ''}${m[3] || ''}`
}

export function migrateLegacyHash() {
  if (typeof window === 'undefined') return
  const next = legacyHashToPath(window.location.hash, import.meta.env.BASE_URL || '/')
  if (next) window.history.replaceState(null, '', next)
}
