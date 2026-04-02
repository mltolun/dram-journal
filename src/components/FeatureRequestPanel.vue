<template>
  <div class="subs-overlay">
    <div class="subs-panel fr-panel">

      <!-- Header -->
      <div class="subs-header">
        <button class="subs-close" @click="$emit('close')" aria-label="Back">
          <span class="subs-close-arrow">←</span> Back
        </button>
        <div class="subs-title">{{ t.frTitle }}</div>
      </div>

      <!-- Submit form -->
      <div class="fr-form-section" :class="{ collapsed: formCollapsed }">
        <button class="fr-section-toggle" @click="formCollapsed = !formCollapsed">
          <span class="fr-section-label">{{ t.frSubmitSection }}</span>
          <span class="fr-toggle-icon">{{ formCollapsed ? '▼' : '▲' }}</span>
        </button>

        <transition name="collapse">
          <div v-if="!formCollapsed" class="fr-form">
            <!-- Title -->
            <div class="fr-field">
              <label class="fr-label">{{ t.frTitleLabel }} <span class="fr-required">*</span></label>
              <input
                v-model="form.title"
                class="fr-input"
                :placeholder="t.frTitlePlaceholder"
                maxlength="120"
                :disabled="submitting"
              />
              <div class="fr-char-count">{{ form.title.length }}/120</div>
            </div>

            <!-- Description -->
            <div class="fr-field">
              <label class="fr-label">{{ t.frDescLabel }} <span class="fr-required">*</span></label>
              <div class="fr-label-hint">{{ t.frDescHint }}</div>
              <textarea
                v-model="form.description"
                class="fr-textarea"
                :placeholder="t.frDescPlaceholder"
                rows="4"
                :disabled="submitting"
              ></textarea>
            </div>

            <!-- Impact -->
            <div class="fr-field">
              <label class="fr-label">{{ t.frImpactLabel }} <span class="fr-required">*</span></label>
              <div class="fr-label-hint">{{ t.frImpactHint }}</div>
              <textarea
                v-model="form.impact"
                class="fr-textarea"
                :placeholder="t.frImpactPlaceholder"
                rows="3"
                :disabled="submitting"
              ></textarea>
            </div>

            <div v-if="submitError" class="fr-error">{{ submitError }}</div>
            <div v-if="submitSuccess" class="fr-success">{{ t.frSubmitSuccess }}</div>

            <button
              class="fr-submit-btn"
              @click="doSubmit"
              :disabled="submitting || !canSubmit"
            >
              {{ submitting ? t.frSubmitting : t.frSubmitBtn }}
            </button>
          </div>
        </transition>
      </div>

      <!-- Divider -->
      <div class="fr-section-divider"></div>

      <!-- My requests list -->
      <div class="fr-list-section">
        <div class="fr-section-label" style="padding: 0 0 12px;">{{ t.frMyRequests }} ({{ myFeatureRequests.length }})</div>

        <div v-if="loading" class="fr-loading">{{ t.frLoading }}</div>

        <div v-else-if="myFeatureRequests.length === 0" class="fr-empty">
          <div class="fr-empty-icon">💡</div>
          <div>{{ t.frEmpty }}</div>
        </div>

        <div v-else class="fr-list">
          <div
            v-for="req in myFeatureRequests"
            :key="req.id"
            class="fr-item"
            :class="`fr-item--${req.status}`"
          >
            <div class="fr-item-top">
              <div class="fr-item-title">{{ req.title }}</div>
              <div class="fr-status-badge" :class="`badge--${req.status}`">{{ STATUS_LABELS[req.status] }}</div>
            </div>

            <div class="fr-item-meta">
              {{ t.frSubmitted }} {{ formatDate(req.created_at) }}
              <template v-if="req.priority">
                · {{ t.frPriority }}: <span class="fr-priority">{{ req.priority }}</span>
              </template>
              <template v-if="req.due_date">
                · {{ t.frDue }} {{ formatDate(req.due_date) }}
              </template>
            </div>

            <!-- Admin note shown when done -->
            <div v-if="req.status === 'done' && req.admin_note" class="fr-admin-note">
              <span class="fr-admin-note-label">{{ t.frFromTeam }}</span> {{ req.admin_note }}
            </div>

            <!-- Expandable description -->
            <div v-if="expanded === req.id" class="fr-item-body">
              <div class="fr-item-field-label">{{ t.frProblemStatement }}</div>
              <div class="fr-item-field-value">{{ req.description }}</div>
              <div class="fr-item-field-label" style="margin-top:10px;">{{ t.frUserImpact }}</div>
              <div class="fr-item-field-value">{{ req.impact }}</div>
            </div>

            <button class="fr-expand-btn" @click="expanded = expanded === req.id ? null : req.id">
              {{ expanded === req.id ? t.frLess : t.frDetails }}
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useFeatureRequests, myFeatureRequests } from '../composables/useFeatureRequests.js'
import { useI18n } from '../composables/useI18n.js'

