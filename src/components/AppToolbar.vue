<template>
  <div class="toolbar">
    <div class="toolbar-left">
      <div class="list-tabs">
        <button
          class="list-tab"
          :class="{ active: activeList === 'journal' }"
          @click="$emit('setList', 'journal')"
        ><BookOpenIcon :size="13" /> <span class="tab-label">{{ t.journal }}</span></button>
        <button
          class="list-tab"
          :class="{ active: activeList === 'wishlist' }"
          @click="$emit('setList', 'wishlist')"
        ><HeartIcon :size="13" /> <span class="tab-label">{{ t.wishlist }}</span></button>
      </div>
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
      ><Columns2Icon :size="14" /> <span class="btn-label">{{ t.compare }}</span></button>
      <button v-if="activeList === 'journal'" class="btn-t btn-outline" @click="$emit('timeline')"><CalendarIcon :size="14" /> <span class="btn-label">Timeline</span></button>
      <div class="add-wrap" ref="addWrap">
        <button class="btn-t btn-primary" @click.stop="addOpen = !addOpen">
          <PlusIcon :size="14" /> <span class="btn-label">{{ t.add }}</span> <ChevronDownIcon :size="12" />
        </button>
        <div v-if="addOpen" class="add-dropdown">
          <button class="add-option" @click.stop="choose('add')">
            <SearchIcon :size="14" />
            Search catalogue
          </button>
          <button class="add-option" @click.stop="choose('scan')">
            <CameraIcon :size="14" />
            {{ t.scan }} bottle
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from '../composables/useI18n.js'
import { BookOpen as BookOpenIcon, Heart as HeartIcon, X as XIcon, Columns2 as Columns2Icon, Share2 as Share2Icon, Camera as CameraIcon, Plus as PlusIcon, Calendar as CalendarIcon, ChevronDown as ChevronDownIcon, Search as SearchIcon } from 'lucide-vue-next'
import { ref, onMounted, onBeforeUnmount } from 'vue'
const { t } = useI18n()
defineProps({ selectedCount: Number, compareOpen: Boolean, activeList: String, onClearSelected: Function })
const emit = defineEmits(['add', 'compare', 'scan', 'setList', 'timeline'])

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
.list-tabs {
  display: flex;
  gap: 2px;
  background: rgba(200,130,42,0.06);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  padding: 3px;
}
.list-tab {
  padding: 5px 14px;
  border-radius: 5px;
  background: transparent;
  border: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
}
.list-tab.active {
  background: var(--amber);
  color: var(--peat);
  font-weight: 500;
}
.list-tab:not(.active):hover {
  color: var(--amber-light);
}
.btn-scan {
  background: transparent;
  color: var(--amber-light);
  border: 0.5px solid rgba(200,130,42,0.35);
}
.btn-scan:hover {
  background: rgba(200,130,42,0.1);
  border-color: var(--amber);
}
.btn-share-wl {
  background: transparent;
  color: var(--amber-light);
  border: 0.5px solid rgba(200,130,42,0.35);
}
.btn-share-wl:hover {
  background: rgba(200,130,42,0.1);
  border-color: var(--amber);
}
.add-wrap {
  position: relative;
}
.add-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-radius: 10px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  min-width: 160px;
  z-index: 100;
}
.add-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-family: 'Inter', sans-serif;
  text-align: left;
}
.add-option:hover { background: rgba(200,130,42,0.08); color: var(--text-primary); }
.add-option + .add-option { border-top: 0.5px solid var(--border); }
</style>