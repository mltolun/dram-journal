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

    <div class="tl-body">
      <div v-if="loading" class="tl-loading">
        <div class="tl-spinner"></div>
        <span>Loading…</span>
      </div>

      <div v-else-if="months.length === 0" class="tl-empty">
        No tasting entries in this period.
      </div>

      <div v-else class="tl-months">
        <div v-for="m in months" :key="m.key" class="tl-month-section">
          <div class="tl-month-header">
            <span class="tl-month-label">{{ m.label }}</span>
            <span class="tl-month-count">{{ m.entries.length }} {{ m.entries.length === 1 ? 'dram' : 'drams' }}</span>
          </div>
          <div class="tl-month-grid">
            <button
              v-for="w in m.entries"
              :key="w.id"
              class="tl-bottle"
              @click="openEntry(w)"
              :title="w.name"
            >
              <div class="tl-thumb">
                <img v-if="w.photo_url" :src="w.photo_url" :alt="w.name" class="tl-img">
                <div v-else class="tl-img-ph"><GlassWaterIcon :size="24" /></div>
              </div>
              <div class="tl-bottle-name">{{ w.name }}</div>
              <div class="tl-bottle-meta">
                <span v-if="w.rating" class="tl-star"><StarIcon :size="10" /> {{ w.rating }}</span>
                <span class="tl-day">{{ formatDay(w.date) }}</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { GlassWater as GlassWaterIcon, Star as StarIcon } from 'lucide-vue-next'

const props = defineProps({ entries: { type: Array, default: () => [] } })
const emit = defineEmits(['open-entry'])

const loading = ref(true)
const range   = ref('last_6')

const RANGES = [
  { key: 'last_6',    label: '6 months'  },
  { key: 'last_12',   label: '12 months' },
  { key: 'this_year', label: 'This year' },
]

// Simulate one paint cycle so the parent has rendered before we show content
import { onMounted } from 'vue'
onMounted(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { loading.value = false })
  })
})

function setRange(key) {
  loading.value = true
  range.value = key
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { loading.value = false })
  })
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
  return props.entries
    .filter(w => {
      if (!w.date) return false
      const d = new Date(w.date)
      return d >= start && d <= end
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
})

const months = computed(() => {
  const map = new Map()
  for (const w of filtered.value) {
    const d   = new Date(w.date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    if (!map.has(key)) map.set(key, { key, label, entries: [] })
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

/* Scrollable body */
.tl-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 32px;
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

/* Month sections */
.tl-months {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.tl-month-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tl-month-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding-bottom: 8px;
  border-bottom: 0.5px solid var(--border);
}

.tl-month-label {
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--amber-light);
  letter-spacing: -0.01em;
}

.tl-month-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light);
}

/* Card grid */
.tl-month-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(116px, 1fr));
  gap: 10px;
}

/* Bottle card — same dimensions as before */
.tl-bottle {
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
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
  margin-top: auto;
}
.tl-star { font-size: 0.6rem; color: var(--amber-light); font-weight: 500; display: flex; align-items: center; gap: 2px; }
.tl-day  { font-size: 0.58rem; color: var(--peat-light); font-family: 'JetBrains Mono', monospace; }
</style>
