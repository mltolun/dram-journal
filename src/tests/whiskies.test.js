import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

let mockQueryResult = { data: null, error: null }
let mockSingleResult = { data: null, error: null }

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockAuthUpdateUser = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  sb: {
    auth: { updateUser: mockAuthUpdateUser },
    from: mockFrom,
    rpc: mockRpc,
  },
}))

function makeBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => {
      const s = { ...builder }
      s.then = (resolve) => resolve(mockSingleResult)
      return s
    }),
    then: (resolve) => resolve(mockQueryResult),
  }
  return builder
}

function stubWhisky(overrides = {}) {
  return {
    id: 'w1', user_id: 'u1', list: 'journal',
    name: 'Test Whisky', distillery: 'Test Distillery',
    origin: 'Scotland', region: 'Speyside', type: 'scotch',
    age: '10 years', abv: '46%', price: '£50', rating: 4,
    nose: 'Vanilla', palate: 'Sweet', notes: 'Nice',
    dulzor: 3, ahumado: 1, cuerpo: 2, frutado: 3, especiado: 1,
    photo_url: null, date: '2024-01-15',
    bottle_count: 0, last_finished: null, drams_logged: 0,
    last_dram_logged: null, deleted_at: null,
    created_at: '2024-01-15T00:00:00Z',
    catalogue_id: null, catalogue: null,
    ...overrides,
  }
}

describe('useWhiskies', () => {
  let currentUser

  beforeEach(async () => {
    localStorage.setItem('dj_locale', 'en')
    mockQueryResult = { data: null, error: null }
    mockSingleResult = { data: null, error: null }
    vi.clearAllMocks()
    // Set currentUser so loadDramLogs doesn't crash
    currentUser = (await import('../composables/useAuth.js')).currentUser
    currentUser.value = { id: 'u1', email: 'test@test.com' }
    // Reset module-level state from prior tests
    const mod = await import('../composables/useWhiskies.js')
    mod.whiskies.value = []
    mod.dramLogs.value = []
  })

  afterEach(() => {
    localStorage.clear()
    if (currentUser) currentUser.value = null
  })

  async function getMod() {
    const mod = await import('../composables/useWhiskies.js')
    return { ...mod, ...mod.useWhiskies() }
  }

  it('loadWhiskies fetches and sets whiskies', async () => {
    const whiskiesData = [stubWhisky({ id: 'w1', name: 'A' }), stubWhisky({ id: 'w2', name: 'B' })]
    mockQueryResult = { data: whiskiesData, error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()

    expect(m.whiskies.value.length).toBe(2)
    expect(m.whiskies.value[0].name).toBe('A')
    expect(mockFrom).toHaveBeenCalledWith('whiskies')
  })

  it('loadWhiskies handles errors', async () => {
    mockQueryResult = { data: null, error: new Error('DB error') }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()

    expect(m.whiskies.value).toEqual([])
    expect(m.syncStatus.value).toBe('error')
  })

  it('insertWhisky inserts to journal', async () => {
    const inserted = stubWhisky({ id: 'new1', name: 'New Whisky', user_id: 'u1' })
    mockSingleResult = { data: inserted, error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    const result = await m.insertWhisky({ name: 'New Whisky', list: 'journal' })

    expect(result).toBeDefined()
    expect(m.whiskies.value.some(w => w.name === 'New Whisky')).toBe(true)
  })

  it('rejects duplicate by catalogue_id', async () => {
    const existing = stubWhisky({ id: 'w1', catalogue_id: 'cat1' })
    mockQueryResult = { data: [existing], error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()

    await expect(m.insertWhisky({ name: 'Duplicate', catalogue_id: 'cat1' }))
      .rejects.toThrow('already in your')
  })

  it('rejects duplicate by name and distillery', async () => {
    const existing = stubWhisky({ id: 'w1', name: 'Arran 10', distillery: 'Arran' })
    mockQueryResult = { data: [existing], error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()

    await expect(m.insertWhisky({ name: 'Arran 10', distillery: 'Arran' }))
      .rejects.toThrow('already in your')
  })

  it('allows duplicate in trash', async () => {
    const existing = stubWhisky({ id: 'w1', name: 'Arran 10', distillery: 'Arran', list: 'trash' })
    mockQueryResult = { data: [existing], error: null }
    mockSingleResult = { data: stubWhisky({ id: 'w2', name: 'Arran 10', distillery: 'Arran' }), error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()

    await expect(m.insertWhisky({ name: 'Arran 10', distillery: 'Arran' }))
      .resolves.toBeDefined()
  })

  it('moveToTrash updates list', async () => {
    const whisky = stubWhisky({ id: 'w1' })
    mockQueryResult = { data: [whisky], error: null }
    mockSingleResult = { data: { ...whisky, list: 'trash', deleted_at: new Date().toISOString() }, error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()
    await m.moveToTrash('w1')

    const builder = mockFrom.mock.results[0].value
    expect(builder.update).toHaveBeenCalled()
    expect(builder.eq).toHaveBeenCalledWith('id', 'w1')
  })

  it('updateWhisky updates by id', async () => {
    const whisky = stubWhisky({ id: 'w1', name: 'Original', rating: 3 })
    const updated = { ...whisky, name: 'Updated', rating: 5 }
    mockQueryResult = { data: [whisky], error: null }
    mockSingleResult = { data: updated, error: null }
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.loadWhiskies()

    const result = await m.updateWhisky('w1', { name: 'Updated' })
    expect(result.name).toBe('Updated')
  })
})
