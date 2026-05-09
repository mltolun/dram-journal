import { createClient } from '@supabase/supabase-js'
import https from 'https'
import http from 'http'
import { URL } from 'url'

const SUPABASE_URL         = process.env.SUPABASE_URL
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

function textBetween(html, start, end) {
  const idx = html.indexOf(start)
  if (idx === -1) return ''
  const from = idx + start.length
  const stop = html.indexOf(end, from)
  return stop === -1 ? '' : html.slice(from, stop).trim()
}

function getMetaContent(html, property) {
  const re = new RegExp(`<meta[^>]+(?:property|itemprop|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  const m  = html.match(re)
  if (m) return m[1]
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|itemprop|name)=["']${property}["']`, 'i')
  const m2 = html.match(re2)
  return m2 ? m2[1] : ''
}

async function scrape(url) {
  console.log(`[scraper] Fetching: ${url}`)
  const html = await httpGet(url)

  const name      = textBetween(html, '"og:title" content="', '"') ||
                    textBetween(html, '<title>', '</title>').split('|')[0].trim()
  const distillery = textBetween(html, '"og:title" content="', '"')
    ?.replace('Whisky Review:', '').replace('Whisky:', '').split('-')[0].trim() || ''
  const description = textBetween(html, 'itemprop="description" content="', '"') ||
                      textBetween(html, '"description" content="', '"')
  const priceStr = textBetween(html, 'itemprop="price" content="', '"') ||
                   textBetween(html, 'class="price"', '<').replace(/[^0-9.,]/g, '').trim()

  const abv       = textBetween(html, 'ABV:', '<').replace(/[^0-9.]/g, '') ||
                    textBetween(html, '"abv"', '"').replace(/[^0-9.]/g, '')
  const age       = textBetween(html, 'Age:', '<').replace(/[^0-9]/g, '') ||
                    textBetween(html, '"age"', '"').replace(/[^0-9]/g, '')
  const region    = textBetween(html, 'Region:', '<').trim() ||
                    textBetween(html, '"region"', '"').trim()
  const country   = textBetween(html, 'Country:', '<').trim() ||
                    getMetaContent(html, 'og:locale').split('_')[1] ||
                    textBetween(html, '"country"', '"').trim()

  let type = 'other'
  const lower = (name + ' ' + region + ' ' + description).toLowerCase()
  if (lower.includes('japanese') || lower.includes('nippon') || country === 'Japan') type = 'japanese'
  else if (lower.includes('scotch') || lower.includes('speyside') || lower.includes('islay') ||
           lower.includes('highland') || lower.includes('lowland') || region.toLowerCase().includes('scotland')) type = 'scotch'
  else if (lower.includes('bourbon') || lower.includes('tennessee') || country === 'United States') type = 'bourbon'
  else if (lower.includes('irish') || country === 'Ireland') type = 'irish'

  let price_band = null
  if (priceStr) {
    const num = parseFloat(priceStr.replace(',', '.'))
    if (!isNaN(num)) {
      if (num < 40)       price_band = 'budget'
      else if (num < 80)  price_band = 'mid-range'
      else if (num < 150) price_band = 'premium'
      else if (num < 300) price_band = 'luxury'
      else                 price_band = 'super-premium'
    }
  }

  return {
    name:        name.replace(/(Whisky Review|Whisky:|—)/g, '').trim(),
    distillery,
    country:     country || null,
    region:      region  || null,
    type,
    age:         age     ? parseInt(age) : null,
    abv:         abv     ? parseFloat(abv) : null,
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
    const data  = await res.json()
    const text  = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    if (!text)  return null
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
  console.log('[scraper] Parsed whisky:', data.name)
  console.log('[scraper] Fields:', JSON.stringify(data, null, 2))

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
    if (data.region)     parts.push(`(${data.region})`)
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
      console.log('[scraper] Flavor profile generated:', JSON.stringify(data, null, 2))
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