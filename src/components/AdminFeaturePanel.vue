<template>
  <div class="subs-overlay" @click.self="$emit('close')">
    <div class="subs-panel admin-panel">

      <!-- Header -->
      <div class="subs-header">
        <div class="subs-title">🛠 Feature Requests <span class="admin-badge">Admin</span></div>
        <button class="subs-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Filters -->
      <div class="admin-filters">
        <button
          v-for="f in FILTERS"
          :key="f.value"
          class="filter-chip"
          :class="{ active: activeFilter === f.value }"
          @click="activeFilter = f.value"
        >
          {{ f.label }}
          <span class="filter-count">{{ countByStatus(f.value) }}</span>
        </button>
      </div>

      <!-- List -->
      <div class="admin-list">
        <div v-if="loading" class="fr-loading">Loading…</div>

        <div v-else-if="filtered.length === 0" class="fr-empty">
          <div class="fr-empty-icon">✓</div>
          <div>No requests in this category.</div>
        </div>

        <div
          v-for="req in filtered"
          :key="req.id"
          class="admin-item"
          :class="`admin-item--${req.status}`"
        >
          <!-- Top row -->
          <div class="admin-item-top">
            <div class="admin-item-left">
              <div class="admin-item-title">{{ req.title }}</div>
              <div class="admin-item-submitter">{{ req.user_email }} · {{ formatDate(req.created_at) }}</div>
            </div>
            <div class="fr-status-badge" :class="`badge--${req.status}`">{{ STATUS_LABELS[req.status] }}</div>
          </div>

          <!-- Detail (always visible for admin) -->
          <div class="admin-item-body" v-if="expanded === req.id">
            <div class="admin-field-group">
              <div class="admin-field-label">Problem statement</div>
              <div class="admin-field-value">{{ req.description }}</div>
            </div>
            <div class="admin-field-group">
              <div class="admin-field-label">User impact</div>
              <div class="admin-field-value">{{ req.impact }}</div>
            </div>

            <!-- Admin controls -->
            <div class="admin-controls">
              <!-- Status -->
              <div class="admin-control-row">
                <label class="admin-ctrl-label">Status</label>
                <div class="admin-select-wrap">
                  <select v-model="drafts[req.id].status" class="admin-select">
                    <option v-for="s in STATUSES" :key="s.value" :value="s.value">{{ s.label }}</option>
                  </select>
                </div>
              </div>

              <!-- Priority -->
              <div class="admin-control-row">
                <label class="admin-ctrl-label">Priority</label>
                <div class="admin-select-wrap">
                  <select v-model="drafts[req.id].priority" class="admin-select">
                    <option value="">— none —</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <!-- Due date -->
              <div class="admin-control-row">
                <label class="admin-ctrl-label">Due date</label>
                <input
                  type="date"
                  v-model="drafts[req.id].due_date"
                  class="admin-date-input"
                />
              </div>

              <!-- Admin note (shown to user when done) -->
              <div class="admin-control-row admin-control-row--col">
                <label class="admin-ctrl-label">
                  Note to user
                  <span class="admin-ctrl-hint">(shown when status → Done)</span>
                </label>
                <textarea
                  v-model="drafts[req.id].admin_note"
                  class="admin-note-input"
                  placeholder="Briefly describe what was built, or link to the release…"
                  rows="2"
                ></textarea>
              </div>

              <!-- Actions -->
              <div class="admin-action-row">
                <button
                  class="admin-save-btn"
                  @click="doSave(req)"
                  :disabled="saving === req.id"
                >
                  {{ saving === req.id ? 'Saving…' : 'Save changes' }}
                </button>
                <button class="admin-delete-btn" @click="confirmDelete(req)">Delete</button>
              </div>

              <div v-if="saveSuccess === req.id" class="admin-save-ok">✓ Saved</div>
              <div v-if="saveError === req.id" class="admin-save-err">Failed to save</div>
            </div>
          </div>

          <button class="fr-expand-btn" @click="toggleExpand(req)">
            {{ expanded === req.id ? '▲ collapse' : '▼ manage' }}
          </button>
        </div>
      </div>

      <!-- Delete confirm modal -->
      <div v-if="deleteTarget" class="admin-confirm-overlay" @click.self="deleteTarget = null">
        <div class="admin-confirm-box">
          <div class="admin-confirm-title">Delete this request?</div>
          <div class="admin-confirm-sub">{{ deleteTarget.title }}</div>
          <div class="admin-confirm-actions">
            <button class="admin-delete-confirm-btn" @click="doDelete">Yes, delete</button>
            <button class="admin-cancel-btn" @click="deleteTarget = null">Cancel</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useFeatureRequests, featureRequests } from '../composables/useFeatureRequests.js'

