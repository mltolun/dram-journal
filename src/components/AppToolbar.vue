<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <span class="toolbar-title">My collection</span>
      <span v-if="selectedCount > 0" class="compare-badge">{{ selectedCount }} selected</span>
    </div>
    <div class="toolbar-right">
      <button class="btn-t btn-outline" @click="$emit('export')">↓ CSV</button>
      <button class="btn-t btn-compare" :class="{ ready: selectedCount > 0, active: compareOpen }" @click="$emit('compare')">Compare</button>
      <button class="btn-t btn-scan" @click="$emit('scan')" title="Scan a bottle label">📷 Scan</button>
      <button class="btn-t btn-primary" @click="$emit('add')">＋ Add</button>
    </div>
  </div>
</template>

<script setup>
defineProps({ selectedCount: Number, compareOpen: Boolean })
defineEmits(['add', 'compare', 'export', 'scan'])
</script>

<style scoped>
.btn-scan {
  background: transparent;
  color: var(--amber-light);
  border: 0.5px solid rgba(200,130,42,0.35);
}
.btn-scan:hover {
  background: rgba(200,130,42,0.1);
  border-color: var(--amber);
}
</style>
