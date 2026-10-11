import { ATTRS } from './constants.js'

// Shared payloads come from a public table, so they are untrusted. Importing
// copies ONLY these known columns (never user_id, id, list, dram_count, …).
const TEXT_FIELDS = {
  name: 200, distillery: 200, origin: 100, region: 100, type: 30,
  age: 50, price: 50, date: 30, nose: 1000, palate: 1000, notes: 5000,
}

export function isOwnStorageUrl(url, supabaseUrl) {
  try {
    const u = new URL(String(url))
    const host = new URL(supabaseUrl).hostname
    return u.protocol === 'https:' && u.hostname === host && u.pathname.startsWith('/storage/v1/object/public/')
  } catch {
    return false
  }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)))

export function pickImportFields(src, supabaseUrl = import.meta.env.VITE_SUPABASE_URL) {
  const out = {}
  if (!src || typeof src !== 'object') return out

  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    const v = src[key]
    if (v === null || v === undefined || v === '') continue
    out[key] = String(v).slice(0, max)
  }
  for (const a of ATTRS) out[a] = clamp(src[a], 0, 5)
  if (src.rating != null) out.rating = clamp(src.rating, 0, 5)
  if (src.photo_url && isOwnStorageUrl(src.photo_url, supabaseUrl)) out.photo_url = String(src.photo_url)
  return out
}

/** Drops photo_url unless it points at our own public storage bucket. */
export function sanitizePhoto(obj, supabaseUrl = import.meta.env.VITE_SUPABASE_URL) {
  if (!obj || typeof obj !== 'object') return obj
  if (obj.photo_url && !isOwnStorageUrl(obj.photo_url, supabaseUrl)) {
    const { photo_url, ...rest } = obj
    return rest
  }
  return obj
}