const emit = defineEmits(['close'])
const { loadAllRequests, updateRequest, deleteRequest } = useFeatureRequests()

const STATUS_LABELS = {
  open:        'Open',
  accepted:    'Accepted',
  in_progress: 'In Progress',
  done:        'Done',
  declined:    'Declined',
}

const STATUSES = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

const FILTERS = [
  { label: 'All',         value: 'all' },
  { label: 'Open',        value: 'open' },
  { label: 'Accepted',    value: 'accepted' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done',        value: 'done' },
  { label: 'Declined',    value: 'declined' },
]

const activeFilter = ref('all')
const expanded     = ref(null)
const loading      = ref(false)
const saving       = ref(null)
const saveSuccess  = ref(null)
const saveError    = ref(null)
const deleteTarget = ref(null)

// Per-row editable drafts
const drafts = reactive({})

function initDraft(req) {
  if (!drafts[req.id]) {
    drafts[req.id] = {
      status:     req.status,
      priority:   req.priority || '',
      due_date:   req.due_date ? req.due_date.slice(0, 10) : '',
      admin_note: req.admin_note || '',
    }
  }
}

function toggleExpand(req) {
  if (expanded.value === req.id) {
    expanded.value = null
  } else {
    initDraft(req)
    expanded.value = req.id
  }
}

const filtered = computed(() => {
  if (activeFilter.value === 'all') return featureRequests.value
  return featureRequests.value.filter(r => r.status === activeFilter.value)
})

function countByStatus(status) {
  if (status === 'all') return featureRequests.value.length
  return featureRequests.value.filter(r => r.status === status).length
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function doSave(req) {
  saving.value    = req.id
  saveSuccess.value = null
  saveError.value   = null
  try {
    const d = drafts[req.id]
    await updateRequest(req.id, {
      status:     d.status,
      priority:   d.priority || null,
      due_date:   d.due_date  || null,
      admin_note: d.admin_note.trim() || null,
    })
    saveSuccess.value = req.id
    setTimeout(() => { if (saveSuccess.value === req.id) saveSuccess.value = null }, 3000)
  } catch {
    saveError.value = req.id
    setTimeout(() => { if (saveError.value === req.id) saveError.value = null }, 3000)
  } finally {
    saving.value = null
  }
}

function confirmDelete(req) {
  deleteTarget.value = req
}

async function doDelete() {
  if (!deleteTarget.value) return
  await deleteRequest(deleteTarget.value.id)
  if (expanded.value === deleteTarget.value.id) expanded.value = null
  deleteTarget.value = null
}

onMounted(async () => {
  loading.value = true
  await loadAllRequests()
  loading.value = false
})
</script>

<style scoped>
/* ── Modal shell (must be defined locally — scoped styles don't inherit) ── */
.subs-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(20, 12, 4, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}
.subs-panel {
  background: var(--bg-modal, #1e1408);
  border: 0.5px solid var(--border-hi, rgba(200,130,42,0.35));
  border-radius: 16px;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.subs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.15));
  flex-shrink: 0;
}
.subs-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.15rem;
  color: var(--text-primary, #F8F4EE);
  display: flex;
  align-items: center;
  gap: 8px;
}
.subs-close {
  background: none;
  border: none;
  color: var(--peat-light);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}
.subs-close:hover { color: var(--text-primary); }

/* ── Admin panel sizing ── */
.admin-panel {
  max-height: 92dvh;
  max-width: 560px;
}

.admin-badge {
  font-family: 'DM Mono', monospace;
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: rgba(200,130,42,0.2);
  color: var(--amber-light);
  padding: 2px 7px;
  border-radius: 999px;
  margin-left: 8px;
  vertical-align: middle;
}

/* Filters */
.admin-filters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 20px;
  border-bottom: 0.5px solid var(--border);
  flex-shrink: 0;
}
.filter-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 999px;
  padding: 4px 11px;
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.filter-chip:hover  { border-color: var(--amber); color: var(--text-primary); }
.filter-chip.active { border-color: var(--amber); background: rgba(200,130,42,0.12); color: var(--amber-light); }
.filter-count {
  background: rgba(200,130,42,0.15);
  color: var(--amber-light);
  border-radius: 999px;
  padding: 0 5px;
  font-size: 0.52rem;
  line-height: 1.6;
  min-width: 16px;
  text-align: center;
}

/* List */
.admin-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px 24px;
}
.fr-loading {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
  padding: 20px 0;
  text-align: center;
}
.fr-empty {
  text-align: center;
  padding: 28px 0;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light);
  line-height: 1.6;
}
.fr-empty-icon { font-size: 1.6rem; margin-bottom: 8px; }

