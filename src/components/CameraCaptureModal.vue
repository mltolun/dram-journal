<template>
  <Teleport v-if="modelValue" to="body">
    <div class="camera-capture-backdrop" @click.self="close">
      <div class="camera-capture-modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="camera-capture-head">
          <div>
            <div class="camera-capture-title">{{ title }}</div>
            <div class="camera-capture-subtitle">
              <template v-if="errorMsg">{{ errorMsg }}</template>
              <template v-else>{{ subtitle }}</template>
            </div>
          </div>
          <button type="button" class="camera-capture-close" @click="close" :aria-label="t.cameraCloseAria">
            <XIcon :size="18" />
          </button>
        </div>

        <div class="camera-capture-stage" :class="{ 'is-error': !!errorMsg }">
          <video
            v-show="!errorMsg"
            ref="videoRef"
            class="camera-capture-video"
            autoplay
            playsinline
            muted
          ></video>
          <div v-if="!errorMsg && starting" class="camera-capture-status">{{ t.cameraOpening }}</div>
          <div v-else-if="errorMsg" class="camera-capture-status">{{ errorMsg }}</div>
        </div>

        <div class="camera-capture-actions">
          <button
            v-if="!errorMsg"
            type="button"
            class="camera-capture-button primary"
            :disabled="starting"
            @click="capturePhoto"
          >
            {{ t.cameraCapture }}
          </button>
          <button
            v-else
            type="button"
            class="camera-capture-button primary"
            @click="emit('fallback')"
          >
            {{ t.cameraUsePicker }}
          </button>
          <button type="button" class="camera-capture-button" @click="close">{{ t.cancel }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { X as XIcon } from 'lucide-vue-next'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: 'Take photo' },
  subtitle: { type: String, default: 'Use your device camera to capture a photo.' },
})

const emit = defineEmits(['update:modelValue', 'captured', 'fallback'])
const { t } = useI18n()

const videoRef = ref(null)
const streamRef = ref(null)
const starting = ref(false)
const errorMsg = ref('')

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    await startCamera()
  } else {
    stopCamera()
    errorMsg.value = ''
  }
}, { immediate: true })

onBeforeUnmount(stopCamera)

async function startCamera() {
  if (streamRef.value && videoRef.value?.srcObject) {
    starting.value = false
    return
  }

  if (!navigator?.mediaDevices?.getUserMedia) {
    errorMsg.value = t.value.cameraNotSupported
    return
  }

  starting.value = true
  errorMsg.value = ''
  stopCamera()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1600 },
        height: { ideal: 1600 },
      },
      audio: false,
    })

    streamRef.value = stream
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
    }
  } catch (error) {
    console.error('[camera] failed to start stream', error)
    errorMsg.value = t.value.cameraUnavailable
  } finally {
    starting.value = false
  }
}

function stopCamera() {
  streamRef.value?.getTracks().forEach(track => track.stop())
  streamRef.value = null
  if (videoRef.value) videoRef.value.srcObject = null
}

function close() {
  emit('update:modelValue', false)
}

function capturePhoto() {
  const video = videoRef.value
  if (!video || !video.videoWidth || !video.videoHeight) {
    errorMsg.value = t.value.cameraUnavailable
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) {
    errorMsg.value = t.value.cameraProcessFailed
    return
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  canvas.toBlob((blob) => {
    if (!blob) {
      errorMsg.value = t.value.cameraCaptureFailed
      return
    }

    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
    emit('captured', file)
    close()
  }, 'image/jpeg', 0.92)
}
</script>

<style>
.camera-capture-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(12, 12, 12, 0.72);
}
.camera-capture-modal {
  width: min(100%, 420px);
  border-radius: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.38);
  padding: 16px;
}
.camera-capture-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.camera-capture-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}
.camera-capture-subtitle {
  margin-top: 4px;
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--text-muted);
}
.camera-capture-close {
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
.camera-capture-stage {
  position: relative;
  margin-top: 14px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: 16px;
  background: #090909;
  border: 1px solid var(--border);
}
.camera-capture-stage.is-error {
  background: rgba(226, 75, 74, 0.08);
}
.camera-capture-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.camera-capture-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  font-size: 0.9rem;
  color: #f6f1ed;
  background: rgba(9, 9, 9, 0.34);
}
.camera-capture-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.camera-capture-button {
  flex: 1;
  min-height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  font-weight: 600;
}
.camera-capture-button.primary {
  border-color: transparent;
  background: var(--amber);
  color: #1b1306;
}
.camera-capture-button:disabled {
  opacity: 0.6;
}
</style>
