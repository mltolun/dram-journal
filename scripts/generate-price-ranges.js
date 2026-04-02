/**
 * generate-price-ranges.js
 *
 * Asks Gemma 3 27B to estimate a typical retail price band for every
 * whisky in the catalogue table, based on its own knowledge of UK retail prices.
 *
 * Rate limit: 12 RPM max — 5s sleep between calls.
 * Run manually via GitHub Actions workflow_dispatch — each run picks up
 * where the last one left off (processes rows where status IS NULL).
 *
 * status column (boolean):
 *   NULL  = not yet processed — picked up by this cron
 *   true  = completed successfully
 *   false = last attempt failed (retry by resetting status to NULL)
 *
 * Usage (local):
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... GEMINI_KEY=... \
 *   node scripts/generate-price-ranges.js
 *
 * Optional env vars:
 *   BATCH_LIMIT   — max rows per run (default: 6100)
 *   SLEEP_MS      — ms between calls (default: 5000 = 12 RPM)
 *   START_OFFSET  — skip first N rows, for resuming
 *   CURRENCY      — symbol used in output (default: €)
 *   REPRICE       — if 'true', re-processes rows where status IS NOT NULL
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY
const BATCH_LIMIT          = parseInt(process.env.BATCH_LIMIT  || '6100')
const SLEEP_MS             = parseInt(process.env.SLEEP_MS     || '5000')
const START_OFFSET         = parseInt(process.env.START_OFFSET || '0')
const CURRENCY             = process.env.CURRENCY              || '€'
const REPRICE              = process.env.REPRICE === 'true'

const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  console.error('❌  Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or GEMINI_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(whisky) {
  const parts = [whisky.name]
  if (whisky.distillery) parts.push(whisky.distillery)
  if (whisky.region)     parts.push(whisky.region)
  if (whisky.country)    parts.push(whisky.country)
  if (whisky.age)        parts.push(whisky.age)
  const desc = parts.filter(Boolean).join(', ')

  // Seed a plausible range from known attributes so Gemma adjusts rather than invents
  const age  = parseInt(whisky.age) || 0
  const type = (whisky.type || '').toLowerCase()
  let seed
  if (type === 'bourbon')   seed = `${CURRENCY}30–${CURRENCY}60`
  else if (age >= 18)       seed = `${CURRENCY}120–${CURRENCY}180`
  else if (age >= 12)       seed = `${CURRENCY}50–${CURRENCY}80`
  else                      seed = `${CURRENCY}35–${CURRENCY}55`

  return `{"price_band":"${seed}"}
// ${desc} — output only the JSON above with price_band corrected to the real UK retail range.`
}

// ── Gemma API call ────────────────────────────────────────────────────────────

async function callGemma(prompt) {
  const res = await fetch(GEMMA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = err.error?.message || res.statusText
    console.error(`[Gemma] HTTP ${res.status} — ${msg}`, {
      model:  GEMMA_MODEL,
      status: res.status,
      detail: err.error ?? null,
    })
    if (res.status === 429) throw new Error(`Rate limit / quota exceeded (${res.status})`)
    if (res.status === 503 || res.status === 500) throw new Error(`Model unavailable (${res.status}) — ${msg}`)
    throw new Error(`Gemma ${res.status}: ${msg}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  if (!text) {
    console.warn('[Gemma] Empty response — full payload:', JSON.stringify(data, null, 2))
  } else {
    process.stdout.write(`[raw: ${text.trim().slice(0, 80)}] `)
  }
  return text
}

// ── Parse response ────────────────────────────────────────────────────────────

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
  console.log('🥃  Dram Journal — Price Band Generator (Gemma)')
  console.log(`    Model      : ${GEMMA_MODEL}`)
  console.log(`    Batch limit: ${BATCH_LIMIT}`)
  console.log(`    Sleep      : ${SLEEP_MS / 1000}s between calls`)
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

  let succeeded = 0
  let failed    = 0

  for (let i = 0; i < whiskies.length; i++) {
    const whisky = whiskies[i]
    const pos    = START_OFFSET + i + 1
    process.stdout.write(`  [${pos}/${total}] ${whisky.name}… `)

    try {
      // Ask Gemma to estimate the price band (1 retry on timeout)
      let band
      try {
        band = parseResponse(await callGemma(buildPrompt(whisky)))
      } catch (gemmaErr) {
        if (gemmaErr.name === 'TimeoutError' || gemmaErr.message?.includes('timeout') || gemmaErr.message?.includes('aborted')) {
          console.warn('\n     ⚠  Gemma timeout, retrying once…')
          await sleep(3000)
          band = parseResponse(await callGemma(buildPrompt(whisky)))
        } else {
          throw gemmaErr
        }
      }

      const { error: updateError } = await sb
        .from('catalogue')
        .update({ price_band: band, status: true })
        .eq('id', whisky.id)
      if (updateError) throw new Error(updateError.message)

      console.log(`✓  ${band}`)
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
  console.log(`    ✓ Succeeded : ${succeeded}`)
  console.log(`    ✗ Failed    : ${failed}`)
  if (failed > 0) console.log(`\n⚠   ${failed} rows marked status=false — reset to NULL to retry.`)

  const nextOffset = START_OFFSET + whiskies.length
  if (nextOffset < total) console.log(`\n▶   Next run: START_OFFSET=${nextOffset}`)
  else console.log('\n🎉  All whiskies priced!')
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
