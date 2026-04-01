<template>
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
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import {
  X as XIcon,
  Columns2 as Columns2Icon,
  SlidersHorizontal as SlidersHorizontalIcon,
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
@media (max-width: 680px) {
  .toolbar-right { flex: 1; }
  .btn-t { flex: 1; justify-content: center; }
}
</style>
