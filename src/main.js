import { createApp } from 'vue'
import { router } from './router.js'
import App from './App.vue'
import './styles/global.css'
import { sb } from './lib/supabase.js'

// Apply saved theme before mount to avoid flash
const savedTheme = localStorage.getItem('dram-theme') || 'whisky'
document.documentElement.setAttribute('data-theme', savedTheme)

async function init() {
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
        window.location.hash = '#/reset'
      }
    }
  } catch (e) {
    console.warn('Recovery session error:', e)
    // Don't block mount if recovery fails
  }

  createApp(App).use(router).mount('#app')
}

init()
