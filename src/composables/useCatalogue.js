import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

// Words to strip from scan results before searching
const NOISE_WORDS = new Set([
  'single', 'malt', 'scotch', 'whisky', 'whiskey', 'blended', 'grain',
  'irish', 'bourbon', 'japanese', 'years', 'year', 'old', 'aged',
  'the', 'and', 'of', 'a', 'an', 'de', 'edition', 'limited', 'special',
  'cask', 'finish', 'strength', 'barrel', 'reserve', 'original',
])

// Columns the UI consumes. Kept in one place so the RPC fallback, search results
// and getById can never drift apart.
const CATALOGUE_COLUMNS =
  'id, name, distillery, country, region, type, age, abv, price_band, ' +
  'photo_url, nose, palate, dulzor, ahumado, cuerpo, frutado, especiado'

const SEARCH_LIMIT = 30

export function cleanSearchQuery(raw) {
  const words = (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !NOISE_WORDS.has(w))

  // Deduplicate while preserving order
  const seen = new Set()
  return words
    .filter(w => { if (seen.has(w)) return false; seen.add(w); return true })
    .slice(0, 4)
    .join(' ')
}

// Keywords used for the per-word search. Falls back to the raw alphanumeric
// words when every token was noise (e.g. "single malt" → "single malt").
export function searchKeywords(raw) {
  const cleaned = cleanSearchQuery(raw)
  if (cleaned) return cleaned.split(' ').filter(Boolean)

  return (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .slice(0, 3)
}

// Canonical cache key — case and whitespace insensitive so "Ardbeg 10",
// "ardbeg 10" and "ardbeg  10 " share one entry (and one request).
export function normalizeQuery(raw) {
  return (raw || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Remove characters that break PostgREST `or()` filter parsing when a raw query
// is interpolated into a filter string.
function safeFilterValue(s) {
  return (s || '').replace(/[,()\\%_]/g, ' ').replace(/\s+/g, ' ').trim()
}

// supabase-js reports a missing function as PGRST202. Used to fall back
// gracefully when the search/index migration has not been applied yet.
function isMissingRpc(error) {
  return error?.code === 'PGRST202' || /could not find the function/i.test(error?.message || '')
}

// ---------------------------------------------------------------------------
// Module-level caches — shared across all useCatalogue() instances
// ---------------------------------------------------------------------------
const queryCache     = new Map() // normalised query → { data, ts }
const itemCache      = new Map() // id               → { data, ts }
const distinctCache  = new Map() // "col:term"       → { data, ts } (autocomplete)
const inflight       = new Map() // normalised query → in-flight promise (dedup)
const distinctBusy   = new Map() // "col:term"       → in-flight promise (dedup)
const CACHE_TTL  = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX  = 200            // safety ceiling — evict oldest if exceeded

function getCached(cache, key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > CACHE_TTL) { cache.delete(key); return null }
  return hit.data
}

function setCached(cache, key, data) {
  if (!cache.has(key) && cache.size >= CACHE_MAX) {
    // Evict the oldest entry rather than wiping the whole cache
    cache.delete(cache.keys().next().value)
  }
  cache.set(key, { data, ts: Date.now() })
}

/** Call this if you need to force-refresh after catalogue updates. */
export function clearCatalogueCache() {
  queryCache.clear()
  itemCache.clear()
  distinctCache.clear()
  inflight.clear()
  distinctBusy.clear()
}

// Rank candidates: exact-phrase hits first, then items matching more keywords.
// The DB query chooses the candidate set; this orders it for display.
function rank(items, raw, keywords) {
  const phrase = normalizeQuery(raw)
  const first  = keywords[0] || ''

  return items
    .map(item => {
      const name = (item.name || '').toLowerCase()
      const dist = (item.distillery || '').toLowerCase()
      let score = 0
      if (phrase && name.includes(phrase)) score += 8
      if (phrase && dist.includes(phrase)) score += 4
      for (const w of keywords) {
        if (name.includes(w)) score += 2
        if (dist.includes(w)) score += 1
      }
      if (first && name.startsWith(first)) score += 2
      return { item, score }
    })
    .sort((a, b) => b.score - a.score || (a.item.name || '').localeCompare(b.item.name || ''))
    .slice(0, SEARCH_LIMIT)
    .map(entry => entry.item)
}

// Fallback used only when catalogue_search() is unavailable. Two independent
// queries run in parallel instead of the previous sequential waterfall.
async function executeSearchFallback(raw, keywords) {
  const phrase = safeFilterValue(raw)

  const exactPromise = phrase
    ? sb.from('catalogue').select(CATALOGUE_COLUMNS)
        .or(`name.ilike.%${phrase}%,distillery.ilike.%${phrase}%`)
        .order('name', { ascending: true })
        .limit(20)
    : Promise.resolve({ data: [], error: null })

  const orFilter = keywords
    .flatMap(w => [`name.ilike.%${w}%`, `distillery.ilike.%${w}%`])
    .join(',')

  const fuzzyPromise = orFilter
    ? sb.from('catalogue').select(CATALOGUE_COLUMNS)
        .or(orFilter)
        .order('name', { ascending: true })
        .limit(SEARCH_LIMIT)
    : Promise.resolve({ data: [], error: null })

  const [exactRes, fuzzyRes] = await Promise.all([exactPromise, fuzzyPromise])
  if (exactRes.error) throw exactRes.error
  if (fuzzyRes.error) throw fuzzyRes.error

  const seen = new Set()
  const merged = []
  for (const item of [...(exactRes.data || []), ...(fuzzyRes.data || [])]) {
    if (item && !seen.has(item.id)) { seen.add(item.id); merged.push(item) }
  }
  return merged
}

async function executeSearch(raw, keywords) {
  // Preferred path: one indexed, server-ranked query (migration
  // 20260925_catalogue_search_indexes.sql).
  const { data, error } = await sb.rpc('catalogue_search', {
    p_raw:   raw,
    p_words: keywords,
    p_limit: SEARCH_LIMIT,
  })

  if (!error) return data || []
  if (!isMissingRpc(error)) throw error

  // Migration not applied yet — direct queries still work, just less optimally.
  return executeSearchFallback(raw, keywords)
}

// ---------------------------------------------------------------------------
// Autocomplete support: distinct distillery / country values.
// Shared module-level cache + in-flight dedup so every Autocomplete instance
// (and keystroke) reuses one request per term.
// ---------------------------------------------------------------------------
async function requestDistinctValues(column, term, limit) {
  const { data, error } = await sb.rpc('catalogue_distinct_values', {
    p_column: column,
    p_query:  term,
    p_limit:  limit,
  })

  if (!error) return [...new Set((data || []).filter(Boolean))].slice(0, limit)

  if (!isMissingRpc(error)) throw error

  // Fallback when the migration is not applied yet: one page of rows,
  // de-duplicated client-side.
  const { data: rows, error: rowErr } = await sb
    .from('catalogue')
    .select(column)
    .ilike(column, `%${term}%`)
    .limit(50)
  if (rowErr) throw rowErr
  return [...new Set((rows || []).map(r => r[column]).filter(Boolean))].sort().slice(0, limit)
}

export function fetchDistinctValues(column, query, limit = 12) {
  const term = (query || '').trim()
  if (!term) return Promise.resolve([])

  const key = `${column}:${normalizeQuery(term)}`

  const cached = getCached(distinctCache, key)
  if (cached) return Promise.resolve(cached)

  const pending = distinctBusy.get(key)
  if (pending) return pending

  const request = requestDistinctValues(column, term, limit)
    .then(values => { setCached(distinctCache, key, values); return values })
    .finally(() => { distinctBusy.delete(key) })

  distinctBusy.set(key, request)
  return request
}

// ---------------------------------------------------------------------------

export function useCatalogue() {
  const results     = ref([])
  const searching   = ref(false)
  const searchError = ref(false)
  let   debounceTimer = null
  let   searchSeq = 0   // stale-response guard: only the latest search may write results

  async function search(query) {
    if (!currentUser.value) {
      results.value = []
      searching.value = false
      searchError.value = false
      return
    }

    const raw = (query || '').trim()
    if (raw.length < 2) {
      results.value = []
      searchError.value = false
      return
    }

    const seq = ++searchSeq
    searching.value = true
    searchError.value = false

    const cacheKey = normalizeQuery(raw)

    // Return cached results immediately if still fresh
    const cached = getCached(queryCache, cacheKey)
    if (cached) {
      if (seq === searchSeq) { results.value = cached; searching.value = false }
      return
    }

    try {
      const final = await fetchSearch(raw, cacheKey)
      if (seq === searchSeq) results.value = final
    } catch (err) {
      console.error('Catalogue search error:', err)
      if (seq === searchSeq) {
        results.value = []
        searchError.value = true
      }
    } finally {
      if (seq === searchSeq) searching.value = false
    }
  }

  // Share one in-flight request between concurrent identical searches and
  // populate both caches on completion.
  function fetchSearch(raw, cacheKey) {
    const pending = inflight.get(cacheKey)
    if (pending) return pending

    const keywords = searchKeywords(raw)

    const request = executeSearch(raw, keywords)
      .then(items => {
        const finalSlice = rank(items, raw, keywords)
        // Populate the item cache from search results as a free side-effect
        for (const item of finalSlice) setCached(itemCache, item.id, item)
        setCached(queryCache, cacheKey, finalSlice)
        return finalSlice
      })
      .finally(() => { inflight.delete(cacheKey) })

    inflight.set(cacheKey, request)
    return request
  }

  function debouncedSearch(query, delay = 300) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => search(query), delay)
  }

  async function getById(id) {
    // Check item cache before hitting the network
    const cached = getCached(itemCache, id)
    if (cached) return cached

    const { data, error } = await sb
      .from('catalogue')
      .select(CATALOGUE_COLUMNS)
      .eq('id', id)
      .single()

    if (error) { console.error('getCatalogueById failed:', error.message); return null }
    setCached(itemCache, id, data)
    return data
  }

  function clear() {
    searchSeq++          // invalidate in-flight searches
    results.value = []
    searchError.value = false
    clearTimeout(debounceTimer)
  }

  return { results, searching, searchError, debouncedSearch, search, getById, clear }
}
