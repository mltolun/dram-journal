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

// PhotoUpload is a dumb file-picker only.
// All processing (bg removal + compression) lives in usePhoto → selectPhoto().
const props = defineProps({ previewSrc: String, kb: Number, processing: Boolean })
const emit  = defineEmits(['picked', 'remove'])
const fileInput = ref(null)

function onFile(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = '' // allow re-selecting the same file after remove
  emit('picked', file)
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