const emit = defineEmits(['close'])

const { submitRequest, loadMyRequests } = useFeatureRequests()
const { t } = useI18n()

const STATUS_LABELS = computed(() => ({
  open:        t.value.frStatusOpen,
  accepted:    t.value.frStatusAccepted,
  in_progress: t.value.frStatusInProgress,
  done:        t.value.frStatusDone,
  declined:    t.value.frStatusDeclined,
}))

const form = ref({ title: '', description: '', impact: '' })
const submitting  = ref(false)
const submitError = ref('')
const submitSuccess = ref(false)
const loading       = ref(false)
const expanded      = ref(null)
const formCollapsed = ref(false)

const canSubmit = computed(() =>
  form.value.title.trim().length > 3 &&
  form.value.description.trim().length > 10 &&
  form.value.impact.trim().length > 5
)

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function doSubmit() {
  submitting.value  = true
  submitError.value = ''
  submitSuccess.value = false
  try {
    await submitRequest(form.value)
    form.value = { title: '', description: '', impact: '' }
    submitSuccess.value = true
    formCollapsed.value = true
    setTimeout(() => { submitSuccess.value = false }, 4000)
  } catch (e) {
    submitError.value = e.message || 'Failed to submit. Please try again.'
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  loading.value = true
  await loadMyRequests()
  loading.value = false
})
</script>

<style scoped>
/* ── Modal shell (must be defined locally — scoped styles don't inherit) ── */
.subs-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: var(--bg-modal, #1e1408);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.subs-panel {
  background: var(--bg-modal, #1e1408);
  border: none;
  border-radius: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.subs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.15));
  flex-shrink: 0;
  position: sticky;
  top: 0;
  background: var(--bg-modal, #1e1408);
  z-index: 1;
}
.subs-title {
  font-family: 'Inter', sans-serif; font-weight: 600; letter-spacing: -0.01em;
  font-size: 1rem;
  color: var(--text-primary, #F8F4EE);
}
.subs-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: color 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.subs-close-arrow { font-size: 1rem; line-height: 1; }
.subs-close:hover { color: var(--text-primary); background: rgba(200,130,42,0.07); }

/* ── Panel scrolls as a whole ── */
.fr-panel { flex: 1; overflow-y: auto; }

/* Centre content on wide screens */
.subs-panel > * {
  max-width: 680px;
  width: 100%;
  align-self: center;
  box-sizing: border-box;
}

/* ── Form section ── */
.fr-form-section {
  padding: 16px 20px 0;
  flex-shrink: 0;
}
.fr-section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0 0 12px;
}
.fr-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber);
}
.fr-toggle-icon {
  font-size: 0.55rem;
  color: var(--peat-light);
}
.fr-form {
  overflow: hidden;
}

