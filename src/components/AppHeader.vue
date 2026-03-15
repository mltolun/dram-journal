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

const { signOut } = useAuth()

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
