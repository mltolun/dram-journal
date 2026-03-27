<template>
  <div class="tl-overlay" @click="handleOverlayClick">
    <div class="tl-panel" ref="panelEl">

      <div class="tl-header">
        <span class="tl-title">Timeline</span>
        <div class="tl-ranges">
          <button
            v-for="r in RANGES" :key="r.key"
            class="tl-range-btn"
            :class="{ active: range === r.key }"
            @click.stop="setRange(r.key)"
          >{{ r.label }}</button>
        </div>
        <button class="tl-close" type="button" @click.stop="emit('close')">
          <XIcon :size="16" />
        </button>
      </div>

      <div class="tl-scroll">
        <div v-if="loading" class="tl-loading">
          <div class="tl-spinner"></div>
          <span>Loading…</span>
        </div>

        <div v-else-if="months.length === 0" class="tl-empty">
          No tasting entries in this period.
        </div>

        <div v-else class="tl-track">
          <div class="tl-line"></div>

          <div v-for="(m, i) in months" :key="m.key" class="tl-month">
            <div v-if="i > 0" class="tl-separator"></div>
            <div class="tl-month-arrow"><span>{{ m.shortLabel }}</span></div>
            <div class="tl-dot"></div>

            <!-- Bottles: horizontal row when expanded, vertical stack when collapsed -->
            <div class="tl-bottles">
              <button
                v-for="w in visibleEntries(m)"
                :key="w.id"
                class="tl-bottle"
                @click.stop="openEntry(w)"
                :title="w.name"
              >
                <div class="tl-thumb">
                  <img v-if="w.photo_url" :src="w.photo_url" :alt="w.name" class="tl-img">
                  <div v-else class="tl-img-ph">🥃</div>
                </div>
                <div class="tl-bottle-name">{{ w.name }}</div>
                <div class="tl-bottle-meta">
                  <span v-if="w.rating" class="tl-star">★ {{ w.rating }}</span>
                  <span class="tl-day">{{ formatDay(w.date) }}</span>
                </div>
              </button>

              <button
                v-if="!expandedKeys.has(m.key) && m.entries.length > PREVIEW_COUNT"
                class="tl-see-more"
                @click.stop="expand(m.key)"
              >
                +{{ m.entries.length - PREVIEW_COUNT }} more
              </button>
              <button
                v-if="expandedKeys.has(m.key)"
                class="tl-collapse"
                @click.stop="collapse(m.key)"
              >
                ↑ less
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { journal } from '../composables/useWhiskies.js'
import { X as XIcon } from 'lucide-vue-next'

const emit = defineEmits(['close', 'open-entry'])

const panelEl      = ref(null)
const loading      = ref(true)
const range        = ref('last_6')
const expandedKeys = ref(new Set())
const PREVIEW_COUNT = 2

const RANGES = [
  { key: 'last_6',    label: '6 months'  },
  { key: 'last_12',   label: '12 months' },
  { key: 'this_year', label: 'This year' },
]

// Only show spinner briefly — data is already in memory
onMounted(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { loading.value = false })
  })
})

function handleOverlayClick(e) {
  if (panelEl.value && !panelEl.value.contains(e.target)) {
    emit('close')
  }
}

function setRange(key) {
  loading.value = true
  expandedKeys.value = new Set()
  range.value = key
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { loading.value = false })
  })
}

function expand(key) {
  const next = new Set(expandedKeys.value)
  next.add(key)
  expandedKeys.value = next
}

function collapse(key) {
  const next = new Set(expandedKeys.value)
  next.delete(key)
  expandedKeys.value = next
}

function visibleEntries(m) {
  return expandedKeys.value.has(m.key)
    ? m.entries
    : m.entries.slice(0, PREVIEW_COUNT)
}

function getRangeStart(key) {
  const now = new Date()
  const y = now.getFullYear(), m = now.getMonth()
  if (key === 'last_6')    return new Date(y, m - 5, 1)
  if (key === 'last_12')   return new Date(y, m - 11, 1)
  if (key === 'this_year') return new Date(y, 0, 1)
  return new Date(y, m - 5, 1)
}

