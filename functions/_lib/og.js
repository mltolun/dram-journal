// Pure helpers for building Open Graph metadata for shared pages.
// (No Cloudflare APIs here so they can be unit-tested with vitest.)

export const SITE = 'The Dram Journal'
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)
const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

export const ID_RE = /^[A-Za-z0-9_-]{6,64}$/

function ownStorageImage(url, supabaseUrl) {
  try {
    const u = new URL(String(url))
    const host = new URL(supabaseUrl).hostname
    return u.protocol === 'https:' && u.hostname === host && u.pathname.startsWith('/storage/v1/object/public/')
      ? u.href : null
  } catch { return null }
}

/**
 * @returns {{title:string, description:string, image:string, url:string}}
 */
export function buildMeta(kind, payload, { origin, path, supabaseUrl }) {
  const fallbackImage = `${origin}/og.png`
  const url = `${origin}${path}`

  if (kind === 'wishlist') {
    const items = Array.isArray(payload?.items) ? payload.items : []
    const names = items.map(i => clean(i?.name)).filter(Boolean)
    return {
      title: `${names.length || ''} whisky wishlist – ${SITE}`.replace(/^ /, ''),
      description: clip(names.length
        ? `Bottles on this wishlist: ${names.slice(0, 6).join(', ')}${names.length > 6 ? '…' : ''}. Add them to your own journal on ${SITE}.`
        : `A whisky wishlist shared on ${SITE}.`, 200),
      image: fallbackImage,
      url,
    }
  }

  const name = clean(payload?.name) || 'A whisky'
  const meta = [payload?.distillery, payload?.origin, payload?.age].map(clean).filter(Boolean)
  const notes = [payload?.nose && `Nose: ${clean(payload.nose)}`, payload?.palate && `Palate: ${clean(payload.palate)}`]
    .filter(Boolean).join(' · ')
  return {
    title: clip(`${name}${meta[0] ? ` – ${meta[0]}` : ''} · ${SITE}`, 90),
    description: clip([meta.join(' · '), notes, `Shared on ${SITE}.`].filter(Boolean).join(' — '), 200),
    image: ownStorageImage(payload?.photo_url, supabaseUrl) || fallbackImage,
    url,
  }
}
