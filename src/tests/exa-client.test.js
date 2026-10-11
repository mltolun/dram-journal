import { describe, it, expect, vi } from 'vitest'
import { createExaClient, QuotaError } from '../../scripts/lib/exa.js'

const jsonRes = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const noSleep = async () => {}

describe('Exa client', () => {
  it('requires an API key', () => {
    expect(() => createExaClient({})).toThrow(/EXA_API_KEY/)
  })

  it('sends the key in x-api-key and asks for page text in the same call', async () => {
    const fetchImpl = vi.fn(async () => jsonRes(200, { results: [{ url: 'https://whiskyfun.com/a', title: 'A', text: 'Nose: peat' }] }))
    const exa = createExaClient({ apiKey: 'k', fetchImpl, sleep: noSleep })
    const out = await exa.search('"Lagavulin 16"')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.exa.ai/search')
    expect(init.headers['x-api-key']).toBe('k')
    const body = JSON.parse(init.body)
    expect(body.query).toBe('"Lagavulin 16"')
    expect(body.contents.text.maxCharacters).toBeGreaterThan(0)
    expect(out).toEqual([{ url: 'https://whiskyfun.com/a', title: 'A', text: 'Nose: peat', publishedDate: null }])
  })

  it('retries 429 and 5xx with backoff, then succeeds', async () => {
    const responses = [jsonRes(429, {}), jsonRes(503, {}), jsonRes(200, { results: [] })]
    const fetchImpl = vi.fn(async () => responses.shift())
    const sleep = vi.fn(async () => {})
    const out = await createExaClient({ apiKey: 'k', fetchImpl, sleep }).search('q')
    expect(out).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('raises QuotaError on 402 so the job stops instead of marking rows', async () => {
    const fetchImpl = vi.fn(async () => jsonRes(402, { error: 'no credits' }))
    await expect(createExaClient({ apiKey: 'k', fetchImpl, sleep: noSleep }).search('q')).rejects.toBeInstanceOf(QuotaError)
  })

  it('raises QuotaError when 429 persists past the retry budget', async () => {
    const fetchImpl = vi.fn(async () => jsonRes(429, {}))
    await expect(createExaClient({ apiKey: 'k', fetchImpl, sleep: noSleep, maxRetries: 2 }).search('q')).rejects.toBeInstanceOf(QuotaError)
  })
})
