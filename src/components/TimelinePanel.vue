<template>
  <div class="tl-view">
    <div class="tl-header">
      <span class="tl-title">Timeline</span>
      <div class="tl-ranges">
        <button
          v-for="r in RANGES" :key="r.key"
          class="tl-range-btn"
          :class="{ active: range === r.key }"
          @click="setRange(r.key)"
        >{{ r.label }}</button>
      </div>
    </div>

    <div class="tl-scroll" ref="scrollEl">
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
                @click="openEntry(w)"
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
                v-if="!expandedKeys.has(m.key) && m.entries.length > previewCount"
                class="tl-see-more"
                @click="expand(m.key)"
              >
                <span>+{{ m.entries.length - previewCount }} more</span>
              </button>
              <button
                v-if="expandedKeys.has(m.key)"
                class="tl-collapse"
                @click="collapse(m.key)"
              >
                <span>↑ less</span>
              </button>
            </div>
          </div>
        </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { journal } from '../composables/useWhiskies.js'
const emit = defineEmits(['open-entry'])

const loading        = ref(true)
const range          = ref('last_6')
const expandedKeys   = ref(new Set())
const scrollEl       = ref(null)
const scrollWidth    = ref(0)

const RANGES = [
  { key: 'last_6',    label: '6 months'  },
  { key: 'last_12',   label: '12 months' },
  { key: 'this_year', label: 'This year' },
]

// Observe scroll container width to compute how many bottles fit per month
let ro = null
onMounted(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      loading.value = false
      if (scrollEl.value) {
        ro = new ResizeObserver(entries => {
          scrollWidth.value = entries[0].contentRect.width
        })
        ro.observe(scrollEl.value)
      }
    })
  })
})
onUnmounted(() => { if (ro) ro.disconnect() })

// How many bottles to show per month before collapsing.
// bottle card = 116px wide + 6px gap = 122px; month padding = 12px each side.
// Divide available width equally among months; fit as many bottles as possible.
const previewCount = computed(() => {
  const n = months.value.length
  if (!scrollWidth.value || !n) return 2
  const perMonth = scrollWidth.value / n
  return Math.max(1, Math.floor((perMonth - 24) / 122))
})

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
    : m.entries.slice(0, previewCount.value)
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
.tl-view {
  display: flex;
  flex-direction: column;
  min-height: 0;
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
/* Scroll area — horizontal only */
.tl-scroll {
  overflow-x: auto;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 24px 24px 20px;
  -webkit-overflow-scrolling: touch;
  background: var(--bg-modal);
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
  padding: 5px 18px 5px 10px;
  width: 120px;
  text-align: center;
  position: relative;
  border-radius: 2px 0 0 2px;
  box-sizing: border-box;
}
/* Arrow tip using a pseudo-element — universally supported on Android */
.tl-month-arrow::after {
  content: '';
  position: absolute;
  right: -10px;
  top: 0;
  bottom: 0;
  width: 0;
  border-style: solid;
  border-width: 14px 0 14px 10px;
  border-color: transparent transparent transparent var(--amber);
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
  padding: 0;
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
  overflow: hidden;
}
/* Use transform rotation instead of writing-mode for Android compatibility */
.tl-see-more > span {
  display: block;
  transform: rotate(90deg);
  white-space: nowrap;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--amber-light);
}
.tl-see-more:hover { background: rgba(200,130,42,0.08); border-color: var(--amber); }
.tl-collapse {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 0;
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
  overflow: hidden;
}
.tl-collapse > span {
  display: block;
  transform: rotate(-90deg);
  white-space: nowrap;
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--peat-light);
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