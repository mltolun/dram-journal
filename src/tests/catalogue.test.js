import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRpc  = vi.fn()
const mockFrom = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  sb: { rpc: mockRpc, from: mockFrom },
}))

function makeBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    or:     vi.fn(() => builder),
    order:  vi.fn(() => builder),
    limit:  vi.fn(() => builder),
    ilike:  vi.fn(() => builder),
    eq:     vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    then:   (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

function row(overrides = {}) {
  return {
    id: 'x', name: 'Whisky', distillery: 'Distillery',
    country: 'Scotland', region: 'Speyside', type: 'scotch',
    age: 10, abv: '46%', price_band: '€40–€60', photo_url: null,
    nose: '', palate: '', dulzor: 3, ahumado: 1, cuerpo: 3, frutado: 3, especiado: 2,
    ...overrides,
  }
}

async function getMod() {
  const mod = await import('../composables/useCatalogue.js')
  return { ...mod, ...mod.useCatalogue() }
}

describe('useCatalogue helpers', () => {
  it('cleanSearchQuery strips noise words, dedupes and caps at 4', async () => {
    const { cleanSearchQuery } = await getMod()
    expect(cleanSearchQuery('Lagavulin 16 Years Old single malt')).toBe('lagavulin 16')
    expect(cleanSearchQuery('Ardbeg Ardbeg 10 10')).toBe('ardbeg 10')
    expect(cleanSearchQuery('a b c d e f g')).toBe('')
  })

  it('searchKeywords falls back to raw words when all tokens are noise', async () => {
    const { searchKeywords } = await getMod()
    expect(searchKeywords('Lagavulin 16 years')).toEqual(['lagavulin', '16'])
    expect(searchKeywords('single malt')).toEqual(['single', 'malt'])
  })

  it('normalizeQuery collapses case and whitespace', async () => {
    const { normalizeQuery } = await getMod()
    expect(normalizeQuery('  Ardbeg   10  ')).toBe('ardbeg 10')
  })
})

describe('useCatalogue search', () => {
  let currentUser

  beforeEach(async () => {
    localStorage.setItem('dj_locale', 'en')
    vi.clearAllMocks()
    currentUser = (await import('../composables/useAuth.js')).currentUser
    currentUser.value = { id: 'u1', email: 'test@test.com' }
    const mod = await import('../composables/useCatalogue.js')
    mod.clearCatalogueCache()
  })

  afterEach(() => {
    localStorage.clear()
    if (currentUser) currentUser.value = null
  })

  it('runs one server-ranked query and orders results', async () => {
    mockRpc.mockResolvedValue({
      data: [
        row({ id: '1', name: 'Ardbeg TEN', distillery: 'Ardbeg' }),
        row({ id: '2', name: 'Ardbeg 10',  distillery: 'Ardbeg' }),
        row({ id: '3', name: 'Something',  distillery: 'Ardbeg' }),
      ],
      error: null,
    })

    const m = await getMod()
    await m.search('Ardbeg 10')

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('catalogue_search', expect.objectContaining({
      p_raw: 'Ardbeg 10',
      p_words: ['ardbeg', '10'],
    }))
    expect(m.results.value.map(r => r.id)).toEqual(['2', '1', '3'])
  })

  it('serves equivalent normalized queries from cache', async () => {
    mockRpc.mockResolvedValue({ data: [row({ id: '1', name: 'Ardbeg 10' })], error: null })

    const m = await getMod()
    await m.search('Ardbeg 10')
    await m.search('  ARDBEG   10 ')

    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('dedupes concurrent identical searches into one request', async () => {
    mockRpc.mockResolvedValue({ data: [row({ id: '1', name: 'Ardbeg 10' })], error: null })

    const m = await getMod()
    await Promise.all([m.search('Ardbeg 10'), m.search('ardbeg  10')])

    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(m.results.value).toHaveLength(1)
  })

  it('falls back to direct parallel queries when the RPC is missing', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.catalogue_search' },
    })
    mockFrom.mockReturnValue(makeBuilder({
      data: [row({ id: '1', name: 'Ardbeg 10' }), row({ id: '1', name: 'Ardbeg 10' })],
      error: null,
    }))

    const m = await getMod()
    await m.search('Ardbeg 10')

    // exact + fuzzy queries fired together
    expect(mockFrom).toHaveBeenCalledTimes(2)
    expect(m.results.value.map(r => r.id)).toEqual(['1'])
  })

  it('surfaces real errors as searchError', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } })

    const m = await getMod()
    await m.search('Ardbeg 10')

    expect(m.searchError.value).toBe(true)
    expect(m.results.value).toEqual([])
  })

  it('returns nothing when no user is signed in', async () => {
    currentUser.value = null
    const m = await getMod()
    await m.search('Ardbeg 10')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('caches getById results', async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: row({ id: 'abc', name: 'Cached' }), error: null }))

    const m = await getMod()
    const first  = await m.getById('abc')
    const second = await m.getById('abc')

    expect(first.name).toBe('Cached')
    expect(second.name).toBe('Cached')
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})

describe('fetchDistinctValues', () => {
  beforeEach(async () => {
    localStorage.setItem('dj_locale', 'en')
    vi.clearAllMocks()
    const mod = await import('../composables/useCatalogue.js')
    mod.clearCatalogueCache()
  })

  it('uses the distinct RPC and caches per term', async () => {
    mockRpc.mockResolvedValue({ data: ['Ardbeg', 'Ardbeg'], error: null })

    const { fetchDistinctValues } = await import('../composables/useCatalogue.js')
    const first  = await fetchDistinctValues('distillery', 'ard')
    const second = await fetchDistinctValues('distillery', '  ARD ')

    expect(first).toEqual(['Ardbeg'])
    expect(second).toEqual(['Ardbeg'])
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('rejects non-autocomplete columns at the DB layer only', async () => {
    // The client never sends an unsupported column; the RPC raises. Here we
    // just confirm a real error is propagated rather than swallowed.
    mockRpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'unsupported catalogue column: name' } })

    const { fetchDistinctValues } = await import('../composables/useCatalogue.js')
    await expect(fetchDistinctValues('name', 'ard')).rejects.toMatchObject({ code: 'XX000' })
  })
})
