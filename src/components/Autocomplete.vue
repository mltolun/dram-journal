<template>
  <div class="ac-wrap">
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
      @keydown="onKey"
    >
    <div v-if="open && (results.length || searching)" class="ac-dropdown">
      <div v-if="searching" class="ac-empty">Searching…</div>
      <div v-else-if="results.length === 0" class="ac-empty">No matches</div>
      <div
        v-for="(v, i) in results"
        :key="v"
        class="ac-item"
        :class="{ focused: focusIdx === i }"
        @mousedown.prevent="pick(v)"
        v-html="highlight(v)"
      ></div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { sb } from '../lib/supabase.js'

const props = defineProps({ modelValue: String, category: String, placeholder: String })
const emit  = defineEmits(['update:modelValue'])

const open      = ref(false)
const focusIdx  = ref(-1)
const results   = ref([])
const searching = ref(false)
let   blurTimer   = null
let   searchTimer = null

// Map category prop to catalogue column
const CATEGORY_COLUMN = {
  distillery: 'distillery',
  origin:     'country',
}

async function doSearch(q) {
  const col = CATEGORY_COLUMN[props.category]
  if (!col || !q || q.length < 2) { results.value = []; return }

  searching.value = true
  try {
    const { data } = await sb
      .from('catalogue')
      .select(col)
      .ilike(col, `%${q}%`)
      .limit(50)

    // Deduplicate and sort
    const unique = [...new Set((data || []).map(r => r[col]).filter(Boolean))].sort()
    results.value = unique.slice(0, 12)
  } catch {
    results.value = []
  } finally {
    searching.value = false
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
  if (!open.value) return
  if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx.value = Math.min(focusIdx.value + 1, results.value.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx.value = Math.max(focusIdx.value - 1, 0) }
  else if (e.key === 'Enter' && focusIdx.value >= 0) {
    e.preventDefault()
    pick(results.value[focusIdx.value])
  } else if (e.key === 'Escape') { open.value = false }
}

function highlight(v) {
  const q = (props.modelValue || '').trim()
  if (!q) return v
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  return v.replace(re, '<span class="ac-item-match">$1</span>')
}
</script>
