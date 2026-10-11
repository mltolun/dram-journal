import { ID_RE, buildMeta } from './og.js'

const RPC = { share: 'get_shared_whisky', wishlist: 'get_shared_wishlist' }

async function loadPayload(kind, id, env) {
  const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL
  const key  = env.VITE_SUPABASE_KEY || env.SUPABASE_KEY
  if (!base || !key || !ID_RE.test(id)) return null
  const res = await fetch(`${base}/rest/v1/rpc/${RPC[kind]}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_share_id: id }),
    signal: AbortSignal.timeout(4000),
  })
  return res.ok ? res.json() : null
}

/** Serves the SPA shell with per-share <head> metadata for link-preview bots. */
export async function renderShare({ request, env, params }, kind) {
  const url = new URL(request.url)
  const shell = await env.ASSETS.fetch(new Request(new URL('/', url), request))
  const headers = new Headers(shell.headers)
  headers.set('X-Robots-Tag', 'noindex, nofollow')   // previews yes, search indexing no
  headers.set('Cache-Control', 'public, max-age=300')

  let payload = null
  try { payload = await loadPayload(kind, params.id, env) } catch { /* serve plain shell */ }
  if (!payload) return new Response(shell.body, { status: 200, headers })

  const m = buildMeta(kind, payload, {
    origin: url.origin,
    path: url.pathname,
    supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
  })
  const set = (attr, v) => ({ element: (el) => el.setAttribute(attr, v) })

  const rewritten = new HTMLRewriter()
    .on('title', { element: (el) => el.setInnerContent(m.title) })
    .on('meta[name="description"]', set('content', m.description))
    .on('meta[property="og:title"]', set('content', m.title))
    .on('meta[property="og:description"]', set('content', m.description))
    .on('meta[property="og:url"]', set('content', m.url))
    .on('meta[property="og:image"]', set('content', m.image))
    .on('meta[name="twitter:title"]', set('content', m.title))
    .on('meta[name="twitter:description"]', set('content', m.description))
    .on('meta[name="twitter:image"]', set('content', m.image))
    .on('link[rel="canonical"]', set('href', m.url))
    .on('script[type="application/ld+json"]', { element: (el) => el.remove() })
    .on('main.seo-fallback', { element: (el) => el.remove() })
    .transform(new Response(shell.body, { status: 200, headers }))
  return rewritten
}
