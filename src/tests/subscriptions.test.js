import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  sb: {
    auth: { updateUser: vi.fn() },
    from: mockFrom,
    rpc: mockRpc,
  },
}))

function makeBuilder(result = { data: [], error: null }) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  }
  return builder
}

describe('useSubscriptions', () => {
  let currentUser

  beforeEach(async () => {
    localStorage.setItem('dj_locale', 'en')
    vi.clearAllMocks()
    currentUser = (await import('../composables/useAuth.js')).currentUser
    currentUser.value = { id: 'u1', email: 'me@test.com' }
    // Reset subscriptions state
    const mod = await import('../composables/useSubscriptions.js')
    mod.pendingRequests.value = []
    mod.myFollowing.value = []
    mod.myFollowers.value = []
    mod.subscriptionsLoaded.value = false
  })

  afterEach(() => {
    localStorage.clear()
    if (currentUser) currentUser.value = null
  })

  async function getMod() {
    const mod = await import('../composables/useSubscriptions.js')
    return { ...mod, ...mod.useSubscriptions() }
  }

  it('requestFollowByEmail calls rpc and inserts subscription', async () => {
    mockRpc.mockResolvedValue({ data: 'target-id', error: null })
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.requestFollowByEmail('friend@test.com')

    expect(mockRpc).toHaveBeenCalledWith('get_user_id_by_email', { p_email: 'friend@test.com' })
    expect(mockFrom).toHaveBeenCalledWith('subscriptions')
  })

  it('requestFollowByEmail prevents self-follow', async () => {
    const m = await getMod()
    await expect(m.requestFollowByEmail('me@test.com')).rejects.toThrow('cannot follow yourself')
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('requestFollowByEmail throws when user not found', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const m = await getMod()
    await expect(m.requestFollowByEmail('ghost@test.com')).rejects.toThrow('No user found')
  })

  it('loadSubscriptions fetches and classifies subscriptions', async () => {
    const rows = [
      { id: 's1', follower_id: 'u1', following_id: 'other1', status: 'accepted' },
      { id: 's2', follower_id: 'other2', following_id: 'u1', status: 'accepted' },
      { id: 's3', follower_id: 'other3', following_id: 'u1', status: 'pending' },
    ]
    mockFrom.mockReturnValue(makeBuilder({ data: rows, error: null }))

    const m = await getMod()
    await m.loadSubscriptions()

    expect(m.myFollowing.value.length).toBe(1)   // u1 follows other1
    expect(m.myFollowers.value.length).toBe(1)   // other2 follows u1
    expect(m.pendingRequests.value.length).toBe(1) // other3 pending
    expect(m.subscriptionsLoaded.value).toBe(true)
  })

  it('logActivity inserts activity_feed row', async () => {
    mockFrom.mockReturnValue(makeBuilder())

    const m = await getMod()
    await m.logActivity({
      type: 'dram_logged',
      whiskyId: 'w1',
      whiskyName: 'Test',
    })

    expect(mockFrom).toHaveBeenCalledWith('activity_feed')
  })
})
