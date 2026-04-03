<template>
  <div class="toolbar-wrap">
    <!-- Mobile search bar (hidden on desktop) -->
    <div class="toolbar-search-mobile">
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

    <div class="toolbar" v-if="showToolbar">
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

/* Mobile search bar — hidden on desktop */
.toolbar-search-mobile {
  display: none;
}

@media (max-width: 768px) {
  .toolbar-search-mobile {
    display: flex;
    align-items: center;
    position: relative;
    padding: 10px 16px;
    border-bottom: 0.5px solid var(--border);
  }
  .toolbar-search-icon {
    position: absolute;
    left: 26px;
    color: var(--peat-light);
    pointer-events: none;
  }
  .toolbar-search-input {
    width: 100%;
    background: var(--bg-input);
    border: 0.5px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-family: 'Inter', sans-serif;
    font-size: 0.8rem;
    padding: 8px 12px 8px 32px;
    outline: none;
    transition: border-color 0.18s, box-shadow 0.18s;
  }
  .toolbar-search-input:focus {
    border-color: var(--amber);
    box-shadow: 0 0 0 3px rgba(200, 130, 42, 0.1);
  }
  .toolbar-search-input::placeholder { color: var(--peat-light); opacity: 0.8; }
  .toolbar-search-input::-webkit-search-cancel-button { display: none; }
}

@media (max-width: 680px) {
  .toolbar-right { flex: 1; }
  .btn-t { flex: 1; justify-content: center; }
}
</style>
