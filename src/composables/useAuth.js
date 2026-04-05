import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { useI18n, detectLocale } from './useI18n.js'

export const currentUser = ref(null)

async function syncLocaleFromUser(user) {
  const storedLocale = user?.user_metadata?.locale
  if (storedLocale && ['en', 'es'].includes(storedLocale)) {
    // User already has a saved locale in their profile — use it
    const { setLocale } = useI18n()
    setLocale(storedLocale)
  } else {
    // No locale in user metadata yet — detect and save it
    await detectLocale()
    const detectedLocale = localStorage.getItem('dj_locale')
    if (detectedLocale && ['en', 'es'].includes(detectedLocale)) {
      sb.auth.updateUser({ data: { locale: detectedLocale } })
    }
  }
}

export function useAuth() {
  async function signIn(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw error
    currentUser.value = data.user
    await syncLocaleFromUser(data.user)
    return data.user
  }

  async function signUp(email, password) {
    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) throw error
    if (data.user && data.session) {
      currentUser.value = data.user
      // New user — detect locale from browser/IP and persist to their profile
      await detectLocale()
      const detectedLocale = localStorage.getItem('dj_locale')
      if (detectedLocale && ['en', 'es'].includes(detectedLocale)) {
        sb.auth.updateUser({ data: { locale: detectedLocale } })
      }
    }
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
      await syncLocaleFromUser(session.user)
    }
    return session
  }

  return { currentUser, signIn, signUp, signOut, forgotPassword, updatePassword, getSession }
}