<template>
  <div class="ac-wrap">
    <input
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      autocomplete="off"
      @input="onInput"
      @focus="onInput"
      @blur="onBlur"
      @keydown="onKey"
    >
    <div v-if="open" class="ac-dropdown">
      <div v-if="matches.length === 0 && !canAdd" class="ac-empty">No matches</div>
      <div
        v-for="(v, i) in matches" :key="v"
        class="ac-item" :class="{ focused: focusIdx === i }"
        @mousedown.prevent="pick(v)"
        v-html="highlight(v)"
      ></div>
      <div v-if="canAdd" class="ac-item ac-item-add" @mousedown.prevent="addNew">
        ＋ Add "<strong>{{ modelValue }}</strong>" <span>as new option</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useLookups } from '../composables/useLookups.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({ modelValue: String, category: String, placeholder: String })
const emit  = defineEmits(['update:modelValue'])

const { lookups, addLookup } = useLookups()
const { toast } = useToast()

const open     = ref(false)
const focusIdx = ref(-1)
let blurTimer  = null

const q = computed(() => (props.modelValue || '').trim().toLowerCase())

const matches = computed(() => {
  const opts = lookups.value[props.category] || []
  return q.value ? opts.filter(v => v.toLowerCase().includes(q.value)) : opts.slice()
})

const canAdd = computed(() => {
  if (!q.value) return false
  return !lookups.value[props.category]?.some(v => v.toLowerCase() === q.value)
})

function onInput(e) {
  emit('update:modelValue', e.target.value)
  open.value = true
  focusIdx.value = -1
}

function onBlur() {
  blurTimer = setTimeout(() => { open.value = false; focusIdx.value = -1 }, 180)
}

function pick(v) {
  clearTimeout(blurTimer)
  emit('update:modelValue', v)
  open.value = false
}

async function addNew() {
  clearTimeout(blurTimer)
  const val = props.modelValue?.trim()
  if (!val) return
  try {
    await addLookup(props.category, val)
    open.value = false
    toast(`✓ "${val}" added to options`)
  } catch (e) {
    toast('⚠ Could not save option')
  }
}

function onKey(e) {
  if (!open.value) return
  const total = matches.value.length + (canAdd.value ? 1 : 0)
  if (e.key === 'ArrowDown') { e.preventDefault(); focusIdx.value = Math.min(focusIdx.value + 1, total - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusIdx.value = Math.max(focusIdx.value - 1, 0) }
  else if (e.key === 'Enter' && focusIdx.value >= 0) {
    e.preventDefault()
    if (focusIdx.value < matches.value.length) pick(matches.value[focusIdx.value])
    else addNew()
  } else if (e.key === 'Escape') { open.value = false }
}

function highlight(v) {
  if (!q.value) return v
  const re = new RegExp('(' + q.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  return v.replace(re, '<span class="ac-item-match">$1</span>')
}
</script>
