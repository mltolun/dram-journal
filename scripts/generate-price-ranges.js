/**
 * generate-price-ranges.js
 *
 * Fetches real price data from Google Shopping for each whisky, then asks
 * Gemma 3 27B to synthesise a price_band from the actual results.
 * This grounds the AI in real market data instead of guessing from training.
 *
 * Flow per whisky:
 *   1. Scrape Google Shopping HTML → extract price mentions
 *   2. If prices found → pass them to Gemma to pick a sensible range
 *   3. If scrape fails / blocked → fall back to Gemma-only estimate
 *
 * Rate limit: max 15 RPM — default 4s sleep between whiskies.
 * Google scraping: one request per whisky, same cadence, no extra delay needed.
 *
 * Usage (local):
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GEMINI_KEY=... \
 *   node scripts/generate-price-ranges.js
 *
 * Optional env vars:
 *   BATCH_LIMIT   — max rows per run (default: 6100)
 *   SLEEP_MS      — ms between whiskies (default: 4000 = 15 RPM)
 *   START_OFFSET  — skip first N unprocessed rows, for resuming
 *   CURRENCY      — symbol used in output (default: €)
 *   REPRICE       — if 'true', re-processes rows where status IS NOT NULL
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY
const BATCH_LIMIT          = parseInt(process.env.BATCH_LIMIT  || '6100')
const SLEEP_MS             = parseInt(process.env.SLEEP_MS     || '4000')
const START_OFFSET         = parseInt(process.env.START_OFFSET || '0')
const CURRENCY             = process.env.CURRENCY              || '€'
const REPRICE              = process.env.REPRICE === 'true'

const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

// Rotate user agents to reduce the chance of blocks on long runs
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
let uaIndex = 0
const nextUA = () => USER_AGENTS[uaIndex++ % USER_AGENTS.length]

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  console.error('❌  Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or GEMINI_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Google Shopping scrape ────────────────────────────────────────────────────

async function scrapeGooglePrices(whisky) {
  const q   = [whisky.name, whisky.distillery].filter(Boolean).join(' ')
  const url = `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=shop&hl=en&gl=es`

  const res = await fetch(url, {
    headers: {
      'User-Agent':      nextUA(),
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept':          'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10_000),
  })

  if (!res.ok) throw new Error(`Google Shopping HTTP ${res.status}`)

  const html = await res.text()

  // Google Shopping renders prices in various span/div patterns.
  // We cast a wide net with a regex that catches "€ 89,95", "€89.95", "89,95 €" etc.
  const priceRe = /(?:€|EUR)\s*(\d{1,4}[.,]\d{2})|(\d{1,4}[.,]\d{2})\s*(?:€|EUR)/g
  const prices  = []
  let m

  while ((m = priceRe.exec(html)) !== null) {
    const raw  = (m[1] || m[2]).replace(',', '.')
    const val  = parseFloat(raw)
    if (!isNaN(val) && val >= 10 && val < 10000) prices.push(val)
  }

  // Deduplicate and take up to 8 distinct prices
  const unique = [...new Set(prices)].sort((a, b) => a - b).slice(0, 8)
  return unique
}

// ── Gemma prompt — grounded in real prices ───────────────────────────────────

function buildPrompt(whisky, scrapedPrices) {
  const parts = [whisky.name]
  if (whisky.distillery) parts.push(`by ${whisky.distillery}`)
  if (whisky.country)    parts.push(`from ${whisky.country}`)
  if (whisky.region)     parts.push(`(${whisky.region})`)
  if (whisky.age)        parts.push(`aged ${whisky.age}`)
  if (whisky.abv)        parts.push(`at ${whisky.abv}`)
  if (whisky.type)       parts.push(`style: ${whisky.type}`)

  const whiskyDesc = parts.join(', ')

  if (scrapedPrices.length > 0) {
    const formatted = scrapedPrices.map(p => `${CURRENCY}${p.toFixed(2)}`).join(', ')
    return `You are a whisky pricing expert. I fetched the following current retail prices from Google Shopping for "${whiskyDesc}":

${formatted}

Based on these real prices, return a price band that represents the typical retail range.
Use the lowest and highest realistic prices — ignore obvious outliers (e.g. single mini bottles or very rare auction prices far outside the cluster).

Respond ONLY with a JSON object, no markdown, no explanation:
{"price_band":"${CURRENCY}<low>–${CURRENCY}<high>"}

For a single price point or very tight range use: {"price_band":"~${CURRENCY}<price>"}
For open-ended luxury items: {"price_band":"${CURRENCY}300+"}
Example: {"price_band":"${CURRENCY}85–${CURRENCY}110"}`
  }

  // Fallback prompt when scraping returned nothing
  return `You are a whisky retail pricing expert. Estimate the typical retail price range in EUR for:
${whiskyDesc}.

Base your estimate on standard European retail prices (Spain, UK, Germany, France).
Reference bands:
  Budget       ${CURRENCY}20–40   (entry blends, young NAS)
  Mid-range    ${CURRENCY}40–80   (standard single malts)
  Premium      ${CURRENCY}80–150  (aged single malts, premium expressions)
  Luxury       ${CURRENCY}150–300 (rare/old/limited editions)
  Ultra-luxury ${CURRENCY}300+    (collectors, very rare)

Respond ONLY with a JSON object, no markdown, no explanation:
{"price_band":"${CURRENCY}<low>–${CURRENCY}<high>"}
For open-ended top prices: {"price_band":"${CURRENCY}300+"}`
}

// ── Gemma API call ────────────────────────────────────────────────────────────

async function callGemma(prompt) {
  const res = await fetch(GEMMA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
    }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemma API error ${res.status}: ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Parse Gemma response ──────────────────────────────────────────────────────

function parseResponse(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error('No JSON found in response')

  const parsed  = JSON.parse(match[0])
  const band    = (parsed.price_band || '').trim()
  if (!band)       throw new Error('Empty price_band in response')
  if (!/\d/.test(band)) throw new Error(`Unexpected format: "${band}"`)

  return band
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥃  Dram Journal — Price Band Generator (Google Shopping + Gemma)')
  console.log(`    Model      : ${GEMMA_MODEL}`)
  console.log(`    Batch limit: ${BATCH_LIMIT}`)
  console.log(`    Sleep      : ${SLEEP_MS / 1000}s between whiskies`)
  console.log(`    Offset     : ${START_OFFSET}`)
  console.log(`    Currency   : ${CURRENCY}`)
  console.log(`    Reprice    : ${REPRICE}`)
  console.log()

  const PAGE_SIZE = 1000
  let whiskies = []
  let from = START_OFFSET

  while (whiskies.length < BATCH_LIMIT) {
    const to = from + Math.min(PAGE_SIZE, BATCH_LIMIT - whiskies.length) - 1

    let query = sb
      .from('catalogue')
      .select('id, name, distillery, country, region, age, abv, type')
      .order('id', { ascending: true })
      .range(from, to)

    if (!REPRICE) query = query.is('status', null)

    const { data: page, error } = await query
    if (error) throw new Error(`Supabase query failed: ${error.message}`)
    if (!page?.length) break
    whiskies = whiskies.concat(page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  if (!whiskies.length) {
    console.log('✅  No unprocessed whiskies (status IS NULL). Use REPRICE=true to re-process all.')
    return
  }

  const { count: total } = await sb
    .from('catalogue')
    .select('*', { count: 'exact', head: true })

  console.log(`📋  Processing ${whiskies.length} whiskies (${total} total in catalogue)\n`)

  let succeeded  = 0
  let failed     = 0
  let scraped    = 0  // how many had real Google prices
  let fallbacked = 0  // how many fell back to Gemma-only

  for (let i = 0; i < whiskies.length; i++) {
    const whisky = whiskies[i]
    const pos    = START_OFFSET + i + 1
    process.stdout.write(`  [${pos}/${total}] ${whisky.name}… `)

    try {
      // Step 1: scrape Google Shopping
      let prices = []
      try {
        prices = await scrapeGooglePrices(whisky)
      } catch (scrapeErr) {
        // Non-fatal — fall through to Gemma-only
        process.stdout.write(`(scrape failed: ${scrapeErr.message}) `)
      }

      const source = prices.length > 0 ? `${prices.length} prices` : 'fallback'
      if (prices.length > 0) scraped++
      else fallbacked++

      // Step 2: ask Gemma to synthesise a band from real data (or estimate)
      const band = parseResponse(await callGemma(buildPrompt(whisky, prices)))

      // Step 3: save
      const { error: updateError } = await sb
        .from('catalogue')
        .update({ price_band: band, status: true })
        .eq('id', whisky.id)

      if (updateError) throw new Error(updateError.message)

      console.log(`✓  ${band}  (${source})`)
      succeeded++

    } catch (err) {
      console.log(`✗  ${err.message}`)
      await sb.from('catalogue').update({ status: false }).eq('id', whisky.id)
      failed++
    }

    if (i < whiskies.length - 1) {
      process.stdout.write(`     ⏱  waiting ${SLEEP_MS / 1000}s…\r`)
      await sleep(SLEEP_MS)
    }
  }

  console.log()
  console.log('✅  Done!')
  console.log(`    ✓ Succeeded   : ${succeeded}`)
  console.log(`      ↳ w/ real prices : ${scraped}`)
  console.log(`      ↳ Gemma fallback : ${fallbacked}`)
  console.log(`    ✗ Failed      : ${failed}`)

  if (failed > 0) {
    console.log(`\n⚠   ${failed} rows marked status=false — reset to NULL to retry.`)
  }

  const nextOffset = START_OFFSET + whiskies.length
  if (nextOffset < total) {
    console.log(`\n▶   Next run: START_OFFSET=${nextOffset}`)
  } else {
    console.log('\n🎉  All whiskies priced!')
  }
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
