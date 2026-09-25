<template>
  <div class="ac-wrap">
    <input
      :id="inputId"
      ref="inputEl"
      type="text"
      role="combobox"
      :aria-expanded="open && results.length > 0"
      aria-autocomplete="list"
      :aria-controls="listboxId"
      :aria-activedescendant="focusIdx >= 0 ? `${listboxId}-opt-${focusIdx}` : undefined"
      :value="modelValue"
      :placeholder="placeholder"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKey"
    >
    <div v-if="open && (results.length || searching)" class="ac-dropdown">
      <div v-if="searching" class="ac-empty" role="status">{{ t.acSearching }}</div>
      <div v-else-if="results.length === 0" class="ac-empty" role="status">{{ t.acNoMatches }}</div>
      <div
        :id="listboxId"
        v-else
        role="listbox"
      >
      <div
        v-for="(v, i) in results"
        :id="`${listboxId}-opt-${i}`"
        :key="v"
        role="option"
        :aria-selected="focusIdx === i"
        class="ac-item"
        :class="{ focused: focusIdx === i }"
        @mousedown.prevent="pick(v)"
      >
        <template v-for="(seg, si) in segments(v)" :key="si">
          <span v-if="seg.match" class="ac-item-match">{{ seg.text }}</span><template v-else>{{ seg.text }}</template>
        </template>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { useI18n } from '../composables/useI18n.js'
import { fetchDistinctValues } from '../composables/useCatalogue.js'

const props = defineProps({ modelValue: String, category: String, placeholder: String, id: String })
const emit  = defineEmits(['update:modelValue'])
const { t } = useI18n()

const inputEl = ref(null)
const listboxId = `ac-list-${Math.random().toString(36).slice(2, 8)}`
const inputId = props.id || undefined

const open      = ref(false)
const focusIdx  = ref(-1)
const results   = ref([])
const searching = ref(false)
let   blurTimer   = null
let   searchTimer = null
let   searchSeq   = 0  // stale-response guard

// Map category prop to catalogue column
const CATEGORY_COLUMN = {
  distillery: 'distillery',
  origin:     'country',
}

async function doSearch(q) {
  const col  = CATEGORY_COLUMN[props.category]
  const term = (q || '').trim()
  if (!col || term.length < 2) { results.value = []; searching.value = false; return }

  const seq = ++searchSeq
  searching.value = true
  try {
    // Cached, server-side DISTINCT with in-flight dedup (see useCatalogue.js).
    const values = await fetchDistinctValues(col, term, 12)
    if (seq === searchSeq) results.value = values
  } catch {
    if (seq === searchSeq) results.value = []
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

function onInput(e) {
  emit('update:modelValue', e.target.value)
  open.value     = true
  focusIdx.value = -1
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => doSearch(e.target.value), 250)
}

function onFocus() {
  open.value = true
  if (props.modelValue) doSearch(props.modelValue)
}

function onBlur() {
  blurTimer = setTimeout(() => { open.value = false; focusIdx.value = -1 }, 180)
}

function pick(v) {
  clearTimeout(blurTimer)
  emit('update:modelValue', v)
  open.value = false
}

function onKey(e) {
  if (e.key === 'ArrowDown' && !open.value) { e.preventDefault(); open.value = true; if (props.modelValue) doSearch(props.modelValue); return }
  if (!open.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx.value = Math.min(focusIdx.value + 1, results.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx.value = Math.max(focusIdx.value - 1, 0) }
  else if (e.key === 'Enter' && focusIdx.value >= 0) {
    e.preventDefault()
    pick(results.value[focusIdx.value])
  } else if (e.key === 'Escape') { open.value = false }
}

onBeforeUnmount(() => {
  clearTimeout(blurTimer)
  clearTimeout(searchTimer)
})

function segments(v) {
  const q = (props.modelValue || '').trim()
  if (!q) return [{ text: v, match: false }]
  const idx = v.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return [{ text: v, match: false }]
  return [
    { text: v.slice(0, idx), match: false },
    { text: v.slice(idx, idx + q.length), match: true },
    { text: v.slice(idx + q.length), match: false },
  ]
}
</script>
