/**
 * generate-price-ranges.js
 *
 * Fetches real price data from Master of Malt for each whisky, then asks
 * Gemma 3 27B to synthesise a price_band from the actual results.
 *
 * Scraping strategy (two-step, graceful fallback):
 *   1. Search page  — masterofmalt.com/search/?q=<name>
 *                     Extracts all prices from JSON-LD Product schema blocks
 *                     and any data-price / itemprop="price" attributes.
 *   2. Product page — if search returns a strong first hit, fetches that page
 *                     for a single authoritative price from its JSON-LD offer.
 *   3. Gemma-only   — if both scrape steps return nothing, falls back to AI estimate.
 *
 * Rate limit: 15 RPM max — 4s sleep between whiskies covers both the scrape
 * and the Gemma call within the same window.
 *
 * Usage (local):
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GEMINI_KEY=... \
 *   node scripts/generate-price-ranges.js
 *
 * Optional env vars:
 *   BATCH_LIMIT   — max rows per run (default: 6100)
 *   SLEEP_MS      — ms between whiskies (default: 4000 = 15 RPM)
 *   START_OFFSET  — skip first N rows, for resuming
 *   CURRENCY      — symbol used in output (default: £, MoM is GBP-native)
 *   REPRICE       — if 'true', re-processes rows where status IS NOT NULL
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY
const BATCH_LIMIT          = parseInt(process.env.BATCH_LIMIT  || '6100')
const SLEEP_MS             = parseInt(process.env.SLEEP_MS     || '4000')
const START_OFFSET         = parseInt(process.env.START_OFFSET || '0')
const CURRENCY             = process.env.CURRENCY              || '£'
const REPRICE              = process.env.REPRICE === 'true'

const MOM_BASE   = 'https://www.masterofmalt.com'
const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

const HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-GB,en;q=0.9',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  console.error('❌  Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or GEMINI_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── HTML fetch ────────────────────────────────────────────────────────────────

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(12_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`)
  return res.text()
}

// ── Price extraction from HTML ────────────────────────────────────────────────

/**
 * Extracts prices from a MoM HTML page using three methods in priority order:
 * 1. JSON-LD Product/Offer schema  → most reliable, structured
 * 2. data-price attributes          → MoM uses these on search result cards
 * 3. itemprop="price" microdata     → fallback microdata
 */
function extractPricesFromHtml(html) {
  const prices = new Set()

  // ── Method 1: JSON-LD ──────────────────────────────────────────────────────
  // MoM embeds <script type="application/ld+json"> blocks with Product schema
  const ldJsonRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let ldMatch
  while ((ldMatch = ldJsonRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(ldMatch[1])
      // Handle both single object and @graph arrays
      const items = data['@graph'] ? data['@graph'] : [data]
      for (const item of items) {
        if (!item) continue
        // Direct offers
        const offers = item.offers
          ? (Array.isArray(item.offers) ? item.offers : [item.offers])
          : []
        for (const offer of offers) {
          const price = parseFloat(offer?.price)
          if (!isNaN(price) && price >= 10 && price < 10000) prices.add(price)
        }
        // Nested offers.priceSpecification
        for (const offer of offers) {
          const ps = offer?.priceSpecification
          if (ps) {
            const psItems = Array.isArray(ps) ? ps : [ps]
            for (const p of psItems) {
              const price = parseFloat(p?.price)
              if (!isNaN(price) && price >= 10 && price < 10000) prices.add(price)
            }
          }
        }
      }
    } catch { /* malformed JSON-LD — skip */ }
  }

  // ── Method 2: data-price attributes ───────────────────────────────────────
  // MoM search cards use data-price="49.95" on product elements
  const dataPriceRe = /data-price="(\d+(?:\.\d+)?)"]/g
  let dpMatch
  while ((dpMatch = dataPriceRe.exec(html)) !== null) {
    const price = parseFloat(dpMatch[1])
    if (!isNaN(price) && price >= 10 && price < 10000) prices.add(price)
  }

  // ── Method 3: itemprop="price" microdata ──────────────────────────────────
  const microprice = /itemprop="price"[^>]*content="(\d+(?:\.\d+)?)"/g
  let mpMatch
  while ((mpMatch = microprice.exec(html)) !== null) {
    const price = parseFloat(mpMatch[1])
    if (!isNaN(price) && price >= 10 && price < 10000) prices.add(price)
  }

  return [...prices].sort((a, b) => a - b)
}

/**
 * Extracts the first product page URL from a MoM search results page.
 * MoM search result links follow: /whiskies/<distillery>/<slug>/
 */
function extractFirstProductUrl(html) {
  // Match the first whisky product link in search results
  const re = /href="(\/whisk(?:y|ies)\/[^"]+\/[^"]+\/)"/i
  const m = re.exec(html)
  return m ? MOM_BASE + m[1] : null
}

// ── Main scrape function ──────────────────────────────────────────────────────

async function scrapeMoMPrices(whisky) {
  // Build search query — name only is usually enough; distillery helps disambiguation
  const name       = whisky.name || ''
  const distillery = whisky.distillery || ''

  // If distillery name is already in the whisky name, don't duplicate it
  const queryParts = name.toLowerCase().includes(distillery.toLowerCase())
    ? [name]
    : [name, distillery]
  const query = queryParts.filter(Boolean).join(' ').trim()

  const searchUrl = `${MOM_BASE}/search/?q=${encodeURIComponent(query)}`

  // Step 1: search page
  const searchHtml = await fetchHtml(searchUrl)
  const searchPrices = extractPricesFromHtml(searchHtml)

  // Step 2: if search found a product link, fetch that page too for its JSON-LD
  // This gives us the authoritative single price for the exact matched product
  const productUrl = extractFirstProductUrl(searchHtml)
  let productPrices = []
  if (productUrl) {
    try {
      const productHtml = await fetchHtml(productUrl)
      productPrices = extractPricesFromHtml(productHtml)
    } catch { /* non-fatal */ }
  }

  // Merge, deduplicate, sort — product page price takes priority but all inform the range
  const allPrices = [...new Set([...productPrices, ...searchPrices])].sort((a, b) => a - b)

  return { prices: allPrices, productUrl }
}

