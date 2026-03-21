<template>
  <div class="photo-upload-area" @click="!processing && fileInput?.click()">
    <input ref="fileInput" type="file" accept="image/*" style="display:none" @change="onFile">

    <!-- Loading state while background is being removed -->
    <div v-if="processing" class="photo-processing">
      <div class="photo-processing-spinner"></div>
      <div class="photo-upload-hint">Removing background…</div>
    </div>

    <div v-else-if="!previewSrc">
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
import { removeBackground } from '../utils/removeBackground.js'

const props = defineProps({ previewSrc: String, kb: Number, processing: Boolean })
const emit  = defineEmits(['selected', 'remove'])
const fileInput = ref(null)

async function onFile(e) {
  const file = e.target.files[0]
  if (!file) return
  // Reset so the same file can be re-selected after a remove
  e.target.value = ''

  emit('processing', true)
  try {
    const bgRemovedBlob = await removeBackground(file)
    const result = await compressImage(bgRemovedBlob, 600, 0.78)
    emit('selected', result)
  } catch (err) {
    console.error('Background removal failed, using original:', err)
    const result = await compressImage(file, 600, 0.78)
    emit('selected', result)
  } finally {
    emit('processing', false)
  }
}
</script>

<style scoped>
.photo-processing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem;
}

.photo-processing-spinner {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--color-border, #e0e0e0);
  border-top-color: var(--color-accent, #8b5e3c);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
