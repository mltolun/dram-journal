<template>
  <div class="compare-panel">
    <div class="cp-header">
      <span class="cp-title">— Comparison</span>
    </div>

    <!-- Matrix table -->
    <table class="comp-matrix">
      <thead>
        <tr>
          <th>Whisky</th>
          <th v-for="col in matrixCols" :key="col.label">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(w, i) in whiskies" :key="w.id">
          <td>
            <div class="cm-name-cell">
              <div class="cm-whisky-name" :style="{ color: COLOR_HEX[i] }">{{ w.name }}</div>
              <div class="cm-whisky-origin">{{ w.origin || '—' }}</div>
            </div>
          </td>
          <td v-for="col in matrixCols" :key="col.label">
            <span v-if="col.badge" class="cm-badge" :style="TYPE_BADGE_STYLE[w.type] || TYPE_BADGE_STYLE.other">
              {{ TYPE_LABELS[w.type] }}
            </span>
            <template v-else>{{ w[col.key] || '—' }}</template>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Flavour profile -->
    <div class="section-lbl">— Flavour profile</div>
    <div class="flavor-grid" :style="{ gridTemplateColumns: `repeat(${whiskies.length}, 1fr)` }">
      <div v-for="(w, i) in whiskies" :key="w.id" class="flavor-col">
        <div class="flavor-col-name" :style="{ color: COLOR_HEX[i] }">{{ w.name.toUpperCase() }}</div>
        <div v-for="a in ATTRS" :key="a" class="flavor-attr">
          <div class="flavor-attr-lbl">{{ ATTR_LABELS[a] }}</div>
          <div class="flavor-bar-row">
            <div class="flavor-track">
              <div class="flavor-fill" :style="{ width: (w[a] || 0) * 20 + '%', background: COLOR_HEX[i] }"></div>
            </div>
            <div class="flavor-val">{{ w[a] || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div class="section-lbl">— Personal notes</div>
    <div class="notes-grid">
      <div v-for="(w, i) in whiskies" :key="w.id" class="note-card">
        <div class="note-name" :style="{ color: COLOR_HEX[i] }">{{ w.name }}</div>
        <div class="note-body">{{ w.notes || 'No notes' }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ATTRS, ATTR_LABELS, TYPE_LABELS, TYPE_BADGE_STYLE, COLOR_HEX } from '../lib/constants.js'

defineProps({ whiskies: Array })

const matrixCols = [
  { label: 'Distillery',       key: 'distillery' },
  { label: 'Type',             key: 'type', badge: true },
  { label: 'Age / Maturation', key: 'age' },
  { label: 'Nose',             key: 'nose' },
  { label: 'Palate',           key: 'palate' },
  { label: 'Price',            key: 'price' },
]
</script>
