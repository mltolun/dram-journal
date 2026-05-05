<template>
  <!-- ── Gallery (default) card ── -->
  <div
    v-if="!compact"
    class="wcard"
    :class="{
      selected,
      trash: isTrash,
    }"
    :style="selectColor ? `border-color:${selectColor}` : ''"
    @click="isTrash ? null : $emit('view')"
  >
    <div v-if="!isWishlist && !isTrash" class="sel-ring" :style="selectColor ? `background:${selectColor};border-color:${selectColor}` : ''"></div>

    <img class="wcard-photo" :src="cardImage" :alt="whisky.name" loading="lazy">

    <div class="wcard-body">
      <div class="wcard-meta-row">
        <span class="wcard-type" :class="`type-${whisky.type}`">{{ t.types[whisky.type] }}</span>
        <span v-if="!isTrash && whisky.rating" class="wcard-rating-pill" @click.stop>
          <StarIcon :size="10" /> {{ whisky.rating }}
        </span>
        <span v-if="isTrash" class="wcard-trash-pill">
          <Trash2Icon :size="10" /> {{ daysLeft }} {{ daysLeft === 1 ? t.trashDaySingular : t.trashDayPlural }}
        </span>
      </div>
      <div class="wcard-distillery">{{ whisky.distillery || '—' }}</div>
      <div class="wcard-name">{{ whisky.name }}</div>
      <div class="wcard-age">{{ whisky.age ? whisky.age + ' yo' : 'NAS' }}{{ whisky.abv ? ' · ' + whisky.abv + ' abv' : '' }}</div>
      <!-- Flavour bars for journal and wishlist entries -->
      <div v-if="!isTrash" class="wcard-bars">
        <div v-for="a in ATTRS" :key="a" class="bar-row-s">
          <div class="bar-lbl-s">{{ t.attrs[a] }}</div>
          <div class="bar-track-s">
            <div class="bar-fill-s" :style="{ width: (whisky[a] || 0) * 20 + '%', ...(selectColor ? { background: selectColor, opacity: '0.75' } : {}) }"></div>
          </div>
          <div class="bar-val-s">{{ whisky[a] || 0 }}</div>
        </div>
      </div>
    </div>

    <div class="wcard-actions">
      <template v-if="isTrash">
        <button class="wcard-btn restore" @click.stop="$emit('restore')"><RotateCcwIcon :size="11" /> {{ t.trashRestore }}</button>
        <button class="wcard-btn del" @click.stop="$emit('delete')" :title="t.trashDeleteNow"><Trash2Icon :size="11" /></button>
      </template>
      <template v-else-if="isWishlist">
        <button class="wcard-btn" @click.stop="$emit('share')"><Share2Icon :size="11" /> {{ t.share }}</button>
        <button class="wcard-btn" @click.stop="$emit('move')"><ArrowUpIcon :size="11" /> {{ t.moveToJournal }}</button>
        <button class="wcard-btn del" @click.stop="$emit('delete')"><Trash2Icon :size="11" /></button>
      </template>
      <template v-else>
        <button class="wcard-btn" @click.stop="$emit('dram')"><PlusIcon :size="11" /> {{ t.logAnotherDramShort }}</button>
        <button class="wcard-btn" @click.stop="$emit('share')"><Share2Icon :size="11" /> {{ t.share }}</button>
        <button class="wcard-btn" :class="{ 'compare-active': selected }" @click.stop="$emit('toggle')"><Columns2Icon :size="11" /> Compare</button>
        <button class="wcard-btn del" @click.stop="$emit('delete')"><Trash2Icon :size="11" /></button>
      </template>
    </div>
  </div>

  <!-- ── Compact list row ── -->
  <div
    v-else
    class="wcard-row"
    :class="{ selected, trash: isTrash }"
    :style="selectColor ? `border-left-color:${selectColor}` : ''"
    @click="isTrash ? null : $emit('view')"
  >
    <span class="wcard-type wcard-row-type" :class="`type-${whisky.type}`">{{ t.types[whisky.type] }}</span>

    <div class="wcard-row-info">
      <span class="wcard-row-name">{{ whisky.name }}</span>
      <span class="wcard-row-meta">{{ whisky.distillery || '—' }} · {{ whisky.age ? whisky.age + ' yo' : 'NAS' }}{{ whisky.abv ? ' · ' + whisky.abv : '' }}</span>
    </div>

    <span v-if="whisky.rating" class="wcard-row-rating"><StarIcon :size="10" /> {{ whisky.rating }}</span>
    <span v-if="isTrash" class="wcard-trash-pill wcard-row-trash"><Trash2Icon :size="10" /> {{ daysLeft }}d</span>

    <div class="wcard-row-actions" @click.stop>
      <template v-if="isTrash">
        <button class="wcard-btn" @click="$emit('restore')" :aria-label="t.trashRestore"><RotateCcwIcon :size="11" /></button>
        <button class="wcard-btn del" @click="$emit('delete')" :title="t.trashDeleteNow"><Trash2Icon :size="11" /></button>
      </template>
      <template v-else-if="isWishlist">
        <button class="wcard-btn" @click="$emit('share')" :aria-label="t.share"><Share2Icon :size="11" /></button>
        <button class="wcard-btn" @click="$emit('move')" :aria-label="t.moveToJournal"><ArrowUpIcon :size="11" /></button>
        <button class="wcard-btn del" @click="$emit('delete')" :aria-label="t.delete"><Trash2Icon :size="11" /></button>
      </template>
      <template v-else>
        <button class="wcard-btn" @click="$emit('dram')" :aria-label="t.logAnotherDramShort"><PlusIcon :size="11" /></button>
        <button class="wcard-btn" @click="$emit('share')" :aria-label="t.share"><Share2Icon :size="11" /></button>
        <button class="wcard-btn" :class="{ 'compare-active': selected }" @click="$emit('toggle')" aria-label="Compare"><Columns2Icon :size="11" /></button>
        <button class="wcard-btn del" @click="$emit('delete')" :aria-label="t.delete"><Trash2Icon :size="11" /></button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowUp as ArrowUpIcon, Columns2 as Columns2Icon, Trash2 as Trash2Icon, Share2 as Share2Icon, RotateCcw as RotateCcwIcon, Star as StarIcon, Plus as PlusIcon, GlassWater as GlassWaterIcon } from 'lucide-vue-next'
