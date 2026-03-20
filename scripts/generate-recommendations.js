/**
 * generate-recommendations.js
 *
 * Weekly cron script — run via GitHub Actions.
 * For each user with >= 3 journal entries, calls Gemini to generate
 * 5 personalised whisky recommendations and upserts them into
 * the `recommendations` table in Supabase.
 *
 * Required environment variables:
 *   SUPABASE_URL        — your project URL (same as VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_KEY — service role key (NOT the anon key)
 *   GEMINI_KEY          — Google Gemini API key (same as VITE_GEMINI_KEY)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY          = process.env.GEMINI_KEY

const GEMINI_MODEL = 'gemini-2.0-flash-lite'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`

const MIN_JOURNAL_ENTRIES = 3  // minimum entries before generating recommendations

// ─── Supabase client (service role — bypasses RLS) ────────────────────────────

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

// ─── Attr labels (mirrors constants.js) ──────────────────────────────────────

const ATTR_LABELS = {
  dulzor:    'Sweetness',
  ahumado:   'Smokiness',
  cuerpo:    'Body',
  frutado:   'Fruitiness',
  especiado: 'Spiciness',
}

const TYPE_LABELS = {
  scotch: 'Scotch', irish: 'Irish', bourbon: 'Bourbon',
  japanese: 'Japanese', other: 'Other',
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

function buildPrompt(journal, wishlist) {
  const journalLines = journal.map(w => {
    const attrs = Object.entries(ATTR_LABELS)
      .map(([key, label]) => `${label}: ${w[key] ?? 0}/5`)
      .join(', ')
    const rating = w.rating ? `Rating: ${w.rating}/5` : ''
    const notes  = w.notes  ? `Notes: "${w.notes}"`   : ''
    return [
      `- ${w.name} (${TYPE_LABELS[w.type] || w.type})`,
      `  Distillery: ${w.distillery || '—'}, Region: ${w.origin || '—'}, Age: ${w.age || '—'}`,
      `  Flavour profile — ${attrs}`,
      rating && `  ${rating}`,
      notes  && `  ${notes}`,
    ].filter(Boolean).join('\n')
  }).join('\n\n')

  const wishlistNames = wishlist.length > 0
    ? wishlist.map(w => `- ${w.name} (${w.distillery || '—'})`).join('\n')
    : '(none)'

  return `You are an expert whisky sommelier with deep knowledge of distilleries worldwide.

A whisky enthusiast has the following tasting journal:

${journalLines}

Their current wishlist (whiskies they already want to try — do NOT recommend these):
${wishlistNames}

Based on their flavour preferences, ratings, and tasting notes, recommend exactly 5 whiskies they have NOT tried yet and are NOT already on their wishlist. Focus on their highest-rated whiskies to understand what they love.

Respond ONLY with a valid JSON array — no explanation, no markdown, no backticks. Each item must have exactly these keys:
[
  {
    "name": "full whisky name including age statement",
    "distillery": "distillery name",
    "origin": "region and country e.g. Speyside, Scotland",
    "type": one of: "scotch" | "irish" | "bourbon" | "japanese" | "other",
    "age": "age statement e.g. 12 Years Old",
    "price": "approximate price range e.g. 35-50",
    "reason": "1-2 sentences explaining why this suits their taste profile",
    "dulzor": sweetness score 0-5 integer,
    "ahumado": smokiness score 0-5 integer,
    "cuerpo": body score 0-5 integer,
    "frutado": fruitiness score 0-5 integer,
    "especiado": spiciness score 0-5 integer
  }
]`
}

// ─── Gemini API call ──────────────────────────────────────────────────────────

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    const msg = data.error?.message || 'Gemini API error'
    throw new Error(`Gemini ${res.status}: ${msg}`)
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return text
}

function parseGeminiResponse(text) {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array found in Gemini response')
  try {
    return JSON.parse(match[0])
  } catch {
    throw new Error('Could not parse Gemini JSON response')
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥃 Starting weekly recommendations generation...')
  console.log(`   Model: ${GEMINI_MODEL}`)
  console.log(`   Min journal entries required: ${MIN_JOURNAL_ENTRIES}`)
  console.log('')

  // 1. Fetch all journal entries grouped by user
  const { data: allWhiskies, error: whiskiesError } = await sb
    .from('whiskies')
    .select('*')
    .order('created_at', { ascending: true })

  if (whiskiesError) throw new Error(`Failed to fetch whiskies: ${whiskiesError.message}`)

  // 2. Group by user_id
  const byUser = {}
  for (const w of allWhiskies) {
    if (!byUser[w.user_id]) byUser[w.user_id] = { journal: [], wishlist: [] }
    if (w.list === 'wishlist') {
      byUser[w.user_id].wishlist.push(w)
    } else {
      byUser[w.user_id].journal.push(w)
    }
  }

  const userIds = Object.keys(byUser)
  console.log(`   Found ${userIds.length} users total`)

  let processed = 0
  let skipped   = 0
  let errors    = 0

  // 3. Process each user
  for (const userId of userIds) {
    const { journal, wishlist } = byUser[userId]

    if (journal.length < MIN_JOURNAL_ENTRIES) {
      console.log(`   ⊘ User ${userId.slice(0, 8)}… — only ${journal.length} journal entries, skipping`)
      skipped++
      continue
    }

    console.log(`   ◎ User ${userId.slice(0, 8)}… — ${journal.length} journal, ${wishlist.length} wishlist`)

    try {
      const prompt = buildPrompt(journal, wishlist)
      const raw    = await callGemini(prompt)
      const recs   = parseGeminiResponse(raw)

      if (!Array.isArray(recs) || recs.length === 0) {
        throw new Error('Gemini returned empty or non-array recommendations')
      }

      // 4. Upsert into recommendations table
      const { error: upsertError } = await sb
        .from('recommendations')
        .upsert({
          user_id:      userId,
          payload:      recs,
          generated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (upsertError) throw new Error(`Supabase upsert failed: ${upsertError.message}`)

      console.log(`     ✓ ${recs.length} recommendations saved`)
      processed++

      // Small delay between users to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000))

    } catch (err) {
      console.error(`     ✗ Error: ${err.message}`)
      errors++
    }
  }

  console.log('')
  console.log(`✓ Done — ${processed} processed, ${skipped} skipped, ${errors} errors`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
