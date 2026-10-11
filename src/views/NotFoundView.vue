<template>
  <main class="nf" role="main">
    <h1 class="nf-title">{{ t.pageNotFound }}</h1>
    <p class="nf-body">{{ t.pageNotFoundBody }}</p>
    <RouterLink to="/" class="btn-t btn-primary nf-link">{{ t.backToJournal }}</RouterLink>
  </main>
</template>

<script setup>
import { useI18n } from '../composables/useI18n.js'
import { useNoindex } from '../composables/useNoindex.js'

const { t } = useI18n()
useNoindex()
</script>

<style scoped>
.nf { min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 24px; text-align: center; }
.nf-title { font-size: 1.4rem; font-weight: 600; color: var(--text-primary); }
.nf-body { color: var(--text-secondary, var(--peat-light)); font-size: 0.9rem; max-width: 36ch; }
.nf-link { text-decoration: none; margin-top: 8px; }
</style>
