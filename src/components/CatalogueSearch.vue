<template>
  <div class="catalogue-search">

    <!-- Scan match banner — shown when opened from a scan result -->
    <div v-if="initialQuery && !userHasTyped" class="cs-scan-banner">
      <span class="cs-scan-icon">📷</span>
      <span>{{ t.scanMatchHint || 'Showing matches for your scanned bottle' }}</span>
    </div>

    <!-- Search input -->
    <div class="cs-input-wrap">
      <span class="cs-icon">🔍</span>
      <input
        ref="inputEl"
        v-model="query"
        class="cs-input"
        :placeholder="t.catalogueSearchPlaceholder || 'Search whisky or distillery…'"
        autocomplete="off"
        @input="onInput"
      />
      <button v-if="query" class="cs-clear" @click="onClear">✕</button>
    </div>

    <!-- Results -->
    <div class="cs-results" v-if="query.length >= 2">
      <div v-if="searching" class="cs-state">{{ t.searching || 'Searching…' }}</div>

      <div v-else-if="results.length === 0" class="cs-state cs-empty">
        {{ t.catalogueNoResults || 'No results found.' }}
      </div>

      <div
        v-else
        v-for="item in results"
        :key="item.id"
        class="cs-item"
        @click="$emit('pick', item)"
      >
        <div class="cs-thumb">
          <img v-if="item.photo_url" :src="item.photo_url" :alt="item.name" class="cs-img">
          <div v-else class="cs-img-placeholder">🥃</div>
        </div>
        <div class="cs-info">
          <div class="cs-name">{{ item.name }}</div>
          <div class="cs-meta">
            <span v-if="item.distillery">{{ item.distillery }}</span>
            <span v-if="item.distillery && (item.country || item.type)" class="cs-dot">·</span>
            <span v-if="item.country">{{ item.country }}</span>
            <span v-if="item.country && item.type" class="cs-dot">·</span>
            <span v-if="item.type" class="cs-badge" :class="`type-${item.type}`">{{ t.types?.[item.type] || item.type }}</span>
          </div>
          <div class="cs-sub" v-if="item.age || item.abv">
            <span v-if="item.age">{{ item.age }}</span>
            <span v-if="item.age && item.abv" class="cs-dot">·</span>
            <span v-if="item.abv">{{ item.abv }}</span>
          </div>
        </div>
        <span class="cs-arrow">›</span>
      </div>
    </div>

    <!-- Manual entry fallback -->
    <div class="cs-manual">
      <span class="cs-manual-label">
        {{ initialQuery && !userHasTyped
          ? (t.scanNotThisOne || 'Not the right one?')
          : (t.catalogueNotFound || 'Not in the list?') }}
      </span>
      <button class="cs-manual-btn" @click="$emit('manual')">
        {{ initialQuery && !userHasTyped
          ? (t.scanAddManually || 'Use scanned data')
          : (t.catalogueAddManually || 'Add manually') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useCatalogue } from '../composables/useCatalogue.js'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({
  initialQuery: { type: String, default: '' },
})
defineEmits(['pick', 'manual'])

const { t } = useI18n()
const { results, searching, debouncedSearch, search, clear } = useCatalogue()

const query        = ref('')
const inputEl      = ref(null)
const userHasTyped = ref(false)

onMounted(() => {
  if (props.initialQuery) {
    query.value = props.initialQuery
    search(props.initialQuery)   // immediate search, no debounce
  } else {
    inputEl.value?.focus()
  }
})

function onInput() {
  userHasTyped.value = true
  debouncedSearch(query.value)
}

function onClear() {
  query.value        = ''
  userHasTyped.value = true
  clear()
  inputEl.value?.focus()
}
</script>

<style scoped>
.catalogue-search {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 16px 20px;
}

/* ── Scan banner ── */
.cs-scan-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(200, 130, 42, 0.08);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 0.78rem;
  color: var(--amber-light);
  opacity: 0.85;
}
.cs-scan-icon { font-size: 0.9rem; }

/* ── Input ── */
.cs-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0 12px;
  margin-bottom: 12px;
}
.cs-icon { font-size: 0.85rem; opacity: 0.5; }
.cs-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.95rem;
  padding: 12px 0;
}
.cs-input::placeholder { color: var(--text-secondary); opacity: 0.5; }
.cs-clear {
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  opacity: 0.5;
  padding: 4px;
}
.cs-clear:hover { opacity: 1; }

/* ── Results ── */
.cs-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 340px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.cs-state {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  opacity: 0.6;
}

/* ── Item ── */
.cs-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.cs-item:hover { background: var(--bg-card); }

.cs-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 0.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
}
.cs-img { width: 100%; height: 100%; object-fit: contain; }
.cs-img-placeholder { font-size: 1.2rem; opacity: 0.4; }

.cs-info { flex: 1; min-width: 0; }
.cs-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.7;
}
.cs-dot { opacity: 0.4; }
.cs-sub {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.5;
  margin-top: 2px;
}
.cs-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 20px;
}
.cs-arrow {
  color: var(--text-secondary);
  opacity: 0.3;
  font-size: 1.2rem;
  flex-shrink: 0;
}

/* ── Manual fallback ── */
.cs-manual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 0;
  border-top: 0.5px solid var(--border);
  margin-top: 4px;
}
.cs-manual-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.6;
}
.cs-manual-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--amber-light);
  font-size: 0.8rem;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.cs-manual-btn:hover {
  background: var(--bg-card);
  border-color: var(--border-hi);
}
</style>