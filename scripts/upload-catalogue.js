/**
 * upload-catalogue.js
 *
 * 1. Reads your JSON (or CSV) file of 6100 whiskies
 * 2. For each entry, finds the local image using the filename from image_path
 * 3. Uploads the image to Supabase Storage at catalogue/<filename>
 * 4. Upserts the whisky record into the catalogue table with the new photo_url
 *
 * Usage:
 *   node scripts/upload-catalogue.js --data ./whiskies.json --images ./images
 *   node scripts/upload-catalogue.js --data ./whiskies.csv  --images ./images
 *
 * Required env vars:
 *   SUPABASE_URL          — your project URL
 *   SUPABASE_SERVICE_KEY  — service role key (bypasses RLS)
 *
 * Optional env vars:
 *   BATCH_SIZE   — records per batch (default: 20)
 *   CONCURRENCY  — parallel uploads per batch (default: 5)
 *   START_AT     — skip first N records, useful for resuming (default: 0)
 */

import { createClient }  from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, basename, extname } from 'path'
import { parse as parseCsv } from 'csv-parse/sync'

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET              = 'whisky-photos'
const STORAGE_PREFIX      = 'catalogue'
const BATCH_SIZE          = parseInt(process.env.BATCH_SIZE  || '20')
const CONCURRENCY         = parseInt(process.env.CONCURRENCY || '5')
const START_AT            = parseInt(process.env.START_AT    || '0')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

// ── Args ──────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const getArg = (flag) => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : null
}

const dataFile   = getArg('--data')
const imagesDir  = getArg('--images')

if (!dataFile || !imagesDir) {
  console.error('Usage: node scripts/upload-catalogue.js --data <file.json|csv> --images <folder>')
  process.exit(1)
}

// ── Supabase ──────────────────────────────────────────────────────────────────

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Type mapping ──────────────────────────────────────────────────────────────

const TYPE_MAP = {
  'single malt':          'scotch',
  'blended malt':         'scotch',
  'blended scotch':       'scotch',
  'scotch':               'scotch',
  'single grain':         'scotch',
  'irish':                'irish',
  'irish whiskey':        'irish',
  'irish single malt':    'irish',
  'irish blend':          'irish',
  'bourbon':              'bourbon',
  'straight bourbon':     'bourbon',
  'tennessee':            'bourbon',
  'japanese':             'japanese',
  'japanese whisky':      'japanese',
  'japanese single malt': 'japanese',
  'japanese blend':       'japanese',
  'blended':              'other',
}

function mapType(rawType, country) {
  if (!rawType) return 'other'
  const key = rawType.toLowerCase().trim()
  if (TYPE_MAP[key]) return TYPE_MAP[key]
  const c = (country || '').toLowerCase()
  if (c.includes('scotland'))                              return 'scotch'
  if (c.includes('ireland'))                              return 'irish'
  if (c.includes('japan'))                                return 'japanese'
  if (c.includes('united states') || c.includes('kentucky')) return 'bourbon'
  return 'other'
}

// ── Parse data file ───────────────────────────────────────────────────────────

function loadData(filePath) {
  const abs  = resolve(filePath)
  const ext  = extname(abs).toLowerCase()
  const raw  = readFileSync(abs, 'utf8')

  if (ext === '.csv') {
    return parseCsv(raw, { columns: true, skip_empty_lines: true, trim: true })
  }

  // JSON — handle array, { whiskies: [] }, or object of values
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed))         return parsed
  if (Array.isArray(parsed.whiskies)) return parsed.whiskies
  return Object.values(parsed)
}

// ── Sanitise filename for Supabase Storage ────────────────────────────────────
// Replaces non-ASCII characters with ASCII equivalents, then strips anything
// that isn't alphanumeric, dot, dash, or underscore.

const CHAR_MAP = {
  'á':'a','à':'a','â':'a','ä':'a','ã':'a','å':'a','æ':'ae',
  'é':'e','è':'e','ê':'e','ë':'e',
  'í':'i','ì':'i','î':'i','ï':'i',
  'ó':'o','ò':'o','ô':'o','ö':'o','õ':'o','ø':'o',
  'ú':'u','ù':'u','û':'u','ü':'u',
  'ý':'y','ÿ':'y',
  'ñ':'n','ç':'c','ß':'ss',
  'Á':'A','À':'A','Â':'A','Ä':'A','Ã':'A','Å':'A','Æ':'AE',
  'É':'E','È':'E','Ê':'E','Ë':'E',
  'Í':'I','Ì':'I','Î':'I','Ï':'I',
  'Ó':'O','Ò':'O','Ô':'O','Ö':'O','Õ':'O','Ø':'O',
  'Ú':'U','Ù':'U','Û':'U','Ü':'U',
  'Ý':'Y','Ñ':'N','Ç':'C',
}

function sanitiseFilename(filename) {
  return filename
    .split('').map(c => CHAR_MAP[c] || c).join('')  // replace accented chars
    .replace(/[^\w.\-]/g, '_')                        // replace anything else invalid
    .replace(/_+/g, '_')                              // collapse multiple underscores
}

// ── Extract filename from image_path or url ───────────────────────────────────

function extractFilename(entry) {
  const raw = entry.image_path || entry.url || ''
  if (!raw) return null
  const name = basename(raw)
  // If it has no extension it's likely a bare URL slug — skip it
  if (!extname(name)) return null
  return name
}

