/**
 * research-flavor-profiles.js
 *
 * Re-assesses catalogue flavour profiles from published tasting notes instead
 * of model memory:
 *   1. Exa search for each whisky (one call returns ranked results with page text)
 *   2. Gemini scores the profile using ONLY those page excerpts, citing source ids
 *   3. A profile is written only when it cites real sources and is confident enough;
 *      otherwise the existing scores are kept and the row is marked as researched.
 *
 * Every overwritten profile is copied to catalogue.flavor_previous first.
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_KEY, EXA_API_KEY
 * Optional env:
 *   BATCH_LIMIT         whiskies per run (default 100)
 *   RESEARCH_AFTER_DAYS re-research rows older than this (default 90)
 *   MIN_CONFIDENCE      0-1 threshold to overwrite (default 0.6)
 *   SINGLE_ID           process one catalogue id only
 *   DRY_RUN             "true" prints decisions without writing
 */

import { createClient } from '@supabase/supabase-js'
import { createExaClient, QuotaError } from './lib/exa.js'
import {
  buildSearchQuery, filterSources, buildExtractionPrompt, parseExtraction,
  decideUpdate, toCatalogueUpdate, toResearchedNoChange,
} from './lib/flavor.js'

const env = process.env
const SUPABASE_URL         = env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = env.GEMINI_KEY
const EXA_API_KEY          = env.EXA_API_KEY
const BATCH_LIMIT          = parseInt(env.BATCH_LIMIT || '100', 10)
const RESEARCH_AFTER_DAYS  = parseInt(env.RESEARCH_AFTER_DAYS || '90', 10)
const MIN_CONFIDENCE       = parseFloat(env.MIN_CONFIDENCE || '0.6')
const SINGLE_ID            = env.SINGLE_ID ? parseInt(env.SINGLE_ID, 10) : null
const DRY_RUN              = env.DRY_RUN === 'true'

const GEMINI_MODEL    = 'gemini-3.8-flash'
const GEMINI_SLEEP_MS = 1500

const COLUMNS = 'id, name, distillery, country, region, type, age, abv, nose, palate, ' +
  'dulzor, ahumado, cuerpo, frutado, especiado, flavor_researched_at'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GEMINI_KEY || !EXA_API_KEY) {
  console.error('[error] Missing SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_KEY or EXA_API_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
const exa = createExaClient({ apiKey: EXA_API_KEY })

async function askGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (res.status === 429) throw new QuotaError('Gemini rate limit / quota exceeded')
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function loadBatch(nowIso) {
  if (SINGLE_ID) {
    const { data, error } = await sb.from('catalogue').select(COLUMNS).eq('id', SINGLE_ID)
    if (error) throw error
    return data || []
  }
  const cutoff = new Date(Date.now() - RESEARCH_AFTER_DAYS * 86_400_000).toISOString()
  const { data, error } = await sb
    .from('catalogue')
    .select(COLUMNS)
    .or(`flavor_researched_at.is.null,flavor_researched_at.lt."${cutoff}"`)
    .order('flavor_researched_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_LIMIT)
  if (error) throw error
  return data || []
}

async function save(w, patch) {
  if (DRY_RUN) return
  const { error } = await sb.from('catalogue').update(patch).eq('id', w.id)
  if (error) throw error
}

async function researchOne(w, nowIso) {
  const results = await exa.search(buildSearchQuery(w))
  const sources = filterSources(results)

  if (sources.length === 0) {
    await save(w, toResearchedNoChange({ confidence: null, sources: [] }, nowIso))
    return { outcome: 'no-sources' }
  }

  const raw = await askGemini(buildExtractionPrompt(w, sources))
  await sleep(GEMINI_SLEEP_MS)
  const x = parseExtraction(raw, sources)
  const decision = decideUpdate(x, { minConfidence: MIN_CONFIDENCE })

  if (decision.apply) {
    await save(w, toCatalogueUpdate(x, w, nowIso))
    return { outcome: 'updated', x, scores: x.scores }
  }
  await save(w, toResearchedNoChange(x, nowIso))
  return { outcome: 'kept', why: decision.why, x }
}

async function main() {
  console.log('[research] Dram Journal — web-grounded flavour profiles')
  console.log(`    batch=${BATCH_LIMIT} reresearch_after=${RESEARCH_AFTER_DAYS}d min_confidence=${MIN_CONFIDENCE} dry_run=${DRY_RUN}`)

  const nowIso = new Date().toISOString()
  const rows = await loadBatch(nowIso)
  console.log(`    ${rows.length} whisky(ies) to research\n`)

  const tally = { updated: 0, kept: 0, 'no-sources': 0, error: 0 }

  for (const [i, w] of rows.entries()) {
    const label = `[${i + 1}/${rows.length}] #${w.id} ${w.name}`
    try {
      const r = await researchOne(w, new Date().toISOString())
      tally[r.outcome]++
      if (r.outcome === 'updated') {
        console.log(`${label}\n    ✓ updated (confidence ${r.x.confidence}) ${JSON.stringify(r.scores)}\n    sources: ${r.x.sources.map((s) => s.url).join(' ')}`)
      } else if (r.outcome === 'kept') {
        console.log(`${label}\n    · kept existing profile: ${r.why}`)
      } else {
        console.log(`${label}\n    · no usable sources found`)
      }
    } catch (err) {
      if (err instanceof QuotaError) {
        console.error(`\n[research] stopping: ${err.message}. Remaining rows are picked up next run.`)
        break
      }
      tally.error++
      console.error(`${label}\n    ✗ ${err.message}`)
      // Mark it so one bad row can't block the queue; it is retried after RESEARCH_AFTER_DAYS.
      await save(w, toResearchedNoChange(null, new Date().toISOString())).catch(() => {})
    }
  }

  console.log('\n[research] done:', JSON.stringify(tally))
}

main().catch((err) => {
  console.error('[research] fatal:', err)
  process.exit(1)
})
