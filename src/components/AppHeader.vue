<template>
  <header>
    <div>
      <div class="brand-title">The <span>Dram</span> Journal</div>
      <div class="brand-sub">Whisky tasting & comparison log</div>
    </div>
    <div class="header-right">
      <div>
        <div class="stat-count">{{ whiskies.length }}</div>
        <div class="stat-label">drams</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
        <div class="sync-indicator">
          <span class="sync-dot" :style="{ background: syncColor }"></span>
          <span class="sync-text">{{ syncLabel }}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="header-email">{{ currentUser?.email }}</span>
          <button class="btn-theme" @click="cycleTheme" :title="`Theme: ${theme}`">{{ themeIcon }}</button>
          <button class="btn-signout" @click="doSignOut">Sign out</button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { whiskies, syncStatus } from '../composables/useWhiskies.js'
import { useTheme } from '../composables/useTheme.js'

const { signOut } = useAuth()
const { theme, cycleTheme } = useTheme()

const themeIcon = computed(() => ({
  whisky: '🥃',
  dark: '🌑',
  light: '☀️'
})[theme.value] || '🥃')

const syncColor = computed(() => ({
  loading: '#7A6255', saving: '#E8A84C', ok: '#1D9E75', error: '#E24B4A'
})[syncStatus.value] || '#1D9E75')

const syncLabel = computed(() => ({
  loading: 'loading…', saving: 'saving…', ok: 'synced', error: 'error'
})[syncStatus.value] || 'synced')

async function doSignOut() {
  await signOut()
}
</script>

<style scoped>
.btn-theme {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 5px;
  font-size: 0.85rem;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.6;
}
.btn-theme:hover {
  border-color: var(--amber);
  transform: scale(1.1);
}
</style>
