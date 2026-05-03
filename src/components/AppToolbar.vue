<template>
  <div class="toolbar-wrap" v-if="showToolbar">
    <div class="toolbar">

      <!-- Search bar -->
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

      <!-- Right: selected badge + Compare + Filters -->
      <div class="toolbar-right">
        <button
          v-if="selectedCount > 0"
          class="compare-badge compare-badge--clear"
          @click.prevent.stop="onClearSelected"
          :title="t.clearSelected"
          type="button"
        >{{ selectedCount }} {{ t.selected }} <XIcon :size="11" /></button>

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

        <!-- Add Entry dropdown (desktop only) -->
        <div class="add-entry-wrap" ref="addWrap">
          <button
            class="btn-t btn-primary btn-add-desktop"
            @click.stop="addOpen = !addOpen"
            :aria-expanded="addOpen"
            :aria-label="t.addEntry"
          ><PlusIcon :size="14" aria-hidden="true" /> <span class="btn-label">{{ t.addEntry }}</span></button>
          <transition name="add-menu">
            <div v-if="addOpen" class="add-menu" role="menu">
              <button class="add-menu-item" @click.stop="choose('add')" role="menuitem">
                <SearchIcon :size="14" aria-hidden="true" />
                <span class="add-menu-label">{{ t.searchCatalogue }}</span>
              </button>
              <button class="add-menu-item" @click.stop="choose('scan')" role="menuitem">
                <CameraIcon :size="14" aria-hidden="true" />
                <span class="add-menu-label">{{ t.scanBottle }}</span>
              </button>
            </div>
          </transition>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { searchQuery } from '../composables/useSearch.js'
import {
  X as XIcon,
  Columns2 as Columns2Icon,
  SlidersHorizontal as SlidersHorizontalIcon,
  Search as SearchIcon,
  Plus as PlusIcon,
  Camera as CameraIcon,
} from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps({
  selectedCount:   Number,
  compareOpen:     Boolean,
  activeList:      String,
  onClearSelected: Function,
  filtersOpen:     Boolean,
  filterCount:     { type: Number, default: 0 },
})

const emit = defineEmits(['compare', 'filter', 'add', 'scan'])

const showToolbar = computed(() =>
  props.selectedCount > 0 ||
  props.activeList === 'journal'
)

const addOpen = ref(false)
const addWrap = ref(null)

function choose(action) {
  addOpen.value = false
  if (action === 'add') emit('add')
  else emit('scan')
}

function onClickOutside(e) {
  if (addWrap.value && !addWrap.value.contains(e.target)) addOpen.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
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

/* ── Toolbar layout: search fills, buttons on the right ── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-bottom: 0.5px solid var(--border);
}

.toolbar-search {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 auto;
  min-width: 0;
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

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* Desktop Add Entry dropdown */
.add-entry-wrap {
  position: relative;
}
.add-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-radius: 10px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  min-width: 190px;
  z-index: 400;
}
.add-menu-item {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  width: 100%;
  padding: 11px 14px;
  background: none;
  border: none;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-family: 'Inter', sans-serif;
  text-align: left;
}
.add-menu-label {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.3;
  white-space: normal;
}
.add-menu-item:hover { background: rgba(200,130,42,0.08); color: var(--text-primary); }
.add-menu-item svg {
  margin-top: 1px;
  flex-shrink: 0;
}
.add-menu-item + .add-menu-item { border-top: 0.5px solid var(--border); }

.add-menu-enter-active { transition: opacity 0.15s, transform 0.15s; }
.add-menu-leave-active { transition: opacity 0.1s, transform 0.1s; }
.add-menu-enter-from,
.add-menu-leave-to { opacity: 0; transform: scale(0.92) translateY(-6px); }

/* Desktop Add Entry button — hidden on mobile (FAB used instead) */
@media (max-width: 768px) {
  .add-entry-wrap { display: none; }
}

/* ── Mobile: icon-only buttons ── */
@media (max-width: 768px) {
  .toolbar { padding: 8px 16px; }
  .btn-label { display: none; }
  .btn-t { padding: 7px 9px; }
}
</style>
