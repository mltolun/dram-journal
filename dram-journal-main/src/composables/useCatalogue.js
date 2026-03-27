import { ref } from 'vue'
import { sb } from '../lib/supabase.js'

// Words to strip from scan results before searching
const NOISE_WORDS = new Set([
  'single', 'malt', 'scotch', 'whisky', 'whiskey', 'blended', 'grain',
  'irish', 'bourbon', 'japanese', 'years', 'year', 'old', 'aged',
  'the', 'and', 'of', 'a', 'an', 'de', 'edition', 'limited', 'special',
  'cask', 'finish', 'strength', 'barrel', 'reserve', 'original',
])

export function cleanSearchQuery(raw) {
  const words = raw
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

// ---------------------------------------------------------------------------
// Module-level caches — shared across all useCatalogue() instances
// ---------------------------------------------------------------------------
const queryCache = new Map() // normalised query → { data, ts }
const itemCache  = new Map() // id             → { data, ts }
const CACHE_TTL  = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX  = 200            // safety ceiling — clear if exceeded

function getCached(cache, key) {
  const hit = cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > CACHE_TTL) { cache.delete(key); return null }
  return hit.data
}

function setCached(cache, key, data) {
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, { data, ts: Date.now() })
}

/** Call this if you need to force-refresh after catalogue updates. */
export function clearCatalogueCache() {
  queryCache.clear()
  itemCache.clear()
}

// ---------------------------------------------------------------------------

export function useCatalogue() {
  const results    = ref([])
  const searching  = ref(false)
  let   debounceTimer = null

  async function search(query) {
    if (!query || query.trim().length < 2) {
      results.value = []
      return
    }

    searching.value = true
    try {
      const q        = query.trim()
      const cacheKey = q.toLowerCase()

      // Return cached results immediately if still fresh
      const cached = getCached(queryCache, cacheKey)
      if (cached) {
        console.log('[Catalogue] cache hit:', cacheKey)
        results.value = cached
        return
      }

      // Strategy 1: search the full query as-is (works for short precise queries)
      console.log('[Catalogue] searching exact:', q)
      const { data: exact } = await sb
        .from('catalogue')
        .select('id, name, distillery, country, region, type, age, abv, price_band, photo_url, nose, palate, dulzor, ahumado, cuerpo, frutado, especiado')
        .or(`name.ilike.%${q}%,distillery.ilike.%${q}%`)
        .order('name', { ascending: true })
        .limit(20)

      // Strategy 2: search with noise words stripped (works for verbose scan results)
      const cleaned = cleanSearchQuery(q)
      console.log('[Catalogue] cleaned for fuzzy:', cleaned)
      let fuzzy = []
      if (cleaned && cleaned !== q.toLowerCase()) {
        const words = cleaned.split(' ').filter(Boolean)
        if (words.length > 0) {
          // Search each meaningful word independently and combine
          const orFilter = words
            .map(w => `name.ilike.%${w}%`)
            .join(',')
          const { data: fuzzyData } = await sb
            .from('catalogue')
            .select('id, name, distillery, country, region, type, age, abv, price_band, photo_url, nose, palate, dulzor, ahumado, cuerpo, frutado, especiado')
            .or(orFilter)
            .order('name', { ascending: true })
            .limit(20)
          fuzzy = fuzzyData || []
        }
      }

      // Merge results, deduplicate by id, exact matches first
      const seen = new Set()
      const merged = []
      for (const item of [...(exact || []), ...fuzzy]) {
        if (!seen.has(item.id)) {
          seen.add(item.id)
          merged.push(item)
        }
      }

      console.log('[Catalogue] exact results:', exact?.length, '| fuzzy results:', fuzzy.length)
      console.log('[Catalogue] merged total:', merged.length, merged.slice(0,3).map(r => r.name))

      // Strategy 3: if still no results, try each word independently against name+distillery
      let fallback = []
      if (merged.length === 0) {
        const allWords = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
        for (const word of allWords.slice(0, 3)) {
          const { data: wordData } = await sb
            .from('catalogue')
            .select('id, name, distillery, country, region, type, age, abv, price_band, photo_url, nose, palate, dulzor, ahumado, cuerpo, frutado, especiado')
            .or(`name.ilike.%${word}%,distillery.ilike.%${word}%`)
            .order('name', { ascending: true })
            .limit(20)
          if (wordData?.length) { fallback = wordData; break }
        }
        console.log('[Catalogue] fallback results:', fallback.length)
      }

      const final = merged.length > 0 ? merged : fallback

      // Score results — items matching more words rank higher
      const queryWords = cleanSearchQuery(q).split(' ').filter(Boolean)
      final.sort((a, b) => {
        const scoreA = queryWords.filter(w => a.name.toLowerCase().includes(w) || a.distillery?.toLowerCase().includes(w)).length
        const scoreB = queryWords.filter(w => b.name.toLowerCase().includes(w) || b.distillery?.toLowerCase().includes(w)).length
        return scoreB - scoreA
      })

      const finalSlice = final.slice(0, 30)

      // Populate item cache from search results as a free side-effect
      for (const item of finalSlice) setCached(itemCache, item.id, item)

      setCached(queryCache, cacheKey, finalSlice)
      results.value = finalSlice
    } catch (err) {
      console.error('Catalogue search error:', err)
      results.value = []
    } finally {
      searching.value = false
    }
  }

  function debouncedSearch(query, delay = 300) {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => search(query), delay)
  }

  async function getById(id) {
    // Check item cache before hitting the network
    const cached = getCached(itemCache, id)
    if (cached) {
      console.log('[Catalogue] getById cache hit:', id)
      return cached
    }

    const { data, error } = await sb
      .from('catalogue')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    setCached(itemCache, id, data)
    return data
  }

  function clear() {
    results.value = []
    clearTimeout(debounceTimer)
  }

  return { results, searching, debouncedSearch, search, getById, clear }
}
