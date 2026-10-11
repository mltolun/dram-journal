// Client for TinyFish Search and Fetch (https://docs.tinyfish.ai).
// Search returns ranked URLs; Fetch returns clean page text for up to 10 URLs.
// Free limits (tinyfish.ai/pricing): Search 30/min and 500/hour;
// Fetch 150 URLs/min and 1,000 URLs/day. Both are enforced here, before any
// request is sent, so a run stops cleanly instead of being rejected mid-batch.

const SEARCH_URL = 'https://api.search.tinyfish.ai'
const FETCH_URL = 'https://api.fetch.tinyfish.ai'

export class QuotaError extends Error {}

export function createTinyFishClient({
  apiKey,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxRetries = 3,
  minSearchIntervalMs = 2100, // stays under 30 searches/min
  maxSearchesPerHour = 500,
  maxFetchUrlsPerRun = 900,   // leaves headroom under the 1,000/day free cap
} = {}) {
  if (!apiKey) throw new Error('TINYFISH_API_KEY is required')

  let lastSearchAt = 0
  const searchTimes = []
  let fetchedUrls = 0

  async function call(url, init, { timeoutMs = 60_000 } = {}) {
    for (let attempt = 0; ; attempt++) {
      let res
      try {
        res = await fetchImpl(url, {
          ...init,
          headers: { 'X-API-Key': apiKey, ...(init.headers || {}) },
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch (err) {
        if ((err?.name === 'TimeoutError' || err?.name === 'AbortError') && attempt < maxRetries) {
          await sleep(3000 * 2 ** attempt)
          continue
        }
        throw err
      }

      if (res.status === 402) throw new QuotaError('TinyFish wallet empty / daily free allowance used')

      if (res.status === 429 || res.status >= 500) {
        const body = await res.json().catch(() => ({}))
        const code = body?.error?.code
        if (code === 'DAILY_LIMIT_EXCEEDED' || code === 'INSUFFICIENT_CREDITS') {
          throw new QuotaError(`TinyFish ${code}`)
        }
        if (attempt < maxRetries) { await sleep(3000 * 2 ** attempt); continue }
        if (res.status === 429) throw new QuotaError('TinyFish rate limit still exceeded after retries')
        throw new Error(`TinyFish ${res.status} after retries`)
      }

      if (!res.ok) throw new Error(`TinyFish ${res.status}: ${(await res.text()).slice(0, 200)}`)
      return res.json()
    }
  }

  return {
    async search(query, { numResults = 6, location = 'US', language = 'en' } = {}) {
      const hourAgo = Date.now() - 3_600_000
      while (searchTimes.length && searchTimes[0] < hourAgo) searchTimes.shift()
      if (searchTimes.length >= maxSearchesPerHour) {
        throw new QuotaError(`Search hourly limit reached (${maxSearchesPerHour}/hour)`)
      }
      const wait = lastSearchAt + minSearchIntervalMs - Date.now()
      if (wait > 0) await sleep(wait)
      lastSearchAt = Date.now()
      searchTimes.push(lastSearchAt)

      const u = new URL(SEARCH_URL)
      u.searchParams.set('query', query)
      u.searchParams.set('location', location)
      u.searchParams.set('language', language)

      const data = await call(u.href, { method: 'GET' }, { timeoutMs: 60_000 })
      return (data.results || []).slice(0, numResults).map((r) => ({
        url: r.url,
        title: r.title || '',
        snippet: r.snippet || '',
        site: r.site_name || '',
      }))
    },

    /** Returns [{ url, title, text }] for every URL that fetched with text. Failures are skipped. */
    async fetchText(urls) {
      const out = []
      const list = [...new Set(urls)]
      if (fetchedUrls + list.length > maxFetchUrlsPerRun) {
        throw new QuotaError(`Fetch URL budget for this run reached (${maxFetchUrlsPerRun})`)
      }
      fetchedUrls += list.length
      for (let i = 0; i < list.length; i += 10) {
        const data = await call(
          FETCH_URL,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: list.slice(i, i + 10), format: 'markdown' }),
          },
          { timeoutMs: 120_000 },
        )
        for (const r of data.results || []) {
          if (typeof r.text !== 'string' || !r.text.trim()) continue
          out.push({ url: r.final_url || r.url, title: r.title || '', text: r.text })
        }
      }
      return out
    },
  }
}
