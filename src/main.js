import { storage } from './lib/storage.js'
import { createApp } from 'vue'
import { router } from './router.js'
import App from './App.vue'
import './styles/fonts.css'
import './styles/global.css'
import { sb } from './lib/supabase.js'
import { locale, ensureLocaleLoaded } from './composables/useI18n.js'

// Apply saved theme before mount to avoid flash
const savedTheme = storage.get('dram-theme') || 'whisky'
document.documentElement.setAttribute('data-theme', savedTheme)

async function init() {
  let goToReset = false
  try {
    // Supabase recovery emails land with a hash like:
    // #access_token=xxx&refresh_token=yyy&type=recovery
    const rawHash = window.location.hash
    if (rawHash.includes('type=recovery')) {
      const params = new URLSearchParams(rawHash.replace(/^#/, ''))
      const accessToken  = params.get('access_token')
      const refreshToken = params.get('refresh_token') ?? ''
      if (accessToken) {
        await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        goToReset = true
      }
    }
  } catch (e) {
    console.warn('Recovery session error:', e)
    // Don't block mount if recovery fails
  }

  // Load the visitor's language before first paint so Spanish users don't
  // see an English flash (English itself is bundled).
  await ensureLocaleLoaded(locale.value)

  createApp(App).use(router).mount('#app')
  if (goToReset) router.replace('/reset')
}

init()
