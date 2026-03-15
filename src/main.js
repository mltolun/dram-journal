import { createApp } from 'vue'
import { router } from './router.js'
import App from './App.vue'
import './styles/global.css'
import { sb } from './lib/supabase.js'

// Apply saved theme before mount to avoid flash
const savedTheme = localStorage.getItem('dram-theme') || 'whisky'
document.documentElement.setAttribute('data-theme', savedTheme)

async function init() {
  // Supabase recovery emails land with a hash like:
  // #access_token=xxx&refresh_token=yyy&type=recovery
  // This happens BEFORE Vue mounts, so we must handle it here.
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

  createApp(App).use(router).mount('#app')
}

init()
