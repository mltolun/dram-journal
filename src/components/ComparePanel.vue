<template>
  <div class="compare-panel">
    <div class="cp-header">
      <span class="cp-title">{{ t.comparison }}</span>
    </div>

    <!-- Matrix table -->
    <table class="comp-matrix">
      <thead>
        <tr>
          <th>{{ t.whisky }}</th>
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
              {{ t.types[w.type] }}
            </span>
            <template v-else>{{ w[col.key] || '—' }}</template>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Flavour profile -->
    <div class="section-lbl">{{ t.flavourProfileSection }}</div>
    <div class="flavor-grid" :style="{ gridTemplateColumns: `repeat(${whiskies.length}, 1fr)` }">
      <div v-for="(w, i) in whiskies" :key="w.id" class="flavor-col">
        <div class="flavor-col-name" :style="{ color: COLOR_HEX[i] }">{{ w.name.toUpperCase() }}</div>
        <div v-for="a in ATTRS" :key="a" class="flavor-attr">
          <div class="flavor-attr-lbl">{{ t.attrs[a] }}</div>
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
    <div class="section-lbl">{{ t.personalNotesSection }}</div>
    <div class="notes-grid">
      <div v-for="(w, i) in whiskies" :key="w.id" class="note-card">
        <div class="note-name" :style="{ color: COLOR_HEX[i] }">{{ w.name }}</div>
        <div class="note-body">{{ w.notes || t.noNotes }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ATTRS, TYPE_BADGE_STYLE, COLOR_HEX } from '../lib/constants.js'
import { useI18n } from '../composables/useI18n.js'

defineProps({ whiskies: Array })

const { t } = useI18n()

const matrixCols = computed(() => t.value.compMatrixCols)
</script>
