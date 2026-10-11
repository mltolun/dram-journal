// SSRF guard shared by edge functions that fetch user-supplied URLs.
//
// Pure functions (no Deno-only APIs) so they can be unit-tested with vitest.
// Deno-specific pieces (DNS, fetch) are injected via `deps`.

export class UnsafeTargetError extends Error {}

// ── IP classification ─────────────────────────────────────────────────────────

export function isPrivateIPv4(ip: string): boolean {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if ([m[1], m[2], m[3], m[4]].some((o) => Number(o) > 255)) return true // malformed → block
  return (
    a === 0 ||                          // "this" network / 0.0.0.0
    a === 10 ||                         // RFC1918
    a === 127 ||                        // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) ||         // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) ||         // RFC1918
    (a === 192 && b === 0) ||           // 192.0.0.0/24, 192.0.2.0/24
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224                            // multicast / reserved / broadcast
  )
}

export function isPrivateIPv6(ipRaw: string): boolean {
  const ip = ipRaw.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]
  if (!ip.includes(':')) return false
  if (ip === '::' || ip === '::1') return true

  // IPv4-mapped / compatible (::ffff:a.b.c.d or ::ffff:7f00:1)
  const dotted = ip.match(/^(?:0{0,4}:){0,5}(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (dotted) return isPrivateIPv4(dotted[1])
  const hex = ip.match(/^(?:0{0,4}:){0,5}ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }

  const first = parseInt(ip.split(':')[0] || '0', 16)
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (first & 0xff00) === 0xff00 || // ff00::/8 multicast
    (first & 0xffc0) === 0xfec0    // fec0::/10 site-local (deprecated)
  )
}

export function isPrivateIp(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip)
}

// ── URL validation ────────────────────────────────────────────────────────────

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home', '.corp']

export function parseSafeUrl(raw: string, allowedHosts: string[] = []): URL {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new UnsafeTargetError('Invalid URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnsafeTargetError('Only http(s) URLs are allowed')
  if (u.username || u.password) throw new UnsafeTargetError('Credentials in URL are not allowed')
  if (u.port && u.port !== '80' && u.port !== '443') throw new UnsafeTargetError('Non-standard ports are not allowed')

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  if (!host || host === 'localhost' || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeTargetError('Host is not allowed')
  }
  if (isPrivateIp(host)) throw new UnsafeTargetError('Private address is not allowed')

  if (allowedHosts.length > 0) {
    const ok = allowedHosts.some((h) => host === h || host.endsWith('.' + h))
    if (!ok) throw new UnsafeTargetError('Host is not on the allow-list')
  }
  return u
}

// ── Safe fetch: re-validates every redirect hop and every resolved address ────

export interface GuardDeps {
  resolveDns: (host: string, type: 'A' | 'AAAA') => Promise<string[]>
  fetchFn: (url: string, init: RequestInit) => Promise<Response>
}

export interface SafeFetchOptions {
  allowedHosts?: string[]
  maxRedirects?: number
  maxBytes?: number
  timeoutMs?: number
  headers?: Record<string, string>
}

async function assertPublicDns(host: string, deps: GuardDeps) {
  // Literal IPs were already checked by parseSafeUrl.
  if (/^[\d.]+$/.test(host) || host.includes(':')) return
  const results = await Promise.all([
    deps.resolveDns(host, 'A').catch(() => [] as string[]),
    deps.resolveDns(host, 'AAAA').catch(() => [] as string[]),
  ])
  const addrs = results.flat()
  if (addrs.length === 0) throw new UnsafeTargetError('Host did not resolve')
  if (addrs.some(isPrivateIp)) throw new UnsafeTargetError('Host resolves to a private address')
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const len = Number(res.headers.get('content-length') || 0)
  if (len > maxBytes) throw new UnsafeTargetError('Response too large')
  if (!res.body) return await res.text()

  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new UnsafeTargetError('Response too large')
    }
    chunks.push(value)
  }
  const merged = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { merged.set(c, off); off += c.byteLength }
  return new TextDecoder().decode(merged)
}

export async function safeFetchText(
  rawUrl: string,
  deps: GuardDeps,
  opts: SafeFetchOptions = {},
): Promise<{ html: string; finalUrl: string }> {
  const { allowedHosts = [], maxRedirects = 3, maxBytes = 1_500_000, timeoutMs = 15_000, headers = {} } = opts
  let current = rawUrl

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = parseSafeUrl(current, allowedHosts)
    await assertPublicDns(u.hostname.toLowerCase().replace(/^\[|\]$/g, ''), deps)

    const res = await deps.fetchFn(u.href, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) throw new UnsafeTargetError('Redirect without Location')
      current = new URL(loc, u.href).href
      await res.body?.cancel()
      continue
    }

    if (!res.ok) throw new Error(`Page fetch failed (HTTP ${res.status})`)
    return { html: await readCapped(res, maxBytes), finalUrl: u.href }
  }
  throw new UnsafeTargetError('Too many redirects')
}