// ── Gemma prompt ──────────────────────────────────────────────────────────────

function buildPrompt(whisky, prices, productUrl) {
  const parts = [whisky.name]
  if (whisky.distillery) parts.push(`by ${whisky.distillery}`)
  if (whisky.country)    parts.push(`from ${whisky.country}`)
  if (whisky.region)     parts.push(`(${whisky.region})`)
  if (whisky.age)        parts.push(`aged ${whisky.age}`)
  if (whisky.abv)        parts.push(`at ${whisky.abv}`)
  if (whisky.type)       parts.push(`style: ${whisky.type}`)

  const desc = parts.join(', ')

  if (prices.length > 0) {
    const formatted = prices.map(p => `${CURRENCY}${p.toFixed(2)}`).join(', ')
    const source = productUrl ? `Master of Malt (${productUrl})` : 'Master of Malt search'
    return `You are a whisky pricing expert. I fetched the following current retail prices from ${source} for "${desc}":

Prices found: ${formatted}

Return a price band representing the typical retail range in ${CURRENCY}.
- Use the main cluster of prices; ignore obvious outliers (e.g. tiny sample bottles under ${CURRENCY}15, or rare collector editions far above the cluster).
- If prices are very close together, use a tight range (e.g. ${CURRENCY}85–${CURRENCY}95).
- If there's only one price, use ~${CURRENCY}<price> format.

Respond ONLY with a JSON object, no markdown, no explanation:
{"price_band":"${CURRENCY}<low>–${CURRENCY}<high>"}

Examples:
{"price_band":"${CURRENCY}85–${CURRENCY}95"}
{"price_band":"~${CURRENCY}49"}
{"price_band":"${CURRENCY}300+"}`
  }

  // Fallback: no prices scraped — pure AI estimate
  return `You are a whisky retail pricing expert. Estimate the typical retail price range in GBP for:
${desc}.

Base your estimate on UK retail prices (Master of Malt, The Whisky Exchange, etc).
Reference bands:
  Budget       ${CURRENCY}20–40   (entry blends, young NAS)
  Mid-range    ${CURRENCY}40–80   (standard single malts)
  Premium      ${CURRENCY}80–150  (aged single malts, premium expressions)
  Luxury       ${CURRENCY}150–300 (rare/old/limited editions)
  Ultra-luxury ${CURRENCY}300+    (collectors, very rare)

Respond ONLY with a JSON object, no markdown, no explanation:
{"price_band":"${CURRENCY}<low>–${CURRENCY}<high>"}
For open-ended luxury: {"price_band":"${CURRENCY}300+"}`
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
    throw new Error(`Gemma ${res.status}: ${err.error?.message || res.statusText}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Parse Gemma response ──────────────────────────────────────────────────────

function parseResponse(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error('No JSON in response')
  const parsed = JSON.parse(match[0])
  const band = (parsed.price_band || '').trim()
  if (!band || !/\d/.test(band)) throw new Error(`Bad price_band: "${band}"`)
  return band
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥃  Dram Journal — Price Band Generator (Master of Malt + Gemma)')
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
    if (error) throw new Error(`Supabase: ${error.message}`)
    if (!page?.length) break
    whiskies = whiskies.concat(page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  if (!whiskies.length) {
    console.log('✅  No unprocessed whiskies. Use REPRICE=true to re-process all.')
    return
  }

  const { count: total } = await sb.from('catalogue').select('*', { count: 'exact', head: true })
  console.log(`📋  Processing ${whiskies.length} whiskies (${total} total in catalogue)\n`)

  let succeeded  = 0
  let failed     = 0
  let withPrices = 0
  let fallbacked = 0

  for (let i = 0; i < whiskies.length; i++) {
    const whisky = whiskies[i]
    const pos    = START_OFFSET + i + 1
    process.stdout.write(`  [${pos}/${total}] ${whisky.name}… `)

    try {
      // Step 1: scrape Master of Malt
      let prices = [], productUrl = null
      try {
        ;({ prices, productUrl } = await scrapeMoMPrices(whisky))
      } catch (scrapeErr) {
        process.stdout.write(`(scrape failed: ${scrapeErr.message}) `)
      }

      if (prices.length > 0) withPrices++
      else fallbacked++

      const source = prices.length > 0
        ? `${prices.length} price${prices.length > 1 ? 's' : ''} from MoM`
        : 'Gemma fallback'

      // Step 2: ask Gemma to synthesise a band
      const band = parseResponse(await callGemma(buildPrompt(whisky, prices, productUrl)))

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
  console.log(`    ✓ Succeeded      : ${succeeded}`)
  console.log(`      ↳ Real MoM prices : ${withPrices}`)
  console.log(`      ↳ Gemma fallback  : ${fallbacked}`)
  console.log(`    ✗ Failed         : ${failed}`)
  if (failed > 0) console.log(`\n⚠   ${failed} rows marked status=false — reset to NULL to retry.`)

  const nextOffset = START_OFFSET + whiskies.length
  if (nextOffset < total) console.log(`\n▶   Next run: START_OFFSET=${nextOffset}`)
  else console.log('\n🎉  All whiskies priced!')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })