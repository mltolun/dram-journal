import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSignOut = vi.fn()
const mockRpc = vi.fn()
const mockFrom = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockSignUp = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  sb: {
    auth: {
      signOut: mockSignOut, resetPasswordForEmail: mockResetPasswordForEmail, signUp: mockSignUp,
      signInWithPassword: vi.fn(), updateUser: vi.fn(), getSession: vi.fn(),
    },
    from: mockFrom,
    rpc: mockRpc,
  },
}))

// A Map-backed Storage with the standard length/key() API.
function makeStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: k => { m.delete(k) },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size },
  }
}

describe('storage helper (blocked / throwing localStorage)', () => {
  const real = globalThis.localStorage
  afterEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: real, writable: true, configurable: true }) })

  it('never throws when localStorage access is denied', async () => {
    const boom = () => { throw new DOMException('denied', 'SecurityError') }
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: boom, setItem: boom, removeItem: boom, key: boom, get length() { return boom() } },
      writable: true, configurable: true,
    })
    const { storage } = await import('../lib/storage.js')
    expect(storage.get('x')).toBeNull()
    expect(storage.set('x', 1)).toBe(false)
    expect(() => storage.remove('x')).not.toThrow()
    expect(() => storage.removeByPrefix('dram-draft-')).not.toThrow()
  })

  it('removeByPrefix only removes matching keys', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: makeStorage({ 'dram-draft-1': 'a', 'dram-draft-2': 'b', 'dram-theme': 'dark' }),
      writable: true, configurable: true,
    })
    const { storage } = await import('../lib/storage.js')
    storage.removeByPrefix('dram-draft-')
    expect(storage.get('dram-draft-1')).toBeNull()
    expect(storage.get('dram-draft-2')).toBeNull()
    expect(storage.get('dram-theme')).toBe('dark')
  })
})

describe('useAuth hardening', () => {
  const real = globalThis.localStorage
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules() })
  afterEach(() => { Object.defineProperty(globalThis, 'localStorage', { value: real, writable: true, configurable: true }) })

  it('signOut wipes private tasting drafts', async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: makeStorage({ 'dram-draft-42': '{"notes":"private"}', 'dj_locale': 'en' }),
      writable: true, configurable: true,
    })
    mockSignOut.mockResolvedValue({})
    const { useAuth } = await import('../composables/useAuth.js')
    await useAuth().signOut()
    expect(localStorage.getItem('dram-draft-42')).toBeNull()
    expect(localStorage.getItem('dj_locale')).toBe('en')
  })

  it('signUp no longer inserts self-approved subscriptions from the browser', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'n@x.com' }, session: {} }, error: null })
    localStorage.setItem('dj_locale', 'en')
    const { useAuth } = await import('../composables/useAuth.js')
    await useAuth().signUp('n@x.com', 'a-long-password')
    expect(mockFrom).not.toHaveBeenCalledWith('subscriptions')
    expect(mockRpc).not.toHaveBeenCalledWith('get_user_id_by_email', expect.anything())
  })

  it('password reset redirect never includes the current path or admin data', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })
    const { useAuth } = await import('../composables/useAuth.js')
    await useAuth().forgotPassword('a@b.com')
    const { redirectTo } = mockResetPasswordForEmail.mock.calls[0][1]
    expect(new URL(redirectTo).pathname).toBe('/')
    expect(new URL(redirectTo).search).toBe('?recovery=1')
  })
})

describe('admin flag comes from the server, not the bundle', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.resetModules() })

  it('isAdmin() is false until is_admin() says so', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null })
    const { currentUser } = await import('../composables/useAuth.js')
    const { useFeatureRequests } = await import('../composables/useFeatureRequests.js')
    currentUser.value = { id: 'u1', email: 'someone@x.com' }
    const fr = useFeatureRequests()
    expect(fr.isAdmin()).toBe(false)
    expect(await fr.loadAdminStatus()).toBe(true)
    expect(mockRpc).toHaveBeenCalledWith('is_admin')
    expect(fr.isAdmin()).toBe(true)
  })

  it('stays non-admin on RPC error or non-true result', async () => {
    const { currentUser } = await import('../composables/useAuth.js')
    const { useFeatureRequests } = await import('../composables/useFeatureRequests.js')
    currentUser.value = { id: 'u1', email: 'someone@x.com' }
    const fr = useFeatureRequests()
    mockRpc.mockResolvedValueOnce({ data: null, error: new Error('nope') })
    expect(await fr.loadAdminStatus()).toBe(false)
    mockRpc.mockResolvedValueOnce({ data: false, error: null })
    expect(await fr.loadAdminStatus()).toBe(false)
  })

  it('the bundle no longer reads VITE_ADMIN_EMAILS', async () => {
    const fs = await import('node:fs')
    for (const f of ['src/composables/useAuth.js', 'src/composables/useFeatureRequests.js']) {
      expect(fs.readFileSync(f, 'utf8')).not.toMatch(/VITE_ADMIN_EMAILS/)
    }
  })
})

describe('i18n lazy locale + no third-party IP lookup', () => {
  beforeEach(() => { vi.resetModules() })

  it('does not call ipapi.co when the browser language is unsupported', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    localStorage.clear()
    Object.defineProperty(navigator, 'languages', { value: ['fr-FR'], configurable: true })
    const { detectLocale, useI18n } = await import('../composables/useI18n.js')
    await detectLocale()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useI18n().locale.value).toBe('en')
    fetchSpy.mockRestore()
  })

  it('loads Spanish on demand and falls back to English until then', async () => {
    localStorage.clear()
    const { useI18n, ensureLocaleLoaded } = await import('../composables/useI18n.js')
    const { t, setLocale } = useI18n()
    const enBrand = t.value.pageNotFound
    setLocale('es')
    await ensureLocaleLoaded('es')
    expect(t.value.pageNotFound).not.toBe(enBrand)
    expect(document.documentElement.lang).toBe('es')
  })
})

describe('router', () => {
  it('serves real paths and a catch-all 404', async () => {
    const { router } = await import('../router.js')
    expect(router.resolve('/share/abc123').matched).toHaveLength(1)
    expect(router.resolve('/wishlist/abc123').path).toBe('/wishlist/abc123')
    const nf = router.resolve('/definitely/not/here')
    expect(nf.matched[0].path).toBe('/:pathMatch(.*)*')
  })
})
