/**
 * generate-recommendations.js
 *
 * Weekly cron script — run via GitHub Actions every Monday.
 *
 * For each user with >= 3 journal entries:
 *   1. Calls Gemma 3 27B to generate 5 personalised whisky recommendations.
 *   2. Matches each recommendation against the catalogue (fuzzy name + distillery).
 *   3. Upserts them into the `recommendations` table.
 *   4. Fetches activity from people the user follows (last 7 days).
 *   5. Sends a combined "Weekly Update" email: recommendations + follower activity.
 *
 * Required environment variables:
 *   SUPABASE_URL         — your project URL
 *   SUPABASE_SERVICE_KEY — service role key (NOT the anon key)
 *   GEMINI_KEY           — Google AI API key (used for both Gemini and Gemma)
 *   RESEND_API_KEY       — Resend API key
 *   EMAIL_FROM           — verified sender address
 */

import { createClient } from '@supabase/supabase-js'
import { sendWeeklyEmail } from './send-recommendations-email.js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY           = process.env.GEMINI_KEY
const SEND_EMAILS          = process.env.SEND_EMAILS !== 'false'

const GEMMA_MODEL = 'gemma-3-27b-it'
const GEMMA_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMMA_MODEL}:generateContent?key=${GEMINI_KEY}`

const MIN_JOURNAL_ENTRIES = 3

// ─── Supabase client (service role — bypasses RLS) ────────────────────────────

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
})

// ─── Attr labels ─────────────────────────────────────────────────────────────

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

function filterCatalogueForUser(catalogue, journal, wishlist) {
  // Exclude whiskies the user already has (journal + wishlist)
  const triedNames = new Set([
    ...journal.map(w => w.name?.toLowerCase().trim()),
    ...wishlist.map(w => w.name?.toLowerCase().trim()),
  ])
  const triedIds = new Set([
    ...journal.map(w => w.catalogue_id).filter(Boolean),
    ...wishlist.map(w => w.catalogue_id).filter(Boolean),
  ])

  const available = catalogue.filter(c =>
    !triedNames.has(c.name?.toLowerCase().trim()) && !triedIds.has(c.id)
  )

  // Determine the user's preferred types from their journal (weighted by rating)
  const typeScores = {}
  for (const w of journal) {
    if (w.type) typeScores[w.type] = (typeScores[w.type] || 0) + (w.rating || 3)
  }
  const topTypes = Object.entries(typeScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  // Keep entries matching preferred types first, then fill up to MAX_CATALOGUE
  const MAX_CATALOGUE = 50
  const preferred = available.filter(c => topTypes.includes(c.type))
  const others    = available.filter(c => !topTypes.includes(c.type))

  // Shuffle each group so we don't always send the same subset
  const shuffle = arr => arr.sort(() => Math.random() - 0.5)
  const subset  = [...shuffle(preferred), ...shuffle(others)].slice(0, MAX_CATALOGUE)

  console.log(`     catalogue: ${available.length} available after exclusions, ${subset.length} sent to model (top types: ${topTypes.join(', ') || 'any'})`)
  return subset
}

function buildPrompt(journal, wishlist, catalogue) {
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

  const filtered = filterCatalogueForUser(catalogue, journal, wishlist)
  const catalogueLines = filtered.length > 0
    ? filtered.map(c => `- ${c.name} | ${c.distillery || '—'} | ${c.type || '—'} | ${c.origin || c.country || '—'}`).join('\n')
    : '(no catalogue available)'

  return `You are an expert whisky sommelier with deep knowledge of distilleries worldwide.

A whisky enthusiast has the following tasting journal:

${journalLines}

Their current wishlist (whiskies they already want to try — do NOT recommend these):
${wishlistNames}

IMPORTANT: You MUST choose recommendations exclusively from the following catalogue. Do not invent whiskies not on this list. Use the EXACT name and distillery as written in the catalogue.

Available catalogue (name | distillery | type | region):
${catalogueLines}

Based on their flavour preferences, ratings, and tasting notes, recommend exactly 3 whiskies from the catalogue above that they have NOT tried yet and are NOT already on their wishlist. Focus on their highest-rated whiskies to understand what they love.