const filtered = computed(() => {
  const start = getRangeStart(range.value)
  const end   = new Date()
  return journal.value
    .filter(w => {
      if (!w.date) return false
      const d = new Date(w.date)
      return d >= start && d <= end
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date))
})

const months = computed(() => {
  const map = new Map()
  for (const w of filtered.value) {
    const d   = new Date(w.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const shortLabel = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
    if (!map.has(key)) map.set(key, { key, shortLabel, entries: [] })
    map.get(key).entries.push(w)
  }
  return [...map.values()]
})

function formatDay(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function openEntry(w) {
  emit('open-entry', w)
}
</script>

<style scoped>
.tl-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
}
.tl-panel {
  background: var(--bg-modal);
  border-top: 0.5px solid var(--border);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  max-height: 70vh;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.25);
}

/* Header */
.tl-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 0.5px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.tl-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}
.tl-ranges { display: flex; gap: 5px; flex: 1; flex-wrap: wrap; }
.tl-range-btn {
  padding: 4px 11px;
  border-radius: 20px;
  border: 0.5px solid var(--border);
  background: none;
  color: var(--text-secondary);
  font-size: 0.7rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}
.tl-range-btn:hover { border-color: var(--border-hi); color: var(--text-primary); }
.tl-range-btn.active { background: var(--amber); border-color: var(--amber); color: #fff; }
.tl-close {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  z-index: 10;
}
.tl-close:hover { border-color: var(--border-hi); color: var(--text-primary); }

/* Scroll area — horizontal only */
.tl-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  padding: 24px 24px 20px;
  -webkit-overflow-scrolling: touch;
  background: var(--bg-modal);
  border-radius: 0 0 16px 16px;
}
.tl-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--peat-light);
  font-size: 0.75rem;
}
.tl-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.tl-empty {
  text-align: center;
  padding: 40px;
  font-size: 0.8rem;
  color: var(--peat-light);
}

/* Horizontal track */
.tl-track {
  display: flex;
  align-items: flex-start;
  position: relative;
  min-width: max-content;
}
.tl-line {
  position: absolute;
  top: 22px;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border);
  z-index: 0;
  pointer-events: none;
}
.tl-month {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  /* Width grows when expanded */
  min-width: 140px;
}
.tl-month-arrow {
  background: var(--amber);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 5px 10px 5px 14px;
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%);
  width: 120px;
  text-align: center;
}
.tl-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--amber);
  border: 2px solid var(--bg-modal);
  margin: 8px 0 10px;
}

/* Bottles: vertical by default, horizontal row when expanded */
.tl-bottles {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 6px;
  padding: 0 6px;
  align-items: flex-start;
}
.tl-bottle {
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  width: 116px;
  flex-shrink: 0;
  font-family: 'Inter', sans-serif;
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 120px;
}
.tl-bottle:hover {
  border-color: var(--amber);
  background: rgba(200,130,42,0.06);
  transform: translateY(-1px);
}
.tl-thumb {
  width: 100%;
  height: 60px;
  border-radius: 5px;
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.tl-img { width: 100%; height: 100%; object-fit: contain; }
.tl-img-ph { font-size: 1.4rem; opacity: 0.2; }
.tl-bottle-name {
  font-size: 0.68rem;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tl-bottle-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.tl-star { font-size: 0.6rem; color: var(--amber-light); font-weight: 500; }
.tl-day  { font-size: 0.58rem; color: var(--peat-light); font-family: 'JetBrains Mono', monospace; }

.tl-see-more {
  background: var(--bg-input);
  border: 0.5px dashed var(--border-hi);
  border-radius: 8px;
  padding: 0 8px;
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--amber-light);
  width: 40px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
.tl-see-more:hover { background: rgba(200,130,42,0.08); border-color: var(--amber); }
.tl-collapse {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 0 8px;
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--peat-light);
  width: 40px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
}
.tl-collapse:hover { border-color: var(--border-hi); color: var(--text-primary); }
.tl-separator {
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--border-hi);
  z-index: 2;
}
</style>