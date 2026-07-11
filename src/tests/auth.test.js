import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockSignInWithPassword = vi.fn()
const mockSignUp = vi.fn()
const mockSignOut = vi.fn()
const mockResetPasswordForEmail = vi.fn()
const mockUpdateUser = vi.fn()
const mockGetSession = vi.fn()

vi.mock('../lib/supabase.js', () => ({
  sb: {
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      signOut: mockSignOut,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
      getSession: mockGetSession,
    },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}))

describe('useAuth', () => {
  beforeEach(() => {
    localStorage.setItem('dj_locale', 'en')
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('signIn calls signInWithPassword with email and password', async () => {
    const user = { id: 'u1', email: 'a@b.com', user_metadata: { locale: 'en' } }
    mockSignInWithPassword.mockResolvedValue({ data: { user, session: {} }, error: null })

    const { useAuth } = await import('../composables/useAuth.js')
    const { signIn } = useAuth()
    const result = await signIn('a@b.com', 'pass')

    expect(mockSignInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' })
    expect(result).toEqual(user)
  })

  it('signIn throws on error', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: null }, error: new Error('Invalid login') })

    const { useAuth } = await import('../composables/useAuth.js')
    const { signIn } = useAuth()
    await expect(signIn('a@b.com', 'wrong')).rejects.toThrow('Invalid login')
  })

  it('signUp calls signUp with email and password', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null })

    const { useAuth } = await import('../composables/useAuth.js')
    const { signUp } = useAuth()
    const result = await signUp('a@b.com', 'pass')

    expect(mockSignUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' })
  })

  it('signUp throws on error', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: new Error('Email taken') })

    const { useAuth } = await import('../composables/useAuth.js')
    const { signUp } = useAuth()
    await expect(signUp('a@b.com', 'pass')).rejects.toThrow('Email taken')
  })

  it('signOut calls auth signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    const { useAuth } = await import('../composables/useAuth.js')
    const { signOut } = useAuth()
    await signOut()

    expect(mockSignOut).toHaveBeenCalledOnce()
  })

  it('forgotPassword calls resetPasswordForEmail', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null })

    const { useAuth } = await import('../composables/useAuth.js')
    const { forgotPassword } = useAuth()
    await forgotPassword('a@b.com')

    expect(mockResetPasswordForEmail).toHaveBeenCalled()
  })

  it('forgotPassword throws on error', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: new Error('User not found') })

    const { useAuth } = await import('../composables/useAuth.js')
    const { forgotPassword } = useAuth()
    await expect(forgotPassword('a@b.com')).rejects.toThrow('User not found')
  })

  it('getSession restores session', async () => {
    const user = { id: 'u1', email: 'a@b.com', user_metadata: { locale: 'en' } }
    mockGetSession.mockResolvedValue({ data: { session: { user } }, error: null })

    const { useAuth } = await import('../composables/useAuth.js')
    const { getSession } = useAuth()
    const session = await getSession()

    expect(mockGetSession).toHaveBeenCalledOnce()
    expect(session.user).toEqual(user)
  })
})
