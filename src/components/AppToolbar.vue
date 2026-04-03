<template>
  <div class="toolbar-wrap">
    <div class="toolbar" v-if="showToolbar">
      <!-- Search bar — inline on desktop, full-width row on mobile -->
      <div class="toolbar-search">
        <SearchIcon :size="14" class="toolbar-search-icon" aria-hidden="true" />
        <input
          class="toolbar-search-input"
          type="search"
          :placeholder="t.searchPlaceholder"
          v-model="searchQuery"
          aria-label="Search"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <div class="toolbar-left">
        <!-- Selected-items badge -->
      <button
        v-if="selectedCount > 0"
        class="compare-badge compare-badge--clear"
        @click.prevent.stop="onClearSelected"
        :title="t.clearSelected"
        type="button"
      >{{ selectedCount }} {{ t.selected }} <XIcon :size="11" /></button>
    </div>

    <div class="toolbar-right">
      <button
        v-if="activeList === 'journal'"
        class="btn-t btn-compare"
        :class="{ ready: selectedCount >= 2, active: compareOpen }"
        :disabled="selectedCount < 2"
        @click="$emit('compare')"
        aria-label="Compare selected whiskies"
      ><Columns2Icon :size="14" aria-hidden="true" /> <span class="btn-label">{{ t.compare }}</span></button>

      <button
        v-if="activeList === 'journal'"
        class="btn-t btn-outline btn-filter"
        :class="{ active: filtersOpen }"
        @click="$emit('filter')"
        aria-label="Filter journal"
      ><SlidersHorizontalIcon :size="14" aria-hidden="true" /> <span class="btn-label">Filters</span><span v-if="filterCount > 0" class="filter-count">{{ filterCount }}</span></button>
    </div>
  </div>
  </div><!-- /toolbar-wrap -->
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { searchQuery } from '../composables/useSearch.js'
import {
  X as XIcon,
  Columns2 as Columns2Icon,
  SlidersHorizontal as SlidersHorizontalIcon,
  Search as SearchIcon,
} from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps({
  selectedCount: Number,
  compareOpen:   Boolean,
  activeList:    String,
  onClearSelected: Function,
  filtersOpen:   Boolean,
  filterCount:   { type: Number, default: 0 },
})

defineEmits(['compare', 'filter'])

// Only render the toolbar when there's content to show
const showToolbar = computed(() =>
  props.selectedCount > 0 ||
  props.activeList === 'journal'
)
</script>

<style scoped>
.btn-filter.active { background: rgba(200,130,42,0.12); color: var(--amber); border-color: rgba(200,130,42,0.4); }
.filter-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--amber);
  color: var(--peat);
  font-size: 0.6rem;
  font-weight: 700;
  margin-left: 2px;
}

/* ── Search bar inside toolbar ── */
.toolbar-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 180px;
  max-width: 600px;
}
.toolbar-search-icon {
  position: absolute;
  left: 10px;
  color: var(--peat-light);
  pointer-events: none;
  flex-shrink: 0;
}
.toolbar-search-input {
  width: 100%;
  background: var(--bg-input);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  padding: 7px 11px 7px 32px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  min-width: 0;
}
.toolbar-search-input:focus {
  border-color: var(--amber);
  box-shadow: 0 0 0 3px rgba(200, 130, 42, 0.1);
}
.toolbar-search-input::placeholder { color: var(--peat-light); opacity: 0.8; }
.toolbar-search-input::-webkit-search-cancel-button { display: none; }

/* ── Mobile: search takes full width row ── */
@media (max-width: 768px) {
  .toolbar-search {
    flex: 1 1 100%;
    max-width: none;
    order: -1; /* show search first */
  }
}

@media (max-width: 680px) {
  .toolbar-right { flex: 1; }
  .btn-t { flex: 1; justify-content: center; }
}
</style>