import { ATTRS } from '../lib/constants.js'
import { useI18n } from '../composables/useI18n.js'
import { daysUntilFlush } from '../composables/useWhiskies.js'
import placeholderImg from '../assets/bottle-placeholder.jpg'

const props = defineProps({ whisky: Object, selected: Boolean, selectColor: String, compact: Boolean })
defineEmits(['toggle', 'view', 'delete', 'share', 'move', 'restore', 'dram'])

const { t } = useI18n()
const isWishlist = computed(() => props.whisky?.list === 'wishlist')
const isTrash    = computed(() => props.whisky?.list === 'trash')
const cardImage  = computed(() => props.whisky?.photo_url || placeholderImg)
const daysLeft   = computed(() => daysUntilFlush(props.whisky))
</script>

<style scoped>
.wcard-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 2px;
}
.wcard-rating-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  font-weight: 500;
  color: var(--amber-light);
  display: flex;
  align-items: center;
  gap: 3px;
  letter-spacing: 0.04em;
}
.wcard-dram-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  font-weight: 500;
  color: #6ecb93;
  display: flex;
  align-items: center;
  gap: 3px;
  letter-spacing: 0.04em;
}
.wcard-trash-pill {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 500;
  color: var(--peat-light);
  opacity: 0.7;
  letter-spacing: 0.04em;
}
.wcard-wish-notes {
  font-size: 0.75rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
/* Trash card: greyed-out */
.wcard.trash {
  cursor: default;
  border-style: dashed;
  border-color: rgba(200,130,42,0.3);
}
.wcard.trash .wcard-photo {
  opacity: 0.35;
  filter: grayscale(0.7);
}
.wcard.trash .wcard-body {
  opacity: 0.45;
  filter: grayscale(0.5);
}
.wcard.trash .wcard-actions {
  opacity: 1;
  filter: none;
}
.wcard.trash:hover {
  border-color: rgba(200,130,42,0.55);
}
.wcard.trash:hover .wcard-body {
  opacity: 0.6;
}
.wcard-btn.compare-active {
  border-color: rgba(200,130,42,0.5);
  color: var(--amber);
  background: rgba(200,130,42,0.08);
}
.wcard-btn.restore {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 4px;
}
.wcard-btn.restore:hover {
  border-color: #1D9E75;
  color: #6ecb9a;
}

/* ── Compact list row ── */
.wcard-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-left: 3px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow: var(--shadow-card);
  min-width: 0;
}
.wcard-row:hover {
  background: rgba(200, 130, 42, 0.03);
  border-color: var(--border-hi);
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.wcard-row.selected { border-left-color: var(--amber); background: rgba(200,130,42,0.04); }
.wcard-row.trash { opacity: 0.7; cursor: default; border-style: dashed; }
.wcard-row-type { flex-shrink: 0; }
.wcard-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wcard-row-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}
.wcard-row-meta {
  font-size: 0.68rem;
  color: var(--peat-light);
  font-family: 'JetBrains Mono', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wcard-row-rating {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--amber-light);
  flex-shrink: 0;
}
.wcard-row-trash { flex-shrink: 0; }
.wcard-row-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.wcard-row-actions .wcard-btn {
  flex: none;
  width: 28px;
  height: 28px;
  padding: 0;
}
</style>
