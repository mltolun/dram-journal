import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { useI18n } from './useI18n.js'

export const currentUser = ref(null)

function syncLocaleFromUser(user) {
  const storedLocale = user?.user_metadata?.locale
  if (storedLocale && ['en', 'es'].includes(storedLocale)) {
    const { setLocale } = useI18n()
    setLocale(storedLocale)
  }
}

export function useAuth() {
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    currentUser.value = data.user
    syncLocaleFromUser(data.user)
    return data.user
  }

  async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) throw error
    if (data.user && data.session) currentUser.value = data.user
    return data
  }

  async function signOut() {
    await sb.auth.signOut()
    currentUser.value = null
  }

  async function forgotPassword(email) {
    const base = window.location.origin + window.location.pathname
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: base + '?recovery=1',
    })
    if (error) throw error
  }

  async function updatePassword(password) {
    const { error } = await sb.auth.updateUser({ password })
    if (error) throw error
  }

  async function getSession() {
    const { data: { session } } = await sb.auth.getSession()
    if (session) {
      currentUser.value = session.user
      syncLocaleFromUser(session.user)
    }
    return session
  }

  return { currentUser, signIn, signUp, signOut, forgotPassword, updatePassword, getSession }
}
