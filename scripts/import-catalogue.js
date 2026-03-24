/**
 * Import whisky catalogue from JSON into Supabase.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/import-catalogue.js ./whiskies.json
 *
 * Uses the service role key to bypass RLS.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BATCH_SIZE          = 100

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const filePath = process.argv[2]
if (!filePath) {
  console.error('Usage: node scripts/import-catalogue.js <path-to-json>')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Type mapping ──────────────────────────────────────────────────────────────
// Maps JSON type strings to your internal type keys
const TYPE_MAP = {
  'single malt':         'scotch',
  'blended malt':        'scotch',
  'blended scotch':      'scotch',
  'blended':             'other',
  'single grain':        'scotch',
  'irish':               'irish',
  'irish whiskey':       'irish',
  'irish single malt':   'irish',
  'irish blend':         'irish',
  'bourbon':             'bourbon',
  'straight bourbon':    'bourbon',
  'tennessee':           'bourbon',
  'japanese':            'japanese',
  'japanese whisky':     'japanese',
  'japanese single malt':'japanese',
  'japanese blend':      'japanese',
}

function mapType(rawType, country) {
  if (!rawType) return 'other'
  const key = rawType.toLowerCase().trim()
  if (TYPE_MAP[key]) return TYPE_MAP[key]

  // Fall back to country-based inference
  const c = (country || '').toLowerCase()
  if (c.includes('scotland'))  return 'scotch'
  if (c.includes('ireland'))   return 'irish'
  if (c.includes('japan'))     return 'japanese'
  if (c.includes('united states') || c.includes('kentucky')) return 'bourbon'

  return 'other'
}

function mapEntry(raw) {
  return {
    name:       raw.name?.trim()       || 'Unknown',
    distillery: raw.distillery?.trim() || null,
    country:    raw.country?.trim()    || null,
    region:     raw.region?.trim()     || null,
    type:       mapType(raw.type, raw.country),
    age:        raw.age?.trim()        || null,
    abv:        raw.abv?.trim()        || null,
    price_band: raw.price_band?.trim() || null,
    photo_url:  null,   // populated later when R2 migration runs
    // tasting notes and flavor scores left null — filled via Gemini batch later
    nose:       null,
    palate:     null,
    dulzor:     0,
    ahumado:    0,
    cuerpo:     0,
    frutado:    0,
    especiado:  0,
  }
}

async function main() {
  const raw  = JSON.parse(readFileSync(resolve(filePath), 'utf8'))
  const list = Array.isArray(raw) ? raw : raw.whiskies || Object.values(raw)

  console.log(`Importing ${list.length} whiskies...`)

  let inserted = 0
  let skipped  = 0

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch   = list.slice(i, i + BATCH_SIZE).map(mapEntry)
    const { error } = await sb
      .from('catalogue')
      .upsert(batch, { onConflict: 'name,distillery', ignoreDuplicates: true })

    if (error) {
      console.error(`Batch ${i}–${i + BATCH_SIZE} failed:`, error.message)
      skipped += batch.length
    } else {
      inserted += batch.length
      process.stdout.write(`\r  ${inserted} imported, ${skipped} skipped...`)
    }
  }

  console.log(`\nDone. ${inserted} imported, ${skipped} skipped.`)
}

main().catch(err => { console.error(err); process.exit(1) })
