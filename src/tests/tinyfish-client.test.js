import { describe, it, expect, vi } from 'vitest'
import { createTinyFishClient, QuotaError } from '../../scripts/lib/tinyfish.js'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const noSleep = async () => {}
const make = (fetchImpl, extra = {}) => createTinyFishClient({ apiKey: 'k', fetchImpl, sleep: noSleep, minSearchIntervalMs: 0, ...extra })

describe('TinyFish client', () => {
  it('requires an API key', () => {
    expect(() => createTinyFishClient({})).toThrow(/TINYFISH_API_KEY/)
  })

  it('search sends X-API-Key and maps results to url/title/snippet', async () => {
    const fetchImpl = vi.fn(async () => json(200, { results: [{ url: 'https://whiskyfun.com/x', title: 'X', snippet: 'peat', site_name: 'whiskyfun.com', position: 1 }] }))
    const out = await make(fetchImpl).search('"Haran 12"', { numResults: 6 })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toContain('https://api.search.tinyfish.ai/?')
    expect(new URL(url).searchParams.get('query')).toBe('"Haran 12"')
    expect(init.headers['X-API-Key']).toBe('k')
    expect(out).toEqual([{ url: 'https://whiskyfun.com/x', title: 'X', snippet: 'peat', site: 'whiskyfun.com' }])
  })

  it('fetchText posts up to 10 URLs per call as markdown and skips pages without text', async () => {
    const urls = Array.from({ length: 12 }, (_, i) => `https://e.test/${i}`)
    const fetchImpl = vi.fn(async (_u, init) => {
      const sent = JSON.parse(init.body).urls
      return json(200, { results: sent.map(u => ({ url: u, final_url: u + '/f', title: 't', text: u.endsWith('/1') ? '' : 'page text' })), errors: [] })
    })
    const pages = await make(fetchImpl).fetchText(urls)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ format: 'markdown' })
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).urls).toHaveLength(10)
    expect(pages.find(p => p.url.startsWith('https://e.test/1/f'))).toBeUndefined()
    expect(pages[0].url).toBe('https://e.test/0/f')
  })

  it('retries rate limits, then succeeds', async () => {
    const responses = [json(429, { error: { code: 'RATE_LIMIT_EXCEEDED' } }), json(200, { results: [] })]
    const fetchImpl = vi.fn(async () => responses.shift())
    const sleep = vi.fn(async () => {})
    await createTinyFishClient({ apiKey: 'k', fetchImpl, sleep, minSearchIntervalMs: 0 }).search('q')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalled()
  })

  it('stops with QuotaError on the daily limit (no retry)', async () => {
    const fetchImpl = vi.fn(async () => json(429, { error: { code: 'DAILY_LIMIT_EXCEEDED' } }))
    await expect(make(fetchImpl).search('q')).rejects.toBeInstanceOf(QuotaError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('stops with QuotaError on 402 (wallet / free allowance used)', async () => {
    await expect(make(async () => json(402, { error: { code: 'INSUFFICIENT_CREDITS' } })).search('q')).rejects.toBeInstanceOf(QuotaError)
  })

  it('enforces the 500 searches/hour cap before sending', async () => {
    const fetchImpl = vi.fn(async () => json(200, { results: [] }))
    const client = make(fetchImpl, { maxSearchesPerHour: 3 })
    await client.search('a'); await client.search('b'); await client.search('c')
    await expect(client.search('d')).rejects.toBeInstanceOf(QuotaError)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('enforces the per-run Fetch URL budget before sending', async () => {
    const fetchImpl = vi.fn(async () => json(200, { results: [], errors: [] }))
    const client = make(fetchImpl, { maxFetchUrlsPerRun: 5 })
    await client.fetchText(['https://a.test/1', 'https://a.test/2', 'https://a.test/3'])
    await expect(client.fetchText(['https://b.test/1', 'https://b.test/2', 'https://b.test/3'])).rejects.toBeInstanceOf(QuotaError)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retries a search that times out instead of failing the whisky', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls++
      if (calls === 1) { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; throw e }
      return json(200, { results: [] })
    })
    await expect(make(fetchImpl).search('q')).resolves.toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('spaces searches to stay under 30 per minute', async () => {
    const sleep = vi.fn(async () => {})
    const client = createTinyFishClient({ apiKey: 'k', fetchImpl: async () => json(200, { results: [] }), sleep, minSearchIntervalMs: 2100 })
    await client.search('a'); await client.search('b')
    expect(sleep.mock.calls.some(([ms]) => ms > 0 && ms <= 2100)).toBe(true)
  })
})