// ── MIME type ─────────────────────────────────────────────────────────────────

function mimeType(filename) {
  const ext = extname(filename).toLowerCase()
  const map = { '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }
  return map[ext] || 'application/octet-stream'
}

// ── Upload one image ──────────────────────────────────────────────────────────

async function uploadImage(filename, imagesDir) {
  const localPath   = resolve(imagesDir, filename)
  // Use sanitised name for the storage key but look up original name locally
  const safeFilename = sanitiseFilename(filename)
  const storagePath  = `${STORAGE_PREFIX}/${safeFilename}`

  if (!existsSync(localPath)) {
    return { ok: false, reason: 'file_not_found', storagePath }
  }

  const fileBuffer = readFileSync(localPath)
  const mime       = mimeType(filename)

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType:  mime,
      cacheControl: '31536000',
      upsert:       true,
    })

  if (error) return { ok: false, reason: error.message, storagePath }

  const { data } = sb.storage.from(BUCKET).getPublicUrl(storagePath)
  return { ok: true, publicUrl: data.publicUrl, storagePath }
}

// ── Map entry to catalogue row ────────────────────────────────────────────────

function toRow(entry, photoUrl) {
  return {
    name:       (entry.name       || '').trim() || 'Unknown',
    distillery: (entry.distillery || '').trim() || null,
    country:    (entry.country    || '').trim() || null,
    region:     (entry.region     || '').trim() || null,
    type:       mapType(entry.type, entry.country),
    age:        (entry.age        || '').trim() || null,
    abv:        (entry.abv        || '').trim() || null,
    price_band: (entry.price_band || '').trim() || null,
    photo_url:  photoUrl || null,
    // tasting fields left null — filled later via Gemini batch
    nose:       null,
    palate:     null,
    dulzor:     0,
    ahumado:    0,
    cuerpo:     0,
    frutado:    0,
    especiado:  0,
  }
}

// ── Process one entry ─────────────────────────────────────────────────────────

async function processEntry(entry, imagesDir) {
  const filename = extractFilename(entry)

  let photoUrl = null

  if (!filename) {
    console.warn(`  ⚠  No image_path or url for "${entry.name}" — inserting without photo`)
  } else {
    const result = await uploadImage(filename, imagesDir)
    if (result.ok) {
      photoUrl = result.publicUrl
    } else if (result.reason === 'file_not_found') {
      console.warn(`  ⚠  Image not found locally: ${filename} — skipping photo for "${entry.name}"`)
    } else {
      console.warn(`  ⚠  Upload failed for ${filename}: ${result.reason}`)
    }
  }

  return toRow(entry, photoUrl)
}

// ── Upsert batch to catalogue ─────────────────────────────────────────────────

async function upsertBatch(rows) {
  // Deduplicate within the batch — keep last occurrence of each name+distillery combo
  const seen = new Map()
  for (const row of rows) {
    const key = `${row.name}||${row.distillery || ''}`
    seen.set(key, row)
  }
  const deduped = Array.from(seen.values())

  const { error } = await sb
    .from('catalogue')
    .upsert(deduped, { onConflict: 'name,distillery', ignoreDuplicates: true })

  if (error) throw new Error(`DB upsert failed: ${error.message}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🥃  Dram Journal — Catalogue Upload')
  console.log(`    Data file : ${dataFile}`)
  console.log(`    Images dir: ${imagesDir}`)
  console.log(`    Batch size: ${BATCH_SIZE}  |  Concurrency: ${CONCURRENCY}  |  Start at: ${START_AT}`)
  console.log()

  const entries = loadData(dataFile)
  const total   = entries.length
  console.log(`📋  Loaded ${total} entries from data file`)

  if (START_AT > 0) console.log(`⏩  Skipping first ${START_AT} entries`)

  const toProcess = entries.slice(START_AT)
  let uploaded = 0, skipped = 0, failed = 0, dbFailed = 0

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch   = toProcess.slice(i, i + BATCH_SIZE)
    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    const total_batches = Math.ceil(toProcess.length / BATCH_SIZE)

    process.stdout.write(`\r  Batch ${batchNo}/${total_batches} — uploading images...`)

    // Process up to CONCURRENCY entries in parallel within the batch
    const rows = []
    for (let j = 0; j < batch.length; j += CONCURRENCY) {
      const chunk   = batch.slice(j, j + CONCURRENCY)
      const results = await Promise.all(chunk.map(e => processEntry(e, imagesDir)))
      rows.push(...results)
    }

    // Count outcomes
    rows.forEach(r => {
      if (r.photo_url)  uploaded++
      else              skipped++
    })

    // Upsert the whole batch to DB
    try {
      await upsertBatch(rows)
    } catch (err) {
      console.error(`\n  ❌  DB batch ${batchNo} failed: ${err.message}`)
      dbFailed += rows.length
    }
  }

  console.log('\n')
  console.log('✅  Done!')
  console.log(`    📸  Images uploaded : ${uploaded}`)
  console.log(`    ⚠   Images skipped  : ${skipped}  (missing file or no path)`)
  console.log(`    ❌  DB insert failed: ${dbFailed}`)
  console.log()

  if (skipped > 0) {
    console.log('    Tip: rows without a photo were still inserted into the catalogue.')
    console.log('    Re-run with START_AT=N to resume from a specific position if needed.')
  }
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
