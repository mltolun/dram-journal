import { createClient } from 'npm:@supabase/supabase-js@2'
import { UnsafeTargetError, parseSafeUrl, safeFetchText } from '../_shared/net-guard.ts'
import { allowedOrigins, corsHeadersFor } from '../_shared/gemini-guard.ts'

// scrape-whisky edge function.
//
// Authenticates the caller (admins only), validates the target URL (SSRF-safe:
// host allow-list, DNS re-check, manual redirect re-validation, size cap),
// scrapes whisky details, checks for duplicates, and inserts the result into
// the `catalogue` table using the service role key.
//
// Expects: { "url": "https://..." }
// Returns: { success: true, name, duplicate } | { error }
//
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_KEY
// Required: SCRAPE_ADMIN_EMAILS (comma list; empty = everyone denied)
// Optional: SCRAPE_ALLOWED_HOSTS (default "distilld.io"), ALLOWED_ORIGINS,
//           GEMINI_KEY (enables flavour-profile generation)

const ORIGINS = allowedOrigins(Deno.env.get('ALLOWED_ORIGINS'))

const ADMIN_EMAILS = (Deno.env.get('SCRAPE_ADMIN_EMAILS') || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)

const ALLOWED_HOSTS = (Deno.env.get('SCRAPE_ALLOWED_HOSTS') || 'distilld.io')
  .split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)

const FETCH_TIMEOUT_MS = 15_000

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req.headers.get('Origin'), ORIGINS)
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // Writes to the shared catalogue use the service role, so only admins.
    if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return json({ error: 'Forbidden' }, 403)
    }

    const body = await req.json().catch(() => null)
    const url  = body?.url

    if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      return json({ error: 'Missing or invalid url' }, 400)
    }

    // ── Scrape (SSRF-safe fetch) ───────────────────────────────────────────
    try {
      parseSafeUrl(url, ALLOWED_HOSTS)
    } catch (e) {
      return json({ error: e instanceof UnsafeTargetError ? e.message : 'Invalid url' }, 400)
    }

    const { html, finalUrl } = await safeFetchText(
      url,
      {
        resolveDns: (host, type) => Deno.resolveDns(host, type),
        fetchFn: (u, init) => fetch(u, init),
      },
      {
        allowedHosts: ALLOWED_HOSTS,
        timeoutMs: FETCH_TIMEOUT_MS,
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      },
    )
    const scraped = scrape(html, finalUrl)

    if (!scraped.name) {
      return json({ error: 'Could not extract a whisky name from that page' }, 422)
    }
    scraped.name = scraped.name.slice(0, 200)

    const service = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_SERVICE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } }
    )

    // ── Duplicate check ────────────────────────────────────────────────────
    const existing = await checkExisting(service, scraped.name)
    if (existing) {
      return json({ success: true, duplicate: true, name: existing.name })
    }

    // ── Optional flavour profile via Gemma ─────────────────────────────────
    const geminiKey = Deno.env.get('GEMINI_KEY')
    if (geminiKey) {
      try {
        const flavor = await generateFlavor(geminiKey, scraped)
        if (flavor) Object.assign(scraped, flavor, { status: true })
      } catch (err) {
        console.error('flavor generation failed (continuing):', err.message)
      }
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    const { error: insertError } = await service.from('catalogue').insert(scraped)
    if (insertError) {
      console.error('catalogue insert failed:', insertError.message)
      return json({ error: 'Insert failed' }, 500)
    }

    return json({ success: true, duplicate: false, name: scraped.name })

  } catch (err) {
    console.error('scrape-whisky error:', err)
    if (err instanceof UnsafeTargetError) return json({ error: err.message }, 400)
    return json({ error: 'Internal server error' }, 500)
  }
})

// ── HTML helpers ─────────────────────────────────────────────────────────────

function decodeEntities(str) {
  return String(str ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

function attr(html, attrName) {
  const re = new RegExp(`<meta[^>]+\\s${attrName}=["']([^"']+)["']`, 'i')
  const m = html.match(re)
  return m ? m[1] : ''
}

function extractFact(html, label) {
  const re = new RegExp(`${label}[\\s\\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)</p>`, 'i')
  const m = html.match(re)
  return m ? decodeEntities(m[1].trim()) : ''
}

function extractDistillery(html) {
  const re = /Distillery[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)<\/p>/i
  const m = html.match(re)
  return m ? decodeEntities(m[1].trim()) : ''
}

function extractAllFacts(html) {
  const re = /<p class="h3"[^>]*>([^<]+)<\/p>/g
  const out = []
  let m
  while ((m = re.exec(html)) !== null) out.push(decodeEntities(m[1].trim()))
  return out
}

function classifyType(name, country, typeStr) {
  const lower = `${name} ${country} ${typeStr}`.toLowerCase()
  if (lower.includes('japanese') || lower.includes('nippon') || country === 'Japan') return 'japanese'
  if (['scotch', 'speyside', 'islay', 'highland', 'lowland'].some(x => lower.includes(x))) return 'scotch'
  if (lower.includes('bourbon') || lower.includes('tennessee') || country === 'United States') return 'bourbon'
  if (lower.includes('irish') || country === 'Ireland') return 'irish'
  if (typeStr && typeStr.toLowerCase().includes('blended')) return 'other'
  return 'other'
}

function priceBandFrom(price) {
  const num = parseFloat(String(price).replace(',', '.'))
  if (isNaN(num)) return null
  if (num < 40) return 'budget'
  if (num < 80) return 'mid-range'
  if (num < 150) return 'premium'
  if (num < 300) return 'luxury'
  return 'super-premium'
}

// ── Scrape ────────────────────────────────────────────────────────────────────

function scrape(html, url) {
  let rawName = attr(html, 'property="og:title"') || ''
  if (!rawName) {
    const titleMatch = html.match(/<title>([^<]+)/i)
    if (titleMatch) rawName = titleMatch[1].split('|')[0].trim()
  }

  const facts = extractAllFacts(html)
  let distilleryFromFacts = null
  for (let i = 0; i < facts.length; i++) {
    if (i > 0 && !['Yes', 'No', 'Single Malt', 'Blended', 'Grain'].includes(facts[i])) {
      distilleryFromFacts = facts[i]
      break
    }
  }

  let abv = extractFact(html, 'ABV').replace('%', '')
  if (!abv) {
    const abvMatch = html.match(/ABV[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>(\d+)/i)
    if (abvMatch) abv = abvMatch[1]
  }

  const country = extractFact(html, 'Country') || ''
  const typeStr = extractFact(html, 'Type') || ''
  let distillery = extractDistillery(html) || distilleryFromFacts || ''
  const region = extractFact(html, 'Region') || ''
  const ageStr = extractFact(html, 'Age') || ''
  const priceMatch = html.match(/€(\d+)/)
  const priceStr = priceMatch ? priceMatch[1] : ''

  let name = decodeEntities(rawName).replace(/(Whisky Review|Whisky:|—)/g, '').trim()

  if (!distillery) {
    const known = ['Hibiki', 'Yamazaki', 'Hakushu', 'Nikka', 'Macallan', 'Glenfiddich', 'Talisker', 'Lagavulin']
    for (const d of known) {
      if (name.includes(d)) { distillery = d; break }
    }
  }

  return {
    name,
    distillery: distillery || null,
    country:    country || null,
    region:     region || null,
    type:       classifyType(name, country, typeStr),
    age:        /^\d+$/.test(ageStr) ? parseInt(ageStr, 10) : null,
    abv:        abv ? parseFloat(abv) : null,
    price_band: priceBandFrom(priceStr),
    source_url: url,
  }
}

async function checkExisting(service, name) {
  const { data } = await service
    .from('catalogue')
    .select('id, name')
    .ilike('name', `%${name.replace(/[\\%_]/g, '\\$&')}%`)
    .limit(1)
  return data?.[0] ?? null
}

// ── Optional Gemma flavour profile ────────────────────────────────────────────

async function generateFlavor(geminiKey, whisky) {
  const parts = [whisky.name]
  if (whisky.distillery) parts.push(`by ${whisky.distillery}`)
  if (whisky.country)    parts.push(`from ${whisky.country}`)
  if (whisky.region)     parts.push(`(${whisky.region})`)
  if (whisky.age)        parts.push(`aged ${whisky.age}`)
  if (whisky.abv)        parts.push(`at ${whisky.abv}%`)
  if (whisky.type)       parts.push(`style: ${whisky.type}`)

  const model = 'gemma-3-27b-it'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
  const prompt = `You are an expert whisky taster. Provide tasting notes and flavor scores for:
${parts.join(', ')}.

Respond ONLY with a JSON object, no markdown, no explanation:
{
  "nose": "2-4 aroma descriptors, comma separated",
  "palate": "2-4 taste descriptors, comma separated",
  "dulzor": <integer 0-5, sweetness>,
  "ahumado": <integer 0-5, smokiness>,
  "cuerpo": <integer 0-5, body/weight>,
  "frutado": <integer 0-5, fruitiness>,
  "especiado": <integer 0-5, spiciness>
}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 300, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) throw new Error(`Gemma HTTP ${res.status}`)

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null

  const parsed = JSON.parse(match[0])
  const clamp = (v) => Math.min(5, Math.max(0, Math.round(Number(v) || 0)))
  return {
    nose:      String(parsed.nose || '').trim(),
    palate:    String(parsed.palate || '').trim(),
    dulzor:    clamp(parsed.dulzor),
    ahumado:   clamp(parsed.ahumado),
    cuerpo:    clamp(parsed.cuerpo),
    frutado:   clamp(parsed.frutado),
    especiado: clamp(parsed.especiado),
  }
}