/* Item card */
.admin-item {
  border: 0.5px solid var(--border);
  border-radius: 9px;
  padding: 12px 14px;
  margin-bottom: 10px;
  background: rgba(200,130,42,0.04);
}
.admin-item--done     { border-color: rgba(29,158,117,0.35); }
.admin-item--accepted { border-color: rgba(100,180,255,0.25); }
.admin-item--declined { opacity: 0.6; }
.admin-item--in_progress { border-color: rgba(200,130,42,0.35); }

.admin-item-top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 4px;
}
.admin-item-left { flex: 1; }
.admin-item-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
  margin-bottom: 3px;
}
.admin-item-submitter {
  font-family: 'DM Mono', monospace;
  font-size: 0.57rem;
  color: var(--peat-light);
}

/* Status badge (shared with user panel) */
.fr-status-badge {
  flex-shrink: 0;
  font-family: 'DM Mono', monospace;
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

/* Item body */
.admin-item-body {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 0.5px solid var(--border);
}
.admin-field-group { margin-bottom: 10px; }
.admin-field-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--peat-light);
  margin-bottom: 3px;
}
.admin-field-value {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.76rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Controls */
.admin-controls {
  margin-top: 14px;
  padding: 12px;
  background: rgba(200,130,42,0.05);
  border-radius: 8px;
  border: 0.5px solid var(--border);
}
.admin-control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.admin-control-row--col {
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}
.admin-ctrl-label {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  min-width: 72px;
  flex-shrink: 0;
}
.admin-ctrl-hint {
  font-size: 0.52rem;
  color: var(--peat-light);
  margin-left: 4px;
  text-transform: none;
  letter-spacing: 0;
}
.admin-select-wrap { flex: 1; }
.admin-select,
.admin-date-input {
  width: 100%;
  background: var(--bg-input, rgba(200,130,42,0.06));
  border: 0.5px solid var(--border);
  border-radius: 6px;
  padding: 7px 9px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  color: var(--text-primary);
  cursor: pointer;
}
.admin-select:focus,
.admin-date-input:focus { outline: none; border-color: var(--amber); }

.admin-note-input {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-input, rgba(200,130,42,0.06));
  border: 0.5px solid var(--border);
  border-radius: 6px;
  padding: 7px 9px;
  font-family: 'DM Sans', sans-serif;
  font-size: 0.75rem;
  color: var(--text-primary);
  resize: vertical;
  min-height: 54px;
}
.admin-note-input:focus { outline: none; border-color: var(--amber); }

.admin-action-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.admin-save-btn {
  flex: 1;
  padding: 9px 0;
  background: var(--amber);
  color: var(--bg);
  border: none;
  border-radius: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.2s;
}
.admin-save-btn:hover:not(:disabled) { opacity: 0.85; }
.admin-save-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.admin-delete-btn {
  padding: 9px 14px;
  background: none;
  border: 0.5px solid rgba(226,75,74,0.4);
  border-radius: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: #e08888;
  cursor: pointer;
  transition: background 0.15s;
}
.admin-delete-btn:hover { background: rgba(226,75,74,0.1); }

.admin-save-ok  { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: #1D9E75; margin-top: 6px; }
.admin-save-err { font-family: 'DM Mono', monospace; font-size: 0.6rem; color: #e08888; margin-top: 6px; }

.fr-expand-btn {
  background: none;
  border: none;
  font-family: 'DM Mono', monospace;
  font-size: 0.55rem;
  color: var(--peat-light);
  cursor: pointer;
  padding: 4px 0 0;
  margin-top: 4px;
  transition: color 0.15s;
}
.fr-expand-btn:hover { color: var(--amber-light); }

/* Delete confirm */
.admin-confirm-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
  z-index: 10;
}
.admin-confirm-box {
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-radius: 12px;
  padding: 24px 28px;
  text-align: center;
  max-width: 300px;
}
.admin-confirm-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.admin-confirm-sub {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.76rem;
  color: var(--peat-light);
  margin-bottom: 18px;
  line-height: 1.4;
}
.admin-confirm-actions { display: flex; gap: 10px; justify-content: center; }
.admin-delete-confirm-btn {
  padding: 8px 18px;
  background: rgba(226,75,74,0.15);
  border: 0.5px solid rgba(226,75,74,0.5);
  border-radius: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: #e08888;
  cursor: pointer;
}
.admin-cancel-btn {
  padding: 8px 18px;
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: var(--text-secondary);
  cursor: pointer;
}
</style>
