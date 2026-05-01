<template>
  <div>
    <div
      class="photo-upload-area"
      role="button"
      tabindex="0"
      @click="showSourceModal = true"
      @keydown.enter.prevent="showSourceModal = true"
      @keydown.space.prevent="showSourceModal = true"
    >
      <div v-if="!previewSrc">
        <div style="opacity:0.3"><CameraIcon :size="22" /></div>
        <div class="photo-upload-hint">{{ t.photoUploadHint }}</div>
      </div>
      <div v-else class="photo-preview-wrap">
        <img :src="previewSrc" class="photo-preview" alt="">
        <button class="photo-remove" @click.stop="$emit('remove')" :title="t.removePhoto"><XIcon :size="12" /></button>
        <div v-if="kb" class="photo-upload-hint">{{ t.photoCompressed(kb) }}</div>
        <div v-else class="photo-upload-hint">{{ t.currentPhoto }}</div>
      </div>
    </div>

    <input ref="galleryInput" type="file" accept="image/*" style="display:none" @change="onFile">
    <input ref="cameraInput" type="file" accept="image/*" capture="environment" style="display:none" @change="onFile">
    <CameraCaptureModal
      v-model="showCameraModal"
      :title="t.takePhoto"
      :subtitle="t.cameraCapturePhotoSubtitle"
      @captured="onCapturedPhoto"
      @fallback="openCameraPickerFallback"
    />

    <Teleport to="body">
      <div v-if="showSourceModal" class="photo-source-backdrop" @click.self="showSourceModal = false">
        <div class="photo-source-modal" role="dialog" aria-modal="true" :aria-label="t.choosePhotoSource">
          <div class="photo-source-head">
            <div>
              <div class="photo-source-title">{{ t.addPhoto }}</div>
              <div class="photo-source-subtitle">{{ t.photoSourceSubtitle }}</div>
            </div>
            <button type="button" class="photo-source-close" @click="showSourceModal = false" :aria-label="t.close">
              <XIcon :size="18" />
            </button>
          </div>

          <div class="photo-source-grid">
            <button type="button" class="photo-source-card" @click="openGallery">
              <div class="photo-source-icon"><ImagesIcon :size="24" /></div>
              <div class="photo-source-label">{{ t.gallery }}</div>
              <div class="photo-source-copy">{{ t.photoLibraryCopy }}</div>
            </button>

            <button type="button" class="photo-source-card" @click="openCamera">
              <div class="photo-source-icon"><CameraIcon :size="24" /></div>
              <div class="photo-source-label">{{ t.takePhoto }}</div>
              <div class="photo-source-copy">{{ t.nativeCameraCopy }}</div>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { X as XIcon, Camera as CameraIcon, Images as ImagesIcon } from 'lucide-vue-next'
import CameraCaptureModal from './CameraCaptureModal.vue'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({ previewSrc: String, kb: Number })
const emit  = defineEmits(['picked', 'remove'])
const { t } = useI18n()
const galleryInput = ref(null)
const cameraInput = ref(null)
const showSourceModal = ref(false)
const showCameraModal = ref(false)

function onFile(e) {
  const file = e.target.files[0]
  if (!file) return
  e.target.value = ''
  showSourceModal.value = false
  emit('picked', file)
}

function openGallery() {
  showSourceModal.value = false
  galleryInput.value?.click()
}

function openCamera() {
  showSourceModal.value = false
  if (navigator?.mediaDevices?.getUserMedia) {
    showCameraModal.value = true
    return
  }
  openCameraPickerFallback()
}

function openCameraPickerFallback() {
  showCameraModal.value = false
  cameraInput.value?.click()
}

function onCapturedPhoto(file) {
  showCameraModal.value = false
  emit('picked', file)
}
</script>

<style>
.photo-upload-area {
  width: 100%;
  border: 0.5px dashed var(--border-hi);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-input);
}
.photo-upload-area:hover {
  border-color: var(--amber);
  background: rgba(200,130,42,0.04);
}
.photo-preview-wrap {
  position: relative;
  display: inline-block;
  width: 100%;
}
.photo-preview {
  width: 100%;
  max-height: 160px;
  object-fit: cover;
  border-radius: 6px;
  display: block;
}
.photo-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(0,0,0,0.6);
  border: none;
  color: #fff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  font-size: 0.7rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.photo-remove:hover {
  background: rgba(226,75,74,0.8);
}
.photo-upload-hint {
  font-size: 0.68rem;
  color: var(--peat-light);
  margin-top: 6px;
}

.photo-source-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(12, 12, 12, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  z-index: 60;
}
.photo-source-modal {
  width: min(100%, 360px);
  border-radius: 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
  padding: 16px;
}
.photo-source-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.photo-source-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}
.photo-source-subtitle {
  margin-top: 4px;
  font-size: 0.82rem;
  color: var(--text-muted);
}
.photo-source-close {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.photo-source-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.photo-source-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-input);
  padding: 14px 12px;
  min-height: 128px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}
.photo-source-card:hover {
  transform: translateY(-1px);
  border-color: var(--amber);
  background: rgba(200,130,42,0.05);
}
.photo-source-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--amber);
  background: rgba(200,130,42,0.12);
}
.photo-source-label {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}
.photo-source-copy {
  font-size: 0.78rem;
  line-height: 1.35;
  color: var(--text-muted);
}

@media (max-width: 420px) {
  .photo-source-grid {
    grid-template-columns: 1fr;
  }
}
</style>
