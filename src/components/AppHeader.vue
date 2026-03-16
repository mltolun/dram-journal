<template>
  <header>
    <div class="header-top">
      <div class="header-brand">
        <div class="brand-title">The <span>Dram</span> Journal</div>
        <div class="brand-sub">Whisky tasting & comparison log</div>
      </div>
      <div class="header-right">
        <button class="btn-theme" @click="cycleTheme" :title="`Theme: ${theme}`">{{ themeIcon }}</button>
        <button class="btn-signout" @click="doSignOut">Sign out</button>
        <div class="user-avatar" :title="currentUser?.email">
          <span class="avatar-letter">{{ avatarLetter }}</span>
          <span class="avatar-sync-dot" :style="{ background: syncColor }"></span>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { syncStatus } from '../composables/useWhiskies.js'
import { useTheme } from '../composables/useTheme.js'

const { signOut } = useAuth()
const { theme, cycleTheme } = useTheme()

const avatarLetter = computed(() =>
  (currentUser.value?.email?.[0] ?? '?').toUpperCase()
)

const themeIcon = computed(() => ({
  whisky: '🥃',
  dark: '🌑',
  light: '☀️'
})[theme.value] || '🥃')

const syncColor = computed(() => ({
  loading: '#7A6255', saving: '#E8A84C', ok: '#1D9E75', error: '#E24B4A'
})[syncStatus.value] || '#1D9E75')

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
  color: var(--text-primary);
}
.btn-theme:hover {
  border-color: var(--amber);
  transform: scale(1.1);
}

/* Avatar */
.user-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(200, 130, 42, 0.15);
  border: 0.5px solid var(--border-hi);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.avatar-letter {
  font-family: 'DM Mono', monospace;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--amber-light);
  line-height: 1;
  user-select: none;
}
.avatar-sync-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--bg);
  transition: background 0.3s;
}
</style>