.fr-field {
  margin-bottom: 14px;
}
.fr-label {
  display: block;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-secondary);
  margin-bottom: 4px;
}
.fr-required { color: var(--amber); }
.fr-label-hint {
  font-family: 'Inter', sans-serif;
  font-size: 0.68rem;
  color: var(--peat-light);
  margin-bottom: 6px;
  line-height: 1.45;
}
.fr-input,
.fr-textarea {
  width: 100%;
  background: var(--bg-input, rgba(200,130,42,0.06));
  border: 0.5px solid var(--border);
  border-radius: 7px;
  padding: 9px 11px;
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--text-primary);
  resize: vertical;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.fr-input:focus,
.fr-textarea:focus {
  outline: none;
  border-color: var(--amber);
}
.fr-textarea { min-height: 70px; }
.fr-char-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  color: var(--peat-light);
  text-align: right;
  margin-top: 3px;
}
.fr-error   { font-size: 0.72rem; color: #e08888; margin-bottom: 10px; }
.fr-success { font-size: 0.72rem; color: #1D9E75; margin-bottom: 10px; }

.fr-submit-btn {
  width: 100%;
  padding: 10px;
  background: var(--amber);
  color: var(--bg);
  border: none;
  border-radius: 7px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.15s;
  margin-bottom: 4px;
}
.fr-submit-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
.fr-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ── Divider / List ── */
.fr-section-divider {
  height: 0.5px;
  background: var(--border);
  margin: 12px 0 0;
  flex-shrink: 0;
}
.fr-list-section {
  padding: 16px 20px 20px;
  overflow-y: auto;
  flex: 1;
}
.fr-loading {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
  padding: 20px 0;
  text-align: center;
}
.fr-empty {
  text-align: center;
  padding: 28px 0;
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light);
  line-height: 1.6;
}
.fr-empty-icon { font-size: 1.6rem; margin-bottom: 8px; }

/* ── Request card ── */
.fr-item {
  border: 0.5px solid var(--border);
  border-radius: 9px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: rgba(200,130,42,0.04);
  transition: border-color 0.15s;
}
.fr-item--done     { border-color: rgba(29,158,117,0.4); background: rgba(29,158,117,0.04); }
.fr-item--accepted { border-color: rgba(200,130,42,0.35); }
.fr-item--declined { opacity: 0.55; }

.fr-item-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 5px;
}
.fr-item-title {
  flex: 1;
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
}
.fr-status-badge {
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 8px;
}
.badge--open        { background: rgba(200,130,42,0.15); color: var(--amber-light); }
.badge--accepted    { background: rgba(100,180,255,0.15); color: #88bef5; }
.badge--in_progress { background: rgba(200,130,42,0.25); color: var(--amber); }
.badge--done        { background: rgba(29,158,117,0.2);  color: #1D9E75; }
.badge--declined    { background: rgba(226,75,74,0.12);  color: #e08888; }

.fr-item-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  margin-bottom: 6px;
}
.fr-priority { color: var(--amber-light); }

.fr-admin-note {
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  font-style: italic;
  color: var(--text-secondary);
  background: rgba(29,158,117,0.08);
  border-left: 2px solid rgba(29,158,117,0.4);
  padding: 6px 10px;
  border-radius: 0 5px 5px 0;
  margin-bottom: 6px;
  line-height: 1.5;
}
.fr-admin-note-label {
  font-style: normal;
  font-weight: 500;
  color: #1D9E75;
}

.fr-item-body {
  margin: 8px 0 6px;
  padding: 10px;
  background: rgba(200,130,42,0.04);
  border-radius: 6px;
}
.fr-item-field-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--peat-light);
  margin-bottom: 3px;
}
.fr-item-field-value {
  font-family: 'Inter', sans-serif;
  font-size: 0.76rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.fr-expand-btn {
  background: none;
  border: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  color: var(--peat-light);
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.15s;
}
.fr-expand-btn:hover { color: var(--amber-light); }

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active { transition: max-height 0.25s ease, opacity 0.2s ease; max-height: 600px; overflow: hidden; }
.collapse-enter-from,
.collapse-leave-to { max-height: 0; opacity: 0; }
</style>
