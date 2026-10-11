// Shared HTML-escaping helpers for the email scripts.
// Every user-authored value (names, notes, reasons, URLs) must pass through
// one of these before being interpolated into an HTML email.

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Returns an HTML-attribute-safe URL when `url` is an https URL whose host is
 * in `allowedHosts` (exact match or subdomain); otherwise returns ''.
 * Used for <img src> so a user-supplied photo_url can't become a tracking
 * pixel or point at an arbitrary host.
 */
export function safeImageUrl(url, allowedHosts = []) {
  try {
    const u = new URL(String(url ?? ''))
    if (u.protocol !== 'https:') return ''
    const host = u.hostname.toLowerCase()
    const ok = allowedHosts.some(h => host === h || host.endsWith('.' + h))
    return ok ? escapeHtml(u.href) : ''
  } catch {
    return ''
  }
}

/** Hosts we serve user photos from, derived from the Supabase project URL. */
export function photoHostsFromEnv(env = process.env) {
  try {
    const u = env.SUPABASE_URL || env.VITE_SUPABASE_URL
    return u ? [new URL(u).hostname.toLowerCase()] : []
  } catch {
    return []
  }
}
