import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent`

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function extractFact(html: string, label: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(escaped + '[\\s\\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)<\\/p>', 'i')
  const m  = html.match(re)
  return m ? decodeEntities(m[1].trim()) : ''
}

function extractDistillery(html: string): string {
  const re = /Distillery[\s\S]{0,120}?<p[^>]*class="h3"[^>]*>([^<]+)<\/p>/i
  const m = html.match(re)
  return m ? decodeEntities(m[1].trim()) : ''
}

function extractAllFacts(html: string): string[] {
  const re = /<p class="h3"[^>]*>([^<]+)<\/p>/g
  const matches: string[] = []
  let m
  while ((m = re.exec(html)) !== null) {
    matches.push(decodeEntities(m[1].trim()))
  }
  return matches
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const geminiKey       = Deno.env.get('GEMINI_KEY')!

  const sb              = createClient(supabaseUrl, serviceRoleKey)
  const GEMMA_URL_KEYED = `${GEMMA_URL}?key=${geminiKey}`

  let url: string
  try {
    const body = await req.json()
    url = body?.url
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url' }), {
      status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  console.log(`[scrape-whisky] Fetching: ${url}`)

  const html = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
  }).then(r => r.text())

  const rawName =
    html.match(/property="og:title"\s+content="([^"]+)"/)?.[1] ||
    html.match(/<title>([^<]+)/)?.[1]?.split('|')[0].trim() || ''
  const name = decodeEntities(rawName).replace(/(Whisky Review|Whisky:|—|<|>)/g, '').trim()

  const facts = extractAllFacts(html)
  const distilleryFromFacts = facts.find((v, i) => i > 0 && v !== 'Yes' && v !== 'No' && v !== 'Single Malt' && v !== 'Blended' && v !== 'Grain')

  const abv        = extractFact(html, 'ABV').replace('%', '') || ''
  const country    = extractFact(html, 'Country') || ''
  const typeStr    = extractFact(html, 'Type') || ''
  const distillery = extractDistillery(html) || distilleryFromFacts || ''
  const region     = extractFact(html, 'Region') || ''
  const ageStr     = extractFact(html, 'Age') || ''
  const priceMatch = html.match(/€(\d+)/)
  const priceStr   = priceMatch ? priceMatch[1] : ''

  let type = 'other'
  const lower = (name + ' ' + country + ' ' + typeStr).toLowerCase()
  if (lower.includes('japanese') || lower.includes('nippon') || country === 'Japan') type = 'japanese'
  else if (lower.includes('scotch') || lower.includes('speyside') || lower.includes('islay') ||
           lower.includes('highland') || lower.includes('lowland')) type = 'scotch'
  else if (lower.includes('bourbon') || lower.includes('tennessee') || country === 'United States') type = 'bourbon'
  else if (lower.includes('irish') || country === 'Ireland') type = 'irish'
  else if (typeStr && typeStr.toLowerCase().includes('blended')) type = 'japanese'

  let distilleryRaw = distillery || null
  if (!distilleryRaw) {
    const knownDistilleries = ['Hibiki', 'Yamazaki', 'Hakushu', 'Nikka', 'Macallan', 'Glenfiddich', 'Talisker', 'Lagavulin']
    for (const d of knownDistilleries) {
      if (name.includes(d)) { distilleryRaw = d; break }
    }
  }

  let price_band: string | null = null
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

  const data: Record<string, unknown> = {
    name:       name,
    distillery: distilleryRaw,
    country:    country || null,
    region:     region || null,
    type,
    age:        ageStr ? parseInt(ageStr) : null,
    abv:        abv ? parseFloat(abv) : null,
    price_band,
    status:     null,
  }

  console.log(`[scrape-whisky] Parsed: name="${name}" distillery="${distilleryRaw}" country="${country}" abv="${abv}"`)

  const { data: existing } = await sb
    .from('catalogue')
    .select('id, name')
    .ilike('name', name)
    .limit(1)

  if (existing?.length) {
    return new Response(JSON.stringify({ success: true, name, duplicate: true, id: existing[0].id }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  if (geminiKey) {
    const parts = [name]
    if (distilleryRaw) parts.push(`by ${distilleryRaw}`)
    if (country)       parts.push(`from ${country}`)
    if (ageStr)        parts.push(`aged ${ageStr}`)
    if (abv)           parts.push(`at ${abv}%`)
    if (type)          parts.push(`style: ${type}`)

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

    try {
      const gRes = await fetch(GEMMA_URL_KEYED, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 300, responseMimeType: 'application/json' },
        }),
      })
      const gData = await gRes.json()
      const text  = gData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (text) {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          const parsed = JSON.parse(match[0])
          const clamp = (v: number) => Math.min(5, Math.max(0, Math.round(v || 0)))
          Object.assign(data, {
            nose:      (parsed.nose      || '').trim(),
            palate:    (parsed.palate    || '').trim(),
            dulzor:    clamp(parsed.dulzor),
            ahumado:   clamp(parsed.ahumado),
            cuerpo:    clamp(parsed.cuerpo),
            frutado:   clamp(parsed.frutado),
            especiado: clamp(parsed.especiado),
          })
          data.status = true
        }
      }
    } catch (e) {
      console.error('[scrape-whisky] Gemma error:', e)
    }
  }

  const { data: inserted, error } = await sb
    .from('catalogue')
    .insert([data])
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    })
  }

  console.log(`[scrape-whisky] Added: "${inserted.name}" (id=${inserted.id})`)

  return new Response(JSON.stringify({ success: true, name: inserted.name, duplicate: false }), {
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
})
