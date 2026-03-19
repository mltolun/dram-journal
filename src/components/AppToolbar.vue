<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="list-tabs">
        <button
          class="list-tab"
          :class="{ active: activeList === 'journal' }"
          @click="$emit('setList', 'journal')"
        >🥃 <span class="tab-label">{{ t.journal }}</span></button>
        <button
          class="list-tab"
          :class="{ active: activeList === 'wishlist' }"
          @click="$emit('setList', 'wishlist')"
        >✦ <span class="tab-label">{{ t.wishlist }}</span></button>
      </div>
      <button
        v-if="selectedCount > 0"
        class="compare-badge compare-badge--clear"
        @click.prevent.stop="onClearSelected"
        :title="t.clearSelected"
        type="button"
      >{{ selectedCount }} {{ t.selected }} ✕</button>
    </div>
    <div class="toolbar-right">
      <button
        v-if="activeList === 'journal'"
        class="btn-t btn-compare"
        :class="{ ready: selectedCount >= 2, active: compareOpen }"
        :disabled="selectedCount < 2"
        @click="$emit('compare')"
      >{{ t.compare }}</button>
      <button
        v-if="activeList === 'wishlist'"
        class="btn-t btn-share-wl"
        @click="$emit('shareWishlist')"
        :title="t.share"
      >↗ <span class="btn-label">{{ t.share }}</span></button>
      <button class="btn-t btn-scan" @click="$emit('scan')" :title="t.scan">📷 <span class="btn-label">{{ t.scan }}</span></button>
      <button class="btn-t btn-primary" @click="$emit('add')">＋ <span class="btn-label">{{ t.add }}</span></button>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../composables/useI18n.js'
const { t } = useI18n()
defineProps({ selectedCount: Number, compareOpen: Boolean, activeList: String, onClearSelected: Function })
defineEmits(['add', 'compare', 'scan', 'setList', 'shareWishlist'])
</script>

<style scoped>
.list-tabs {
  display: flex;
  gap: 2px;
  background: rgba(200,130,42,0.06);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 3px;
}
.list-tab {
  padding: 5px 14px;
  border-radius: 5px;
  background: transparent;
  border: none;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
}
.list-tab.active {
  background: var(--amber);
  color: var(--peat);
  font-weight: 500;
}
.list-tab:not(.active):hover {
  color: var(--amber-light);
}
.btn-scan {
  background: transparent;
  color: var(--amber-light);
  border: 0.5px solid rgba(200,130,42,0.35);
}
.btn-scan:hover {
  background: rgba(200,130,42,0.1);
  border-color: var(--amber);
}
.btn-share-wl {
  background: transparent;
  color: var(--amber-light);
  border: 0.5px solid rgba(200,130,42,0.35);
}
.btn-share-wl:hover {
  background: rgba(200,130,42,0.1);
  border-color: var(--amber);
}
</style>
