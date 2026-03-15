import { createApp } from 'vue'
import { router } from './router.js'
import App from './App.vue'
import './styles/global.css'
import { sb } from './lib/supabase.js'

// Apply saved theme before mount to avoid flash
const savedTheme = localStorage.getItem('dram-theme') || 'whisky'
document.documentElement.setAttribute('data-theme', savedTheme)

// Supabase recovery emails land with a hash like:
// #access_token=xxx&refresh_token=yyy&type=recovery
// This happens BEFORE Vue mounts, so we must handle it here.
// We pull the tokens out, set the session, rewrite the URL to
// /#/reset so Vue Router sees a valid route, then mount.
const rawHash = window.location.hash
if (rawHash.includes('type=recovery')) {
  const params = new URLSearchParams(rawHash.replace(/^#/, ''))
  const accessToken  = params.get('access_token')
  const refreshToken = params.get('refresh_token') ?? ''
  if (accessToken) {
    // Set the session so updateUser() works on the reset page
    await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    // Replace the ugly token hash with the reset route
    window.location.hash = '#/reset'
  }
}

createApp(App).use(router).mount('#app')
