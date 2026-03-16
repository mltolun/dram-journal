<template>
  <div class="wcard" :class="{ selected, wishlist: isWishlist }" :style="selectColor ? `border-color:${selectColor}` : ''" @click="$emit('toggle')">
    <div v-if="!isWishlist" class="sel-ring" :style="selectColor ? `background:${selectColor};border-color:${selectColor}` : ''"></div>

    <!-- Wishlist badge -->
    <div v-if="isWishlist" class="wishlist-badge">✦ Wishlist</div>

    <img v-if="whisky.photo_url" class="wcard-photo" :src="whisky.photo_url" :alt="whisky.name" loading="lazy">

    <div>
      <div class="wcard-meta-row">
        <span class="wcard-type" :class="`type-${whisky.type}`">{{ TYPE_LABELS[whisky.type] }}</span>
        <span v-if="!isWishlist && whisky.rating" class="wcard-rating-pill" @click.stop>
          ★ {{ whisky.rating }}
        </span>
      </div>
      <div class="wcard-distillery">{{ whisky.distillery || '—' }}</div>
      <div class="wcard-name">{{ whisky.name }}</div>
      <div v-if="whisky.age" class="wcard-age">{{ whisky.age }}</div>
    </div>

    <!-- Flavour bars only for journal entries -->
    <div v-if="!isWishlist" class="wcard-bars">
      <div v-for="a in ATTRS" :key="a" class="bar-row-s">
        <div class="bar-lbl-s">{{ ATTR_LABELS[a] }}</div>
        <div class="bar-track-s">
          <div class="bar-fill-s" :style="{ width: (whisky[a] || 0) * 20 + '%', ...(selectColor ? { background: selectColor, opacity: '0.75' } : {}) }"></div>
        </div>
        <div class="bar-val-s">{{ whisky[a] || 0 }}</div>
      </div>
    </div>

    <!-- Wishlist: show notes snippet if any -->
    <div v-else-if="whisky.notes" class="wcard-wish-notes">{{ whisky.notes }}</div>

    <div class="wcard-actions">
      <template v-if="isWishlist">
        <button class="wcard-btn move" @click.stop="$emit('move')">↑ Move to Journal</button>
        <button class="wcard-btn" @click.stop="$emit('edit')">✎ Edit</button>
        <button class="wcard-btn del" @click.stop="$emit('delete')">✕</button>
      </template>
      <template v-else>
        <button class="wcard-btn" @click.stop="$emit('share')">↗ Share</button>
        <button class="wcard-btn" @click.stop="$emit('edit')">✎ Edit</button>
        <button class="wcard-btn del" @click.stop="$emit('delete')">✕</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ATTRS, ATTR_LABELS, TYPE_LABELS } from '../lib/constants.js'

const props = defineProps({ whisky: Object, selected: Boolean, selectColor: String })
defineEmits(['toggle', 'edit', 'delete', 'share', 'move'])

const isWishlist = computed(() => props.whisky?.list === 'wishlist')
</script>

<style scoped>
.wcard-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}
.wcard-rating-pill {
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--amber-light);
  display: flex;
  align-items: center;
  gap: 3px;
  letter-spacing: 0.04em;
}
.wishlist-badge {
  position: absolute;
  top: 10px;
  left: 12px;
  font-family: 'DM Mono', monospace;
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--amber-light);
  opacity: 0.6;
}
.wcard-wish-notes {
  font-size: 0.75rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.wcard-btn.move {
  flex: 2;
}
.wcard-btn.move:hover {
  border-color: #1D9E75;
  color: #6ecb9a;
}
</style>
