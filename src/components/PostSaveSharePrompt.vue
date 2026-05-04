<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal" style="max-width:420px">
      <div class="modal-header">
        <div class="modal-title">{{ title }}</div>
        <button class="modal-close" @click="$emit('close')"><XIcon :size="14" /></button>
      </div>

      <div class="prompt-body">
        <div class="prompt-icon">
          <SendIcon :size="18" />
        </div>
        <p class="prompt-copy">
          Your entry is saved. Share it with friends now, or keep it private for the moment.
        </p>

        <div class="prompt-card">
          <div class="prompt-name">{{ whisky?.name }}</div>
          <div v-if="whisky?.distillery" class="prompt-meta">{{ whisky.distillery }}</div>
          <div class="prompt-note">
            You can hide notes, rating, or photo before sending.
          </div>
        </div>

        <div class="modal-actions prompt-actions">
          <button class="btn-save" @click="$emit('share')">
            <SendIcon :size="14" /> Share now
          </button>
          <button class="btn-cancel" @click="$emit('close')">Not now</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { X as XIcon, Send as SendIcon } from 'lucide-vue-next'

const props = defineProps({
  whisky: { type: Object, default: null },
})

defineEmits(['share', 'close'])

const title = computed(() => 'Share this save?')
</script>

<style scoped>
.prompt-body {
  padding: 18px 20px 20px;
}

.prompt-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(200, 130, 42, 0.12);
  color: var(--amber);
  margin-bottom: 12px;
}

.prompt-copy {
  margin: 0 0 14px;
  color: var(--text-primary);
  font-size: 0.88rem;
  line-height: 1.5;
}

.prompt-card {
  border: 0.5px solid var(--border);
  border-radius: 10px;
  background: rgba(200, 130, 42, 0.04);
  padding: 12px 14px;
  margin-bottom: 14px;
}

.prompt-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.prompt-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.prompt-note {
  margin-top: 8px;
  font-size: 0.78rem;
  color: var(--peat-light);
  line-height: 1.5;
}

.prompt-actions {
  margin-top: 0.75rem;
}
</style>
