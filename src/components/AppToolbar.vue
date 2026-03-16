<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="list-tabs">
        <button
          class="list-tab"
          :class="{ active: activeList === 'journal' }"
          @click="$emit('setList', 'journal')"
        >🥃 <span class="tab-label">Journal</span></button>
        <button
          class="list-tab"
          :class="{ active: activeList === 'wishlist' }"
          @click="$emit('setList', 'wishlist')"
        >✦ <span class="tab-label">Wishlist</span></button>
      </div>
      <span v-if="selectedCount > 0" class="compare-badge">{{ selectedCount }} selected</span>
    </div>
    <div class="toolbar-right">
      <button
        v-if="activeList === 'journal'"
        class="btn-t btn-compare"
        :class="{ ready: selectedCount > 0, active: compareOpen }"
        @click="$emit('compare')"
      >Compare</button>
      <button
        v-if="activeList === 'wishlist'"
        class="btn-t btn-share-wl"
        @click="$emit('shareWishlist')"
        title="Share your entire wishlist"
      >↗ <span class="btn-label">Share</span></button>
      <button class="btn-t btn-scan" @click="$emit('scan')" title="Scan a bottle label">📷 <span class="btn-label">Scan</span></button>
      <button class="btn-t btn-primary" @click="$emit('add')">＋ <span class="btn-label">Add</span></button>
    </div>
  </div>
</template>

<script setup>
defineProps({ selectedCount: Number, compareOpen: Boolean, activeList: String })
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
