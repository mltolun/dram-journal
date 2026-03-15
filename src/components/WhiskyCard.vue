<template>
  <div class="wcard" :class="{ selected }" :style="selectColor ? `border-color:${selectColor}` : ''" @click="$emit('toggle')">
    <div class="sel-ring" :style="selectColor ? `background:${selectColor};border-color:${selectColor}` : ''"></div>
    <div v-if="selected" class="sel-check">✓</div>
    <img v-if="whisky.photo_url" class="wcard-photo" :src="whisky.photo_url" :alt="whisky.name" loading="lazy">
    <div>
      <span class="wcard-type" :class="`type-${whisky.type}`">{{ TYPE_LABELS[whisky.type] }}</span>
      <div class="wcard-distillery">{{ whisky.distillery || '—' }}</div>
      <div class="wcard-name">{{ whisky.name }}</div>
      <div v-if="whisky.age" class="wcard-age">{{ whisky.age }}</div>
    </div>
    <div class="wcard-bars">
      <div v-for="a in ATTRS" :key="a" class="bar-row-s">
        <div class="bar-lbl-s">{{ ATTR_LABELS[a] }}</div>
        <div class="bar-track-s">
          <div class="bar-fill-s" :style="{ width: (whisky[a] || 0) * 20 + '%', ...(selectColor ? { background: selectColor, opacity: '0.75' } : {}) }"></div>
        </div>
        <div class="bar-val-s">{{ whisky[a] || 0 }}</div>
      </div>
    </div>
    <div class="wcard-actions">
      <button class="wcard-btn" @click.stop="$emit('share')">↗ Share</button>
      <button class="wcard-btn" @click.stop="$emit('edit')">✎ Edit</button>
      <button class="wcard-btn del" @click.stop="$emit('delete')">✕ Delete</button>
    </div>
  </div>
</template>

<script setup>
import { ATTRS, ATTR_LABELS, TYPE_LABELS } from '../lib/constants.js'
defineProps({ whisky: Object, selected: Boolean, selectColor: String })
defineEmits(['toggle', 'edit', 'delete', 'share'])
</script>
