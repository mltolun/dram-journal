/**
 * generate-price-ranges.js
 *
 * Fills the existing `price_band` column in the catalogue table with an
 * AI-estimated retail price range (e.g. "€40–€60") using Gemma 3 27B via
 * Google AI Studio.  No schema changes required.
 *
 * Strategy:
 *   - Only processes rows where status IS NULL (skips already-processed ones).
 *   - Paginates in chunks of 1000, sleeps between API calls to stay under limits.
 *   - Run via GitHub Actions workflow_dispatch or locally; use START_OFFSET to resume.
 *
 * Rate limit: max 15 RPM — default sleep of 4s between calls.
 *
 * Usage (local):
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GEMINI_KEY=... \
 *   node scripts/generate-price-ranges.js
 *
 * Optional env vars:
 *   BATCH_LIMIT   — max rows to process per run (default: 6100)
 * *   SLEEP_MS      — ms between API calls (default: 4000 = 15 RPM)
 *   START_OFFSET  — skip first N unpriced rows, for manual resuming
 *   CURRENCY      — symbol prepended to ranges (default: €)
 *   REPRICE       — if 'true', also re-processes rows where status IS NOT NULL
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY
const BATCH_LIMIT          = parseInt(process.env.BATCH_LIMIT  || '6100')
const SLEEP_MS             = parseInt(process.env.SLEEP_MS     || '4000')  // 15 RPM = 4s between calls
const START_OFFSET         = parseInt(process.env.START_OFFSET || '0')
const CURRENCY             = process.env.CURRENCY              || '€'
const REPRICE              = process.env.REPRICE === 'true'

const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or GEMINI_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(whisky) {
  const parts = [whisky.name]
  if (whisky.distillery) parts.push(`by ${whisky.distillery}`)
  if (whisky.country)    parts.push(`from ${whisky.country}`)
  if (whisky.region)     parts.push(`(${whisky.region})`)
  if (whisky.age)        parts.push(`aged ${whisky.age}`)
  if (whisky.abv)        parts.push(`at ${whisky.abv}`)
  if (whisky.type)       parts.push(`style: ${whisky.type}`)

  return `You are a whisky retail pricing expert. Estimate the typical retail price range in EUR for:
${parts.join(', ')}.

Base your estimate on standard European retail prices (Spain, UK, Germany, France).
Reference bands:
  Budget       ${CURRENCY}20-40   (entry blends, young NAS)
  Mid-range    ${CURRENCY}40-80   (standard single malts)
  Premium      ${CURRENCY}80-150  (aged single malts, premium expressions)
  Luxury       ${CURRENCY}150-300 (rare/old/limited editions)
  Ultra-luxury ${CURRENCY}300+    (collectors, very rare)

Respond ONLY with a JSON object, no markdown, no explanation:
{"price_band":"${CURRENCY}<low>-${CURRENCY}<high>"}

For open-ended top prices: {"price_band":"${CURRENCY}300+"}
Examples:
{"price_band":"${CURRENCY}40-${CURRENCY}60"}
{"price_band":"${CURRENCY}120-${CURRENCY}180"}
{"price_band":"${CURRENCY}300+"}`
}

// ── Gemma API call ────────────────────────────────────────────────────────────

async function callGemma(prompt) {
  const res = await fetch(GEMMA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 60 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Gemma API error ${res.status}: ${err.error?.message || res.statusText}`)
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Parse response ────────────────────────────────────────────────────────────

function parseResponse(text) {
  const clean = text.replace(/```json|```/g, '').trim()
  const match = clean.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error('No JSON found in response')

  const parsed = JSON.parse(match[0])
  const band = (parsed.price_band || '').trim()
  if (!band) throw new Error('Empty price_band in response')
  if (!/\d/.test(band)) throw new Error(`Unexpected format: "${band}"`)

  return band
}

// ── Sleep ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Dram Journal - Price Band Generator')
  console.log(`  Model      : ${GEMMA_MODEL}`)
  console.log(`  Batch limit: ${BATCH_LIMIT}`)
  console.log(`  Sleep      : ${SLEEP_MS / 1000}s between calls`)
  console.log(`  Offset     : ${START_OFFSET}`)
  console.log(`  Currency   : ${CURRENCY}`)
  console.log(`  Reprice    : ${REPRICE}`)
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

    if (!REPRICE) {
      query = query.is('status', null)
    }

    const { data: page, error } = await query
    if (error) throw new Error(`Supabase query failed: ${error.message}`)
    if (!page?.length) break
    whiskies = whiskies.concat(page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  if (!whiskies.length) {
    console.log('No unprocessed whiskies found (status IS NULL). Use REPRICE=true to re-process all.')
    return
  }

  const { count: total } = await sb
    .from('catalogue')
    .select('*', { count: 'exact', head: true })

  console.log(`Processing ${whiskies.length} unpriced whiskies (${total} total in catalogue)\n`)

  let succeeded = 0
  let failed    = 0

  for (let i = 0; i < whiskies.length; i++) {
    const whisky = whiskies[i]
    const pos    = START_OFFSET + i + 1
    process.stdout.write(`  [${pos}] ${whisky.name}... `)

    try {
      const band = parseResponse(await callGemma(buildPrompt(whisky)))

      const { error: updateError } = await sb
        .from('catalogue')
        .update({ price_band: band, status: true })
        .eq('id', whisky.id)

      if (updateError) throw new Error(updateError.message)

      console.log(`OK  ${band}`)
      succeeded++

    } catch (err) {
      console.log(`ERR ${err.message}`)
      await sb.from('catalogue').update({ status: false }).eq('id', whisky.id)
      failed++
    }

    if (i < whiskies.length - 1) {
      process.stdout.write(`     waiting ${SLEEP_MS / 1000}s...\r`)
      await sleep(SLEEP_MS)
    }
  }

  console.log()
  console.log('Done!')
  console.log(`  Succeeded : ${succeeded}`)
  console.log(`  Failed    : ${failed}`)

  if (failed > 0) {
    console.log(`\n  ${failed} rows marked status=false — reset status to NULL to retry them.`)
  }

  const nextOffset = START_OFFSET + whiskies.length
  if (nextOffset < total) {
    console.log(`\n  Next run: START_OFFSET=${nextOffset}`)
  } else {
    console.log('\n  All whiskies priced!')
  }
}

main().catch(err => { console.error('ERROR:', err.message); process.exit(1) })
