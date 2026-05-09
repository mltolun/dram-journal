import 'dotenv/config'
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'
import { URL } from 'url'

const SUPABASE_URL         = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[error] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const protocol  = parsedUrl.protocol === 'https:' ? https : http
    const opts      = {
      hostname: parsedUrl.hostname,
      path:     parsedUrl.pathname + parsedUrl.search,
      method:   'GET',
      headers:  { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', ...headers },
    }
    const req = protocol.request(opts, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout')) })
    req.end()
  })
}

function attr(html, attrName) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<meta[^>]+\\s${escaped}=["']([^"']+)["']`, 'i')
  const m = html.match(re)
  return m ? m[1] : ''
}

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function extractFact(html, label) {
  const re = new RegExp(`${label}[\\s\\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)<\\/p>`, 'i')
  const m  = html.match(re)
  return m ? decodeEntities(m[1]).trim() : ''
}

function extractSection(html, startMarker) {
  const idx = html.indexOf(startMarker)
  if (idx === -1) return ''
  return html.slice(idx, idx + 3000)
}

function extractDistillery(html) {
  const re = /Distillery[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)<\/p>/i
  const m = html.match(re)
  return m ? decodeEntities(m[1]).trim() : ''
}

function extractAllFacts(html) {
  const re = /<p class="h3"[^>]*>([^<]+)<\/p>/g
  const matches = []
  let m
  while ((m = re.exec(html)) !== null) {
    matches.push(decodeEntities(m[1].trim()))
  }
  return matches
}

async function scrape(url) {
  console.log(`[scraper] Fetching: ${url}`)
  const html = await httpGet(url)

  const rawName = attr(html, 'property="og:title"') ||
                  html.match(/<title>([^<]+)/)?.[1]?.split('|')[0].trim() || ''
  const name = decodeEntities(rawName)

  const facts = extractAllFacts(html)
  const distilleryFromFacts = facts.find((v, i) => i > 0 && v !== 'Yes' && v !== 'No' && v !== 'Single Malt' && v !== 'Blended' && v !== 'Grain')

  const abv           = extractFact(html, 'ABV').replace('%', '') ||
                        html.match(/ABV[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>(\d+)/)?.[1] || ''
  const country       = extractFact(html, 'Country') || ''
  const typeStr       = extractFact(html, 'Type') || ''
  const distillery    = extractDistillery(html) || distilleryFromFacts || ''
  const region        = extractFact(html, 'Region') || ''
  const ageStr        = extractFact(html, 'Age') || ''
  const priceMatch    = html.match(/€(\d+)/)
  const priceStr      = priceMatch ? priceMatch[1] : ''

  const rawLocale = attr(html, 'property="og:locale"')
  const localeCountry = rawLocale ? rawLocale.split('_').pop() : ''
  if (!country && localeCountry) {
    const localeMap = { gb: 'United Kingdom', us: 'United States', jp: 'Japan', ie: 'Ireland' }
    country = localeMap[localeCountry.toLowerCase()] || localeCountry
  }

  let type = 'other'
  const lower = (name + ' ' + country + ' ' + typeStr).toLowerCase()
  if (lower.includes('japanese') || lower.includes('nippon') || country === 'Japan') type = 'japanese'
  else if (lower.includes('scotch') || lower.includes('speyside') || lower.includes('islay') ||
           lower.includes('highland') || lower.includes('lowland')) type = 'scotch'
  else if (lower.includes('bourbon') || lower.includes('tennessee') || country === 'United States') type = 'bourbon'
  else if (lower.includes('irish') || country === 'Ireland') type = 'irish'
  else if (typeStr && typeStr.toLowerCase().includes('blended')) type = 'japanese'

  const distilleryRaw = distillery || null
  if (!distilleryRaw) {
    const knownDistilleries = ['Hibiki', 'Yamazaki', 'Hakushu', 'Nikka', 'Macallan', 'Glenfiddich', 'Talisker', 'Lagavulin']
    for (const d of knownDistilleries) {
      if (name.includes(d)) { distilleryRaw = d; break }
    }
  }

  let price_band = null
  if (priceStr) {
    const num = parseFloat(priceStr.replace(',', '.'))
    if (!isNaN(num)) {
      if (num < 40)       price_band = 'budget'
      else if (num < 80)  price_band = 'mid-range'
      else if (num < 150) price_band = 'premium'
      else if (num < 300) price_band = 'luxury'
      else                price_band = 'super-premium'
    }
  }

  console.log(`[scraper] Parsed: name="${name}" distillery="${distillery}" country="${country}" type="${type}" abv="${abv}" price="${priceStr}" price_band="${price_band}"`)
  console.log(`[scraper] Facts: [${facts.join(', ')}]`)

  return {
    name:       name.replace(/(Whisky Review|Whisky:|—)/g, '').trim(),
    distillery: distilleryRaw,
    country:    country || null,
    region:     region || null,
    type,
    age:        ageStr ? parseInt(ageStr) : null,
    abv:        abv ? parseFloat(abv) : null,
    price_band,
    type,
    age:         null,
    abv:         abv ? parseFloat(abv) : null,
    price_band,
    status:      null,
  }
}

async function callGemma(prompt) {
  if (!GEMINI_KEY) return null
  try {
    const res = await fetch(GEMMA_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 300, responseMimeType: 'application/json' },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text) return null
    const match = text.match(/\{[\s\S]*\}/)
    return match ? JSON.parse(match[0]) : null
  } catch {
    return null
  }
}

function parseFlavorResponse(parsed) {
  if (!parsed) return {}
  const clamp = v => Math.min(5, Math.max(0, Math.round(Number(v) || 0)))
  return {
    nose:      (parsed.nose      || '').trim(),
    palate:    (parsed.palate    || '').trim(),
    dulzor:    clamp(parsed.dulzor),
    ahumado:   clamp(parsed.ahumado),
    cuerpo:    clamp(parsed.cuerpo),
    frutado:   clamp(parsed.frutado),
    especiado: clamp(parsed.especiado),
  }
}

async function main() {
  const url = process.argv[2]
  if (!url) {
    console.error('Usage: node scripts/scrape-whisky.js <distilld-url>')
    process.exit(1)
  }

  const data = await scrape(url)

  const { data: existing } = await sb
    .from('catalogue')
    .select('id, name')
    .ilike('name', data.name)
    .limit(1)

  if (existing?.length) {
    console.log(`[scraper] Already exists in catalogue: "${existing[0].name}" (id=${existing[0].id})`)
    process.exit(0)
  }

  if (GEMINI_KEY) {
    const parts = [data.name]
    if (data.distillery) parts.push(`by ${data.distillery}`)
    if (data.country)    parts.push(`from ${data.country}`)
    if (data.age)        parts.push(`aged ${data.age}`)
    if (data.abv)        parts.push(`at ${data.abv}%`)
    if (data.type)       parts.push(`style: ${data.type}`)

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

    console.log('[scraper] Calling Gemma for flavor profile…')
    const flavor = await callGemma(prompt)
    if (flavor) {
      Object.assign(data, parseFlavorResponse(flavor))
      data.status = true
    }
  }

  const { data: inserted, error } = await sb
    .from('catalogue')
    .insert([data])
    .select()
    .single()

  if (error) {
    console.error('[scraper] Insert failed:', error.message)
    process.exit(1)
  }

  console.log(`[scraper] ✓ Added to catalogue: "${inserted.name}" (id=${inserted.id})`)
}

main().catch(err => { console.error('[scraper] Error:', err.message); process.exit(1) })