Respond ONLY with a valid JSON array — no explanation, no markdown, no backticks. Use the exact name and distillery from the catalogue. Each item must have exactly these keys:
[
  {
    "name": "exact name from catalogue",
    "distillery": "exact distillery from catalogue",
    "origin": "region and country e.g. Speyside, Scotland",
    "type": one of: "scotch" | "irish" | "bourbon" | "japanese" | "other",
    "age": "age statement e.g. 12 Years Old",
    "price": "approximate price range in local currency e.g. 35-50 USD, 30-45 EUR, 35-50 GBP",
    "reason": "1-2 sentences explaining why this suits their taste profile",
    "dulzor": sweetness score 0-5 integer,
    "ahumado": smokiness score 0-5 integer,
    "cuerpo": body score 0-5 integer,
    "frutado": fruitiness score 0-5 integer,
    "especiado": spiciness score 0-5 integer
  }
]`
}

// ─── Gemma 3 27B API call (via Google AI) ────────────────────────────────────

async function callGemma(prompt) {
  const res = await fetch(GEMMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`Gemma ${res.status}: ${data.error?.message || 'API error'}`)

  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function parseGemmaResponse(text) {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No JSON array found in Gemma response')
  try {
    return JSON.parse(match[0])
  } catch {
    throw new Error('Could not parse Gemma JSON response')
  }
}

// ─── Follower activity (last 7 days) ─────────────────────────────────────────

async function fetchFollowerActivity(userId) {
  // Find accepted subscriptions where this user is the follower
  const { data: subs, error: subsError } = await sb
    .from('subscriptions')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('status', 'accepted')

  if (subsError) {
    console.warn(`     ⚠ Could not fetch subscriptions: ${subsError.message}`)
    return []
  }
  if (!subs?.length) return []

  const followingIds = subs.map(s => s.following_id)
  console.log(`     👁 Following ${followingIds.length} user(s), checking their activity...`)

  // Fetch activity from those users in the last 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: activity, error: actError } = await sb
    .from('activity_feed')
    .select('*')
    .in('user_id', followingIds)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20)

  if (actError) {
    console.warn(`     ⚠ Could not fetch activity_feed: ${actError.message}`)
    return []
  }

  console.log(`     👁 Found ${activity?.length ?? 0} activity item(s) in the last 7 days`)
  return activity || []
}

// ─── Build email map: user_id → email ────────────────────────────────────────

async function buildEmailMap(userIds) {
  if (!userIds.length) return {}
  const { data: { users }, error } = await sb.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw new Error(`Failed to fetch users: ${error.message}`)

  const map = {}
  for (const u of users) {
    if (u.email && userIds.includes(u.id)) map[u.id] = u.email
  }
  return map
}

// ─── Catalogue fallback for users with few journal entries ───────────────────

function parsePriceBandAvg(priceBand) {
  if (!priceBand) return null
  const nums = priceBand.match(/\d+/g)?.map(Number)
  if (!nums?.length) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function selectRandomCatalogueRecs(catalogue, journal, wishlist, count = 5) {
  const triedNames = new Set([
    ...journal.map(w => w.name?.toLowerCase().trim()),
    ...wishlist.map(w => w.name?.toLowerCase().trim()),
  ])
  const triedIds = new Set([
    ...journal.map(w => w.catalogue_id).filter(Boolean),
    ...wishlist.map(w => w.catalogue_id).filter(Boolean),
  ])

  const available = catalogue.filter(c =>
    !triedNames.has(c.name?.toLowerCase().trim()) && !triedIds.has(c.id)
  )

  // Prefer whiskies in the €35–€70 range (centred around €50)
  const around50 = available.filter(c => {
    const avg = parsePriceBandAvg(c.price_band)
    return avg !== null && avg >= 35 && avg <= 70
  })

  const pool = around50.length >= count ? around50 : available
  const shuffled = [...pool].sort(() => Math.random() - 0.5)

  return shuffled.slice(0, count).map(c => ({
    name:        c.name,
    distillery:  c.distillery || '—',
    origin:      [c.region, c.country].filter(Boolean).join(', '),
    type:        c.type || 'other',
    age:         c.age  || null,
    price:       c.price_band || null,
    reason:      'A well-regarded whisky around the €50 mark — a great bottle to explore and start building your tasting journal.',
    dulzor:      c.dulzor    ?? 0,
    ahumado:     c.ahumado   ?? 0,
    cuerpo:      c.cuerpo    ?? 0,
    frutado:     c.frutado   ?? 0,
    especiado:   c.especiado ?? 0,
    catalogue_id: c.id,
    photo_url:   c.photo_url ?? null,
  }))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥃 Starting weekly update generation...')
  console.log(`   Model: ${GEMMA_MODEL}`)
  console.log(`   Min journal entries for AI recs: ${MIN_JOURNAL_ENTRIES} (else catalogue fallback ~€50)`)
  console.log(`   Emails enabled: ${SEND_EMAILS}`)
  console.log('')

  // 1. Fetch all auth users to get email addresses
  const { data: { users: allUsers }, error: usersError } = await sb.auth.admin.listUsers({ perPage: 1000 })
  if (usersError) throw new Error(`Failed to fetch users: ${usersError.message}`)

  const emailByUserId = {}
  for (const u of allUsers) {
    if (u.email) emailByUserId[u.id] = u.email
  }
  console.log(`   Fetched emails for ${Object.keys(emailByUserId).length} users`)

  // 2. Fetch all journal entries grouped by user
  const { data: allWhiskies, error: whiskiesError } = await sb
    .from('whiskies')
    .select('*')
    .order('created_at', { ascending: true })

  if (whiskiesError) throw new Error(`Failed to fetch whiskies: ${whiskiesError.message}`)

  // 3. Group by user_id
  const byUser = {}
  for (const w of allWhiskies) {
    if (!byUser[w.user_id]) byUser[w.user_id] = { journal: [], wishlist: [] }
    if (w.list === 'wishlist') {
      byUser[w.user_id].wishlist.push(w)
    } else {
      byUser[w.user_id].journal.push(w)
    }
  }

  const userIds = Object.keys(emailByUserId)
  console.log(`   Found ${Object.keys(byUser).length} users with journal entries`)
  console.log(`   Total users to process: ${userIds.length}`)
  console.log('')

  // 3b. Fetch catalogue entries for recommendation grounding
  const { data: catalogue, error: catalogueError } = await sb
    .from('catalogue')
    .select('id, name, distillery, type, country, region, photo_url, price_band, age, dulzor, ahumado, cuerpo, frutado, especiado')
    .order('name', { ascending: true })

  if (catalogueError) {
    console.warn('   ⚠ Could not fetch catalogue, recommendations will be ungrounded:', catalogueError.message)
  }
  const catalogueList = catalogue || []
  console.log(`   Catalogue loaded: ${catalogueList.length} entries`)
  console.log('')

  let processed = 0
  let errors    = 0

  // 4. Process each user
  for (const userId of userIds) {
    const { journal = [], wishlist = [] } = byUser[userId] || {}
    const userEmail = emailByUserId[userId]

    const hasEnoughEntries = journal.length >= MIN_JOURNAL_ENTRIES
    console.log(`   ◎ User ${userId.slice(0, 8)}… — ${journal.length} journal, ${wishlist.length} wishlist${hasEnoughEntries ? '' : ' (catalogue fallback)'}`)

    try {
      let enriched
      const generatedAt = new Date().toISOString()

      if (hasEnoughEntries) {
        // 5a. Generate recommendations via Gemma 3 27B
        const prompt = buildPrompt(journal, wishlist, catalogueList)
        const raw    = await callGemma(prompt)
        const recs   = parseGemmaResponse(raw)

        if (!Array.isArray(recs) || recs.length === 0) {
          throw new Error('Gemma returned empty or non-array recommendations')
        }
        // Cap at 3 regardless of what the model returns
        const recsSliced = recs.slice(0, 3)

        // Enrich recommendations with catalogue photo_url + catalogue_id.
        // Since Gemma is now prompted to use exact catalogue names, Pass 1 should
        // hit most of the time. Passes 2-4 are safety nets for minor deviations.
        enriched = await Promise.all(recsSliced.map(async (rec) => {
          const recName = rec.name.trim()
          const recDist = (rec.distillery || '').toLowerCase().trim()

          // Pass 1: exact name + distillery (case-insensitive)
          const { data: exact } = await sb
            .from('catalogue')
            .select('id, name, distillery, photo_url')
            .ilike('name', recName)
            .ilike('distillery', rec.distillery || '')
            .maybeSingle()

          if (exact) {
            console.log(`     ✓ catalogue match (exact): ${rec.name}`)
            return { ...rec, name: exact.name, distillery: exact.distillery, catalogue_id: exact.id, photo_url: exact.photo_url }
          }

          // Pass 2: name contains wildcard match (handles suffix differences)
          const nameWords = recName.split(' ').filter(w => w.length > 2)
          const { data: fuzzyRows } = await sb
            .from('catalogue')
            .select('id, name, distillery, photo_url')
            .ilike('name', `%${nameWords.join('%')}%`)

          if (fuzzyRows?.length) {
            const best = fuzzyRows.find(
              r => r.distillery?.toLowerCase().trim() === recDist
            ) || fuzzyRows[0]
            console.log(`     ~ catalogue match (fuzzy name): ${rec.name} → ${best.name}`)
            return { ...rec, name: best.name, distillery: best.distillery, catalogue_id: best.id, photo_url: best.photo_url }
          }

          // Pass 3: distillery match only — if only one entry exists for this distillery
          if (recDist) {
            const { data: distRows } = await sb
              .from('catalogue')
              .select('id, name, distillery, photo_url')
              .ilike('distillery', rec.distillery || '')

            if (distRows?.length === 1) {
              console.log(`     ~ catalogue match (distillery only): ${rec.name} → ${distRows[0].name}`)
              return { ...rec, name: distRows[0].name, distillery: distRows[0].distillery, catalogue_id: distRows[0].id, photo_url: distRows[0].photo_url }
            }
          }

          console.warn(`     ✗ no catalogue match: ${rec.name} (${rec.distillery})`)
          return { ...rec, catalogue_id: null, photo_url: null }
        }))

        console.log(`     ✓ ${enriched.length} AI recommendations saved`)
      } else {
        // 5b. Fallback: pick 5 random whiskies ~€50 from the catalogue
        enriched = selectRandomCatalogueRecs(catalogueList, journal, wishlist)
        console.log(`     ✓ ${enriched.length} catalogue recommendations selected (~€50)`)
      }

      // Post-enrichment safety check: remove anything the user already has,
      // in case the AI ignored the catalogue filter or fuzzy matching resolved
      // to a whisky already in their journal/wishlist.
      const journalCatalogueIds = new Set([
        ...journal.map(w => w.catalogue_id).filter(Boolean),
        ...wishlist.map(w => w.catalogue_id).filter(Boolean),
      ])
      const journalNames = new Set([
        ...journal.map(w => w.name?.toLowerCase().trim()),
        ...wishlist.map(w => w.name?.toLowerCase().trim()),
      ])
      const before = enriched.length
      enriched = enriched.filter(r =>
        (!r.catalogue_id || !journalCatalogueIds.has(r.catalogue_id)) &&
        !journalNames.has(r.name?.toLowerCase().trim())
      )
      if (enriched.length < before) {
        console.warn(`     ⚠ Post-filter removed ${before - enriched.length} recommendation(s) already in user's journal/wishlist`)
      }

      // 6. Upsert recommendations
      const { error: upsertError } = await sb
        .from('recommendations')
        .upsert({
          user_id:      userId,
          payload:      enriched,
          generated_at: generatedAt,
        }, { onConflict: 'user_id' })

      if (upsertError) throw new Error(`Supabase upsert failed: ${upsertError.message}`)

      // 7. Fetch follower activity for this user (last 7 days)
      const followerActivity = await fetchFollowerActivity(userId)

      // Build author email map for display names in the email
      const authorIds = [...new Set(followerActivity.map(a => a.user_id))]
      const authorEmailMap = await buildEmailMap(authorIds)

      if (followerActivity.length > 0) {
        console.log(`     👁 ${followerActivity.length} follower activity items`)
      }

      // 8. Send combined weekly email
      if (SEND_EMAILS && userEmail) {
        try {
          await sendWeeklyEmail(userEmail, enriched, followerActivity, authorEmailMap, generatedAt)
          console.log(`     ✉ Email sent to ${userEmail}`)
        } catch (emailErr) {
          console.error(`     ⚠ Email failed for ${userEmail}: ${emailErr.message}`)
        }
      } else if (SEND_EMAILS && !userEmail) {
        console.log(`     ⚠ No email address found for user ${userId.slice(0, 8)}…`)
      }

      processed++

      // Small delay between users to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000))

    } catch (err) {
      console.error(`     ✗ Error: ${err.message}`)
      errors++
    }
  }

  console.log('')
  console.log(`✓ Done — ${processed} processed, ${errors} errors`)

  // Clean up activity_feed rows that have now been included in this week's emails.
  // We delete anything older than 7 days — by the time the next Monday run fires,
  // all recipients will have received these items already.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error: cleanupError } = await sb
    .from('activity_feed')
    .delete()
    .lt('created_at', cutoff)

  if (cleanupError) {
    console.warn(`⚠ activity_feed cleanup failed: ${cleanupError.message}`)
  } else {
    console.log('🗑 activity_feed: old rows cleared')
  }
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
