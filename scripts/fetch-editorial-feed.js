/**
 * fetch-editorial-feed.js
 *
 * Daily GitHub Actions script.
 * Fetches whisky news, events, and awards from multiple RSS feeds,
 * deduplicates against already-stored items, and inserts fresh entries
 * into the `editorial_feed` Supabase table.
 *
 * Also prunes expired items and items older than 60 days.
 *
 * Required environment variables:
 *   SUPABASE_URL         — your project URL
 *   SUPABASE_SERVICE_KEY — service role key (bypasses RLS)
 *
 * No additional npm packages needed beyond @supabase/supabase-js.
 * RSS parsing is done with the built-in DOMParser (via Node's --experimental-vm-modules)
 * or a small hand-rolled XML parser so no extra deps are required.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── Feed registry ─────────────────────────────────────────────────────────────
//
// Each source maps to one of the four editorial_feed types:
//   news | event | award | announcement
//
// Classification rules per source are applied via `classify()` below.
// A source-level `defaultType` is used when no rule matches.

const FEEDS = [
  // ── General whisky news & reviews ──────────────────────────────────────────
  {
    name: 'Master of Malt',
    url:  'https://www.masterofmalt.com/blog/feed',
    defaultType: 'news',
  },
  {
    name: 'The Whisky Exchange',
    url:  'https://blog.thewhiskyexchange.com/feed',
    defaultType: 'news',
  },
  {
    name: 'Whiskey Wash',
    url:  'https://thewhiskeywash.com/feed',
    defaultType: 'news',
  },
  {
    name: 'WhiskyIntelligence',
    url:  'https://www.whiskyintelligence.com/feed/',
    defaultType: 'news',
  },
  {
    name: 'Whisky Fun',
    url:  'https://whiskyfun.com/whatsnew.xml',
    defaultType: 'news',
  },
  // ── Awards-heavy sources ───────────────────────────────────────────────────
  // IWSC and World Whiskies Awards don't publish RSS; WhiskyIntelligence
  // aggregates their press releases, so it covers awards as well.
  // We add Whisky Advocate's main feed which covers competition results.
  {
    name: 'Whisky Advocate',
    url:  'https://whiskyadvocate.com/feed/',
    defaultType: 'news',
  },
]

// Maximum items to pull per feed per run (keeps runtime short)
const MAX_ITEMS_PER_FEED = 10

// How many days back to consider an item "fresh enough" to insert
const MAX_AGE_DAYS = 7

// ── Minimal RSS/Atom parser ───────────────────────────────────────────────────
//
// Parses the raw XML string and returns an array of:
//   { title, link, pubDate (Date|null), description, categories[] }
//
// Handles both RSS 2.0 (<item>) and Atom (<entry>) without any npm deps.

function parseXml(xml, sourceName) {
  // Strip CDATA markers so the content is usable as plain text
  xml = xml
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, content) => content)

  // Helper: extract first match of a tag's text content
  function tag(str, tagName) {
    const m = str.match(new RegExp(`<${tagName}[^>]*?>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
    return m ? m[1].trim() : ''
  }

  // Helper: extract all category/tag values
  function categories(str) {
    const re = /<category[^>]*?>([^<]*)<\/category>/gi
    const out = []
    let m
    while ((m = re.exec(str)) !== null) out.push(m[1].trim().toLowerCase())
    return out
  }

  // Detect format
  const isAtom = /<feed[^>]*xmlns[^>]*>/i.test(xml)
  const itemTag = isAtom ? 'entry' : 'item'

  const itemRe = new RegExp(`<${itemTag}[\\s>]([\\s\\S]*?)<\\/${itemTag}>`, 'gi')
  const items  = []
  let m

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]

    const title = tag(block, 'title') || '(no title)'
    const link  = isAtom
      ? (block.match(/<link[^>]+href="([^"]+)"/i)?.[1] || tag(block, 'link'))
      : tag(block, 'link')

    // Prefer dc:date → published → updated → pubDate
    const rawDate =
      tag(block, 'dc:date') ||
      tag(block, 'published') ||
      tag(block, 'updated') ||
      tag(block, 'pubDate') ||
      ''
    const pubDate = rawDate ? new Date(rawDate) : null

    // Use description or summary (strip HTML tags for brevity)
    const rawDesc = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content')
    const description = rawDesc
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 300) || null

    items.push({
      title:       title.replace(/<[^>]+>/g, '').trim(),
      link:        link || null,
      pubDate,
      description,
      categories:  categories(block),
      sourceName,
    })
  }

  return items
}

// ── Type classifier ───────────────────────────────────────────────────────────
//
// Decides editorial_feed.type based on title + categories.

const AWARD_KEYWORDS = [
  'award', 'winner', 'gold', 'silver', 'bronze', 'medal', 'trophy',
  'best whisky', 'best scotch', 'best bourbon', 'competition', 'shortlist',
  'iwsc', 'world whiskies', 'sfwsc', 'san francisco', 'whisky exchange awards',
]
const EVENT_KEYWORDS = [
  'festival', 'event', 'tasting', 'masterclass', 'tour', 'open day',
  'whisky show', 'whisky fair', 'distillery visit', 'pop-up', 'launch event',
  'dinner', 'seminar', 'auction',
]
const ANNOUNCEMENT_KEYWORDS = [
  'new release', 'limited edition', 'announced', 'launch', 'expression',
  'bottling', 'distillery opens', 'new distillery', 'partnership', 'acqui',
  'appoint', 'appoints', 'expansion',
]

function classify(item, defaultType) {
  const text = `${item.title} ${item.categories.join(' ')}`.toLowerCase()

  if (AWARD_KEYWORDS.some(k => text.includes(k)))        return 'award'
  if (EVENT_KEYWORDS.some(k => text.includes(k)))        return 'event'
  if (ANNOUNCEMENT_KEYWORDS.some(k => text.includes(k))) return 'announcement'
  return defaultType
}

// ── Fetch a single feed ───────────────────────────────────────────────────────

async function fetchFeed(feed) {
  try {
    const res = await fetch(feed.url, {
      headers: {
        'User-Agent': 'DramJournal-Editorial-Bot/1.0 (+https://dramjournal.online)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      console.warn(`  [${feed.name}] HTTP ${res.status} — skipping`)
      return []
    }

    const xml   = await res.text()
    const items = parseXml(xml, feed.name)
    console.log(`  [${feed.name}] parsed ${items.length} items`)
    return items
  } catch (err) {
    console.warn(`  [${feed.name}] fetch error: ${err.message}`)
    return []
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────────
//
// We use source_url as the dedup key — if the same URL is already in the
// table we skip it. Fetch the existing URLs for the last 60 days upfront.

async function loadExistingUrls() {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString()
  const { data, error } = await sb
    .from('editorial_feed')
    .select('source_url')
    .gte('created_at', cutoff)

  if (error) {
    console.warn('  [dedup] Could not load existing URLs:', error.message)
    return new Set()
  }
  return new Set((data || []).map(r => r.source_url).filter(Boolean))
}

// ── Age gate ──────────────────────────────────────────────────────────────────

const MAX_AGE_MS = MAX_AGE_DAYS * 86_400_000

function isFresh(item) {
  if (!item.pubDate || isNaN(item.pubDate.getTime())) return true // unknown date → include
  return Date.now() - item.pubDate.getTime() < MAX_AGE_MS
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

async function pruneOldItems() {
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString()

  // Delete expired items
  const { error: expError } = await sb
    .from('editorial_feed')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .not('expires_at', 'is', null)

  // Delete items older than 60 days
  const { error: ageError, count } = await sb
    .from('editorial_feed')
    .delete({ count: 'exact' })
    .lt('published_at', cutoff)

  if (expError) console.warn('  [cleanup] Expired delete error:', expError.message)
  if (ageError) console.warn('  [cleanup] Age delete error:', ageError.message)
  else console.log(`  [cleanup] Pruned items older than 60 days (${count ?? '?'} rows)`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[editorial-feed] Starting…')

  await pruneOldItems()

  const existingUrls = await loadExistingUrls()
  console.log(`  [dedup] ${existingUrls.size} existing URLs loaded`)

  const toInsert = []
  const ageCutoff = new Date(Date.now() - MAX_AGE_MS)

  for (const feed of FEEDS) {
    const items = await fetchFeed(feed)

    let taken = 0
    for (const item of items) {
      if (taken >= MAX_ITEMS_PER_FEED) break
      if (!item.link) continue
      if (existingUrls.has(item.link)) continue
      if (!isFresh(item)) continue

      const type = classify(item, feed.defaultType)

      toInsert.push({
        type,
        title:        item.title.slice(0, 255),
        body:         item.description || null,
        source_name:  feed.name,
        source_url:   item.link,
        published_at: item.pubDate?.toISOString() ?? new Date().toISOString(),
        // Set expiry: news/announcements expire after 14 days, events after 30
        expires_at:   type === 'event'
          ? new Date(Date.now() + 30 * 86_400_000).toISOString()
          : new Date(Date.now() + 14 * 86_400_000).toISOString(),
      })

      existingUrls.add(item.link) // prevent cross-feed duplicates in the same run
      taken++
    }
  }

  if (toInsert.length === 0) {
    console.log('[editorial-feed] Nothing new to insert.')
    return
  }

  console.log(`[editorial-feed] Inserting ${toInsert.length} new item(s)…`)

  // Insert in batches of 50 to stay well within Supabase row limits
  const BATCH = 50
  let inserted = 0
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    const { error } = await sb.from('editorial_feed').insert(batch)
    if (error) {
      console.error(`  [insert] Batch ${i / BATCH + 1} error: ${error.message}`)
    } else {
      inserted += batch.length
    }
  }

  console.log(`[editorial-feed] Done — ${inserted} item(s) inserted.`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
