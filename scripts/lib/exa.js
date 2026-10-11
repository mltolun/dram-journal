// Minimal client for the Exa Search API (https://docs.exa.ai/reference/search).
// One call returns ranked results with page text, so no separate fetch step.

const SEARCH_URL = 'https://api.exa.ai/search'

export class QuotaError extends Error {}

export function createExaClient({
  apiKey,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxRetries = 3,
} = {}) {
  if (!apiKey) throw new Error('EXA_API_KEY is required')

  return {
    async search(query, { numResults = 5, maxCharacters = 5000 } = {}) {
      for (let attempt = 0; ; attempt++) {
        const res = await fetchImpl(SEARCH_URL, {
          method: 'POST',
          headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            type: 'auto',
            numResults,
            contents: { text: { maxCharacters } },
          }),
          signal: AbortSignal.timeout(60_000),
        })

        if (res.status === 402) throw new QuotaError('Exa credits exhausted')
        if (res.status === 429) {
          if (attempt < maxRetries) { await sleep(2000 * 2 ** attempt); continue }
          throw new QuotaError('Exa rate limit still exceeded after retries')
        }
        if (res.status >= 500 && attempt < maxRetries) { await sleep(2000 * 2 ** attempt); continue }
        if (!res.ok) throw new Error(`Exa ${res.status}: ${(await res.text()).slice(0, 200)}`)

        const data = await res.json()
        return (data.results || []).map((r) => ({
          url: r.url,
          title: r.title || '',
          text: r.text || '',
          publishedDate: r.publishedDate || null,
        }))
      }
    },
  }
}
