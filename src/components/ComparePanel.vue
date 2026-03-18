<template>
  <div class="compare-panel">
    <div class="cp-header">
      <span class="cp-title">{{ t.comparison }}</span>
    </div>

    <div class="cp-grid" :style="{ gridTemplateColumns: `repeat(${whiskies.length}, 1fr)` }">
      <div v-for="(w, i) in whiskies" :key="w.id" class="cp-col">

        <!-- Name & origin -->
        <div class="cp-name" :style="{ color: COLOR_HEX[i] }">{{ w.name }}</div>
        <div class="cp-origin">{{ w.origin || '—' }}</div>

        <!-- Type badge -->
        <span class="cm-badge" :style="TYPE_BADGE_STYLE[w.type] || TYPE_BADGE_STYLE.other">
          {{ t.types[w.type] }}
        </span>

        <div class="cp-divider"></div>

        <!-- Details -->
        <div class="cp-detail" v-if="w.distillery">
          <div class="cp-detail-lbl">{{ t.distillery }}</div>
          <div class="cp-detail-val">{{ w.distillery }}</div>
        </div>
        <div class="cp-detail" v-if="w.age">
          <div class="cp-detail-lbl">{{ t.ageMaturation }}</div>
          <div class="cp-detail-val">{{ w.age }}</div>
        </div>
        <div class="cp-detail" v-if="w.price">
          <div class="cp-detail-lbl">{{ t.price }}</div>
          <div class="cp-detail-val">{{ w.price }}</div>
        </div>

        <div class="cp-divider"></div>

        <!-- Nose & Palate -->
        <div class="cp-detail" v-if="w.nose">
          <div class="cp-detail-lbl">{{ t.nose }}</div>
          <div class="cp-detail-val">{{ w.nose }}</div>
        </div>
        <div class="cp-detail" v-if="w.palate">
          <div class="cp-detail-lbl">{{ t.palate }}</div>
          <div class="cp-detail-val">{{ w.palate }}</div>
        </div>

        <div class="cp-divider"></div>

        <!-- Flavour profile bars -->
        <div class="cp-detail-lbl" style="margin-bottom:0.7rem">{{ t.flavourProfileSection }}</div>
        <div v-for="a in ATTRS" :key="a" class="flavor-attr">
          <div class="flavor-attr-lbl">{{ t.attrs[a] }}</div>
          <div class="flavor-bar-row">
            <div class="flavor-track">
              <div class="flavor-fill" :style="{ width: (w[a] || 0) * 20 + '%', background: COLOR_HEX[i] }"></div>
            </div>
            <div class="flavor-val">{{ w[a] || 0 }}</div>
          </div>
        </div>

        <div class="cp-divider"></div>

        <!-- Rating -->
        <div class="cp-detail" v-if="w.rating">
          <div class="cp-detail-lbl">{{ t.rating }}</div>
          <div class="cp-stars">
            <span v-for="n in 5" :key="n" class="cp-star" :class="{ filled: n <= w.rating }">★</span>
          </div>
        </div>

        <!-- Notes -->
        <div class="cp-detail">
          <div class="cp-detail-lbl">{{ t.personalNotesSection }}</div>
          <div class="cp-notes">{{ w.notes || t.noNotes }}</div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ATTRS, TYPE_BADGE_STYLE, COLOR_HEX } from '../lib/constants.js'
import { useI18n } from '../composables/useI18n.js'

defineProps({ whiskies: Array })

const { t } = useI18n()
</script>

<style scoped>
.cp-grid {
  display: grid;
  gap: 1px;
  background: var(--border);
  border: 0.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.cp-col {
  background: var(--bg-card);
  padding: 1.4rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cp-name {
  font-family: 'Playfair Display', serif;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.25;
}
.cp-origin {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  margin-bottom: 4px;
}
.cp-divider {
  height: 0.5px;
  background: var(--border);
  margin: 8px 0;
}
.cp-detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 6px;
}
.cp-detail-lbl {
  font-family: 'DM Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
}
.cp-detail-val {
  font-size: 0.82rem;
  color: var(--cream-dark);
  line-height: 1.45;
}
.cp-notes {
  font-size: 0.78rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.5;
}
.cp-stars {
  display: flex;
  gap: 2px;
}
.cp-star {
  font-size: 0.9rem;
  color: var(--border-hi);
}
.cp-star.filled {
  color: var(--amber-light);
}
.cm-badge {
  display: inline-block;
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  padding: 3px 9px;
  border-radius: 20px;
  line-height: 1.4;
  align-self: flex-start;
}
</style>
