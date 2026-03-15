<template>
  <div class="photo-upload-area" @click="fileInput?.click()">
    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile">
    <div v-if="!previewSrc">
      <div style="font-size:1.4rem;opacity:0.3">📷</div>
      <div class="photo-upload-hint">Click to add a photo · Max 600px · JPEG compressed</div>
    </div>
    <div v-else class="photo-preview-wrap" @click.stop>
      <img :src="previewSrc" class="photo-preview" alt="">
      <button class="photo-remove" @click.stop="$emit('remove')" title="Remove photo">✕</button>
      <div v-if="kb" class="photo-upload-hint">~{{ kb }} KB after compression</div>
      <div v-else class="photo-upload-hint">Current photo</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { compressImage } from '../utils/compressImage.js'

const props = defineProps({ previewSrc: String, kb: Number })
const emit  = defineEmits(['selected', 'remove'])
const fileInput = ref(null)

async function onFile(e) {
  const file = e.target.files[0]
  if (!file) return
  const result = await compressImage(file, 600, 0.78)
  emit('selected', result)
}
</script>
