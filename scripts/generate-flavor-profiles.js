/**
 * generate-flavor-profiles.js
 *
 * Calls Gemma 3 27B via Google AI Studio to generate tasting notes and
 * flavor scores for every whisky in the catalogue table.
 *
 * Rate limit: max 15 RPM — default sleep of 4s between calls.
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
 *   node scripts/generate-flavor-profiles.js
 *
 * Optional env vars:
 *   BATCH_LIMIT  — max whiskies to process per run (default: 6100 = all)
 *   SLEEP_MS     — ms to wait between calls (default: 4000 = 15 RPM)
 *   START_OFFSET — skip first N unprocessed whiskies, for manual resuming
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY
const BATCH_LIMIT          = parseInt(process.env.BATCH_LIMIT  || '6100')
const SLEEP_MS             = parseInt(process.env.SLEEP_MS     || '4000')  // 15 RPM = 4s between calls
const START_OFFSET         = parseInt(process.env.START_OFFSET || '0')

const GEMMA_MODEL = 'gemma-4-31b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_KEY) {
  console.error('❌  Missing SUPABASE_URL, SUPABASE_SERVICE_KEY or GEMINI_KEY')
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

  return `You are an expert whisky taster. Provide tasting notes and flavor scores for:
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
}

// ── Gemma API call ────────────────────────────────────────────────────────────

async function callGemma(prompt) {
  const res = await fetch(GEMMA_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 300 },
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
  // Strip markdown fences if present
  const clean = text.replace(/```json|```/g, '').trim()

  // Extract JSON object
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in response')

  const parsed = JSON.parse(match[0])

  // Validate and clamp scores
  const clamp = (v) => Math.min(5, Math.max(0, Math.round(Number(v) || 0)))

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

// ── Sleep ─────────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥃  Dram Journal — Flavor Profile Generator')
  console.log(`    Model      : ${GEMMA_MODEL}`)
  console.log(`    Batch limit: ${BATCH_LIMIT}`)
  console.log(`    Sleep      : ${SLEEP_MS / 1000}s between calls`)
  console.log(`    Offset     : ${START_OFFSET}`)
  console.log()

  // Fetch whiskies to process — paginate in chunks of 1000 (Supabase row limit)
  const PAGE_SIZE = 1000
  let whiskies = []
  let from = START_OFFSET
  while (whiskies.length < BATCH_LIMIT) {
    const to = from + Math.min(PAGE_SIZE, BATCH_LIMIT - whiskies.length) - 1
    const { data: page, error } = await sb
      .from('catalogue')
      .select('id, name, distillery, country, region, age, abv, type')
      .is('status', null)
      .order('id', { ascending: true })
      .range(from, to)
    if (error) throw new Error(`Supabase query failed: ${error.message}`)
    if (!page?.length) break
    whiskies = whiskies.concat(page)
    if (page.length < PAGE_SIZE) break  // last page
    from += PAGE_SIZE
  }

  if (!whiskies.length) { console.log('✅  No whiskies to process.'); return }

  // Get total count for progress display
  const { count: total } = await sb
    .from('catalogue')
    .select('*', { count: 'exact', head: true })

  console.log(`📋  Processing ${whiskies.length} whiskies (offset ${START_OFFSET} of ${total} total)\n`)

  let succeeded = 0
  let failed    = 0

  for (let i = 0; i < whiskies.length; i++) {
    const whisky = whiskies[i]
    const pos    = START_OFFSET + i + 1
    process.stdout.write(`  [${pos}/${total}] ${whisky.name}… `)

    try {
      const prompt   = buildPrompt(whisky)
      const raw      = await callGemma(prompt)
      const profile  = parseResponse(raw)

      const { error: updateError } = await sb
        .from('catalogue')
        .update({
          ...profile,
          status: true,
        })
        .eq('id', whisky.id)

      if (updateError) throw new Error(updateError.message)

      console.log(`✓  nose: "${profile.nose.slice(0, 30)}…"`)
      succeeded++

    } catch (err) {
      console.log(`✗  ${err.message}`)

      // Mark as error so we can filter/retry later if needed
      await sb.from('catalogue')
        .update({ status: false })
        .eq('id', whisky.id)

      failed++
    }

    // Sleep between calls to stay within 15 RPM — skip after last item
    if (i < whiskies.length - 1) {
      process.stdout.write(`     ⏱  waiting ${SLEEP_MS / 1000}s…\r`)
      await sleep(SLEEP_MS)
    }
  }

  console.log()
  console.log('✅  Done!')
  console.log(`    ✓ Succeeded : ${succeeded}`)
  console.log(`    ✗ Failed    : ${failed}`)
  console.log()

  const nextOffset = START_OFFSET + whiskies.length
  if (nextOffset < total) {
    console.log(`▶   Next run: set START_OFFSET=${nextOffset} to continue`)
    console.log(`    Remaining: ${total - nextOffset} whiskies`)
  } else {
    console.log('🎉  All whiskies processed!')
  }
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
