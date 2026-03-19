<template>
  <Teleport to="body">
    <div class="cp-backdrop" @click.self="$emit('close')">
      <div class="cp-overlay">

        <div class="cp-header">
          <span class="cp-title">{{ t.comparison }}</span>
          <button class="cp-close" @click="$emit('close')">✕</button>
        </div>

        <div class="cp-scroll">
          <div class="cp-table" :style="{ gridTemplateColumns: `120px repeat(${whiskies.length}, 1fr)` }">

            <!-- ── Name / origin / badge ── -->
            <div class="cp-row-lbl cp-row-lbl--top"></div>
            <div v-for="(w, i) in whiskies" :key="`name-${w.id}`" class="cp-cell cp-cell--top">
              <div class="cp-name" :style="{ color: COLOR_HEX[i] }">{{ w.name }}</div>
              <div class="cp-origin">{{ w.origin || '—' }}</div>
              <span class="cm-badge" :style="TYPE_BADGE_STYLE[w.type] || TYPE_BADGE_STYLE.other">
                {{ t.types[w.type] }}
              </span>
            </div>

            <!-- ── Distillery ── -->
            <div class="cp-row-lbl">{{ t.distillery }}</div>
            <div v-for="w in whiskies" :key="`dist-${w.id}`" class="cp-cell">
              <div class="cp-val">{{ w.distillery || '—' }}</div>
            </div>

            <!-- ── Age ── -->
            <div class="cp-row-lbl">{{ t.ageMaturation }}</div>
            <div v-for="w in whiskies" :key="`age-${w.id}`" class="cp-cell">
              <div class="cp-val">{{ w.age || '—' }}</div>
            </div>

            <!-- ── Price ── -->
            <div class="cp-row-lbl">{{ t.price }}</div>
            <div v-for="w in whiskies" :key="`price-${w.id}`" class="cp-cell">
              <div class="cp-val">{{ w.price || '—' }}</div>
            </div>

            <!-- ── Nose ── -->
            <div class="cp-row-lbl">{{ t.nose }}</div>
            <div v-for="w in whiskies" :key="`nose-${w.id}`" class="cp-cell">
              <div class="cp-val cp-val--italic">{{ w.nose || '—' }}</div>
            </div>

            <!-- ── Palate ── -->
            <div class="cp-row-lbl">{{ t.palate }}</div>
            <div v-for="w in whiskies" :key="`palate-${w.id}`" class="cp-cell">
              <div class="cp-val cp-val--italic">{{ w.palate || '—' }}</div>
            </div>

            <!-- ── Flavour profile ── -->
            <div class="cp-row-lbl cp-row-lbl--section">{{ t.flavourProfileSection }}</div>
            <div v-for="(w, i) in whiskies" :key="`flavour-header-${w.id}`" class="cp-cell cp-cell--section"></div>

            <template v-for="a in ATTRS" :key="a">
              <div class="cp-row-lbl cp-row-lbl--attr">{{ t.attrs[a] }}</div>
              <div v-for="(w, i) in whiskies" :key="`${a}-${w.id}`" class="cp-cell cp-cell--attr">
                <div class="cp-bar-row">
                  <div class="cp-bar-track">
                    <div class="cp-bar-fill" :style="{ width: (w[a] || 0) * 20 + '%', background: COLOR_HEX[i] }"></div>
                  </div>
                  <div class="cp-bar-val">{{ w[a] || 0 }}</div>
                </div>
              </div>
            </template>

            <!-- ── Rating ── -->
            <div class="cp-row-lbl">{{ t.rating }}</div>
            <div v-for="w in whiskies" :key="`rating-${w.id}`" class="cp-cell">
              <div v-if="w.rating" class="cp-stars">
                <span v-for="n in 5" :key="n" class="cp-star" :class="{ filled: n <= w.rating }">★</span>
              </div>
              <div v-else class="cp-val">—</div>
            </div>

            <!-- ── Notes ── -->
            <div class="cp-row-lbl">{{ t.personalNotesSection }}</div>
            <div v-for="w in whiskies" :key="`notes-${w.id}`" class="cp-cell">
              <div class="cp-val cp-val--italic">{{ w.notes || t.noNotes }}</div>
            </div>

          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ATTRS, TYPE_BADGE_STYLE, COLOR_HEX } from '../lib/constants.js'
import { useI18n } from '../composables/useI18n.js'

defineProps({ whiskies: Array })
defineEmits(['close'])

const { t } = useI18n()
</script>

<style scoped>
.cp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: cp-fade-in 0.2s ease;
}
@keyframes cp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.cp-overlay {
  width: 100%;
  max-width: 1100px;
  max-height: 85vh;
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-bottom: none;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  animation: cp-slide-up 0.25s cubic-bezier(.23,1,.32,1);
}
@keyframes cp-slide-up {
  from { transform: translateY(40px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.2rem 1.8rem 1rem;
  border-bottom: 0.5px solid var(--border);
  flex-shrink: 0;
}
.cp-title {
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber);
}
.cp-close {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 5px;
  color: var(--peat-light);
  font-size: 0.7rem;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.cp-close:hover {
  border-color: var(--amber);
  color: var(--amber-light);
}
.cp-scroll {
  overflow-y: auto;
  flex: 1;
  padding: 1.4rem 1.8rem 2rem;
}

/* ── Row-based grid ── */
.cp-table {
  display: grid;
  border: 0.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

/* Every cell and label share the same row height automatically */
.cp-row-lbl,
.cp-cell {
  padding: 12px 14px;
  border-bottom: 0.5px solid var(--border);
  display: flex;
  align-items: center;
}
.cp-row-lbl:last-of-type,
.cp-cell:last-child,
.cp-table > :nth-last-child(-n+4) {
  border-bottom: none;
}

/* Label column */
.cp-row-lbl {
  font-family: 'DM Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
  background: rgba(200,130,42,0.04);
  border-right: 0.5px solid var(--border);
  align-items: flex-start;
  flex-direction: column;
  justify-content: center;
}
.cp-row-lbl--top {
  background: rgba(200,130,42,0.04);
}
.cp-row-lbl--section {
  color: var(--amber);
  letter-spacing: 0.14em;
  background: rgba(200,130,42,0.08);
}
.cp-row-lbl--attr {
  font-size: 0.52rem;
  padding-left: 20px;
}

/* Data cells */
.cp-cell {
  background: var(--bg-card);
  border-right: 0.5px solid var(--border);
  align-items: flex-start;
  flex-direction: column;
  gap: 4px;
}
.cp-cell:last-child {
  border-right: none;
}
.cp-cell--top {
  padding: 14px 14px 12px;
  background: var(--bg-card);
}
.cp-cell--section {
  background: rgba(200,130,42,0.04);
  padding: 8px 14px;
}
.cp-cell--attr {
  padding: 8px 14px;
}

.cp-name {
  font-family: 'Playfair Display', serif;
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.25;
}
.cp-origin {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  color: var(--peat-light);
  margin-bottom: 4px;
}
.cp-val {
  font-size: 0.82rem;
  color: var(--cream-dark);
  line-height: 1.45;
}
.cp-val--italic {
  font-style: italic;
  color: var(--peat-light);
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
}

/* Flavour bars — defined locally to avoid scoping issues */
.cp-bar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.cp-bar-track {
  flex: 1;
  height: 4px;
  background: var(--bg-bar-track);
  border-radius: 2px;
  overflow: hidden;
}
.cp-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(.23, 1, .32, 1);
}
.cp-bar-val {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light);
  width: 14px;
  text-align: right;
  flex-shrink: 0;
}
</style>
