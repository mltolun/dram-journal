<template>
  <div
    class="wcard"
    :class="{
      selected,
      trash: isTrash,
    }"
    :style="selectColor ? `border-color:${selectColor}` : ''"
    @click="isTrash ? null : $emit('toggle')"
  >
    <div v-if="!isWishlist && !isTrash" class="sel-ring" :style="selectColor ? `background:${selectColor};border-color:${selectColor}` : ''"></div>

    <img class="wcard-photo" :src="cardImage" :alt="whisky.name" loading="lazy">

    <div class="wcard-body">
      <div class="wcard-meta-row">
        <span class="wcard-type" :class="`type-${whisky.type}`">{{ t.types[whisky.type] }}</span>
        <span v-if="!isTrash && whisky.rating" class="wcard-rating-pill" @click.stop>
          ★ {{ whisky.rating }}
        </span>
        <span v-if="isTrash" class="wcard-trash-pill">
          🗑 {{ daysLeft }} {{ daysLeft === 1 ? t.trashDaySingular : t.trashDayPlural }}
        </span>
      </div>
      <div class="wcard-distillery">{{ whisky.distillery || '—' }}</div>
      <div class="wcard-name">{{ whisky.name }}</div>
      <div v-if="whisky.age || whisky.abv" class="wcard-age">{{ whisky.age }}{{ whisky.age && whisky.abv ? " · " : "" }}{{ whisky.abv }}</div>
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
        <button class="wcard-btn" @click.stop="$emit('share')"><Share2Icon :size="11" /> {{ t.share }}</button>
        <button class="wcard-btn" @click.stop="$emit('view')"><EyeIcon :size="11" /> {{ t.view }}</button>
        <button class="wcard-btn del" @click.stop="$emit('delete')"><Trash2Icon :size="11" /></button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowUp as ArrowUpIcon, Eye as EyeIcon, Trash2 as Trash2Icon, Share2 as Share2Icon, RotateCcw as RotateCcwIcon } from 'lucide-vue-next'
import { ATTRS } from '../lib/constants.js'
import { useI18n } from '../composables/useI18n.js'
import { daysUntilFlush } from '../composables/useWhiskies.js'
import placeholderImg from '../assets/bottle-placeholder.jpg'

const props = defineProps({ whisky: Object, selected: Boolean, selectColor: String })
defineEmits(['toggle', 'view', 'delete', 'share', 'move', 'restore'])

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
</style>