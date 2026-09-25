<template>
  <div class="modal-backdrop open" ref="rootEl" role="dialog" aria-modal="true" :aria-label="t.sharePromptTitle" @click.self="$emit('close')">
    <div class="modal modal--xs">
      <div class="modal-header">
        <div class="modal-title">{{ t.sharePromptTitle }}</div>
        <button class="modal-close" :aria-label="t.close" @click="$emit('close')"><XIcon :size="14" aria-hidden="true" /></button>
      </div>

      <div class="prompt-body">
        <div class="prompt-icon" aria-hidden="true">
          <SendIcon :size="18" />
        </div>
        <p class="prompt-copy">
          {{ t.sharePromptCopy }}
        </p>

        <div class="prompt-card">
          <div class="prompt-name">{{ whisky?.name }}</div>
          <div v-if="whisky?.distillery" class="prompt-meta">{{ whisky.distillery }}</div>
          <div class="prompt-note">
            {{ t.sharePromptNote }}
          </div>
        </div>

        <label class="prompt-remember">
          <input v-model="dontAsk" type="checkbox">
          {{ t.sharePromptDontAsk }}
        </label>

        <div class="modal-actions prompt-actions">
          <button class="btn-save" @click="share">
            <SendIcon :size="14" aria-hidden="true" /> {{ t.shareNow }}
          </button>
          <button class="btn-cancel" @click="dismiss">{{ t.notNow }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { X as XIcon, Send as SendIcon } from 'lucide-vue-next'
import { useI18n } from '../composables/useI18n.js'
import { useDialog } from '../composables/useDialog.js'

const props = defineProps({
  whisky: { type: Object, default: null },
})

const emit = defineEmits(['share', 'close'])

const { t } = useI18n()
const rootEl = ref(null)
useDialog(rootEl, { onClose: () => emit('close') })

const dontAsk = ref(localStorage.getItem('dj_no_share_prompt') === '1')

function dismiss() {
  if (dontAsk.value) localStorage.setItem('dj_no_share_prompt', '1')
  emit('close')
}

function share() {
  if (dontAsk.value) localStorage.setItem('dj_no_share_prompt', '1')
  emit('share')
}
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
  margin-bottom: 12px;
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

.prompt-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.76rem;
  color: var(--text-secondary);
  cursor: pointer;
  margin-bottom: 2px;
}
.prompt-remember input {
  width: 16px;
  height: 16px;
  accent-color: var(--amber);
}

.prompt-actions {
  margin-top: 0.75rem;
}
</style>
