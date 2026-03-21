<template>
  <div class="subs-overlay" @click.self="$emit('close')">
    <div class="subs-panel inbox-panel">

      <!-- Header -->
      <div class="subs-header">
        <div class="subs-title">
          {{ t.inbox }}
          <span v-if="totalCount" class="inbox-unread-badge">{{ totalCount }}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button v-if="unreadCount" class="mark-all-btn" @click="markAllRead">
            {{ t.markAllRead }}
          </button>
          <button class="subs-close" @click="$emit('close')">✕</button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="allItems.length === 0" class="inbox-empty">
        <div class="empty-icon">📬</div>
        <div>{{ t.inboxEmpty }}</div>
      </div>

      <div v-else class="inbox-list">

        <!-- ── Follow request items ── -->
        <div
          v-for="req in pendingRequests"
          :key="`follow-${req.id}`"
          class="inbox-item inbox-item--follow"
        >
          <div class="inbox-item-header">
            <div class="inbox-meta">
              <span class="inbox-type-pill inbox-type-pill--follow">{{ t.followRequest }}</span>
              <span class="inbox-dot">·</span>
              <span class="inbox-date">{{ formatDate(req.created_at) }}</span>
            </div>
          </div>

          <div class="inbox-follow-from">
            <span class="inbox-follow-email">{{ req.follower_email || req.follower_id }}</span>
            {{ t.wantsToFollow }}
          </div>

          <div class="inbox-follow-actions">
            <button
              class="follow-accept-btn"
              @click="doAccept(req.id, req.follower_email)"
              :disabled="actioning === req.id"
            >
              {{ actioning === req.id ? '…' : t.accept }}
            </button>
            <button
              class="follow-decline-btn"
              @click="doDecline(req.id)"
              :disabled="actioning === req.id"
            >
              {{ t.decline }}
            </button>
          </div>
        </div>

        <!-- ── Whisky message items ── -->
        <div
          v-for="msg in inbox"
          :key="`msg-${msg.id}`"
          class="inbox-item"
          :class="{ unread: !msg.read }"
          @click="expand(msg)"
        >
          <div class="inbox-item-header">
            <div class="inbox-meta">
              <span class="inbox-type-pill inbox-type-pill--whisky">{{ t.sharedDram }}</span>
              <span class="inbox-dot">·</span>
              <span class="inbox-from">{{ msg.sender_email }}</span>
              <span class="inbox-dot">·</span>
              <span class="inbox-date">{{ formatDate(msg.created_at) }}</span>
            </div>
            <button class="inbox-delete" @click.stop="deleteMessage(msg.id)" title="Delete">✕</button>
          </div>

          <div class="inbox-whisky-name">
            {{ msg.whisky_payload.name }}
          </div>

          <div v-if="msg.whisky_payload.distillery" class="inbox-whisky-sub">
            {{ msg.whisky_payload.distillery }}
            <template v-if="msg.whisky_payload.age"> · {{ msg.whisky_payload.age }}</template>
          </div>

          <!-- Expanded detail -->
          <div v-if="expanded === msg.id" class="inbox-detail">
            <div v-if="msg.whisky_payload.notes" class="inbox-notes">
              "{{ msg.whisky_payload.notes }}"
            </div>

            <div class="inbox-bars">
              <div v-for="a in ATTRS" :key="a" class="inbox-bar-row">
                <span class="inbox-bar-lbl">{{ ATTR_LABELS[a] }}</span>
                <div class="inbox-bar-track">
                  <div class="inbox-bar-fill" :style="{ width: (msg.whisky_payload[a] || 0) * 20 + '%' }"></div>
                </div>
                <span class="inbox-bar-val">{{ msg.whisky_payload[a] || 0 }}</span>
              </div>
            </div>

            <div v-if="msg.whisky_payload.rating" class="inbox-rating">
              ★ {{ msg.whisky_payload.rating }} / 5
            </div>
          </div>

          <div class="inbox-expand-hint">
            {{ expanded === msg.id ? t.frLess : t.frDetails }}
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useMessages, inbox, unreadCount } from '../composables/useMessages.js'
import { useSubscriptions, pendingRequests } from '../composables/useSubscriptions.js'
import { useI18n } from '../composables/useI18n.js'

defineEmits(['close'])

const { load{{ t.inbox }}, markRead, markAllRead, deleteMessage } = useMessages()
const { loadSubscriptions, acceptRequest, removeSubscription } = useSubscriptions()
const { t } = useI18n()

const ATTRS = ['dulzor', 'ahumado', 'cuerpo', 'frutado', 'especiado']
const ATTR_LABELS = {
  dulzor: 'Sweetness', ahumado: 'Smokiness', cuerpo: 'Body',
  frutado: 'Fruitiness', especiado: 'Spiciness',
}

const expanded  = ref(null)
const actioning = ref(null)   // id of the follow request currently being actioned

// Total badge count: unread messages + pending follow requests
const totalCount = computed(() =>
  unreadCount.value + pendingRequests.value.length
)

// Used to check empty state
const allItems = computed(() =>
  [...pendingRequests.value, ...inbox.value]
)

onMounted(async () => {
  await Promise.all([load{{ t.inbox }}(), loadSubscriptions()])
})

function expand(msg) {
  if (expanded.value === msg.id) {
    expanded.value = null
  } else {
    expanded.value = msg.id
    if (!msg.read) markRead(msg.id)
  }
}

async function doAccept(id, email) {
  actioning.value = id
  try {
    await acceptRequest(id, email)
  } finally {
    actioning.value = null
  }
}

async function doDecline(id) {
  actioning.value = id
  try {
    await removeSubscription(id)
  } finally {
    actioning.value = null
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
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
  max-width: 480px;
  max-height: 85vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.subs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.15));
  position: sticky;
  top: 0;
  background: var(--bg-modal, #1e1408);
  z-index: 2;
}

.subs-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1.15rem;
  color: var(--text-primary, #F8F4EE);
  display: flex;
  align-items: center;
  gap: 8px;
}

.inbox-unread-badge {
  background: var(--amber);
  color: #fff;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  border-radius: 999px;
  padding: 2px 7px;
  line-height: 1.5;
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

.mark-all-btn {
  background: none;
  border: 0.5px solid var(--border-hi);
  border-radius: 6px;
  padding: 4px 10px;
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--peat-light);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.mark-all-btn:hover { color: var(--amber); border-color: var(--amber); }

/* Empty */
.inbox-empty {
  padding: 40px 24px;
  text-align: center;
  font-family: 'DM Mono', monospace;
  font-size: 0.68rem;
  color: var(--peat-light);
  line-height: 1.7;
}
.empty-icon { font-size: 2rem; margin-bottom: 12px; }

/* List */
.inbox-list {
  display: flex;
  flex-direction: column;
}

/* ── Base item ── */
.inbox-item {
  padding: 16px 24px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.1));
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}
.inbox-item:hover { background: rgba(200,130,42,0.04); }
.inbox-item.unread { background: rgba(200,130,42,0.06); }
.inbox-item.unread::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--amber);
}

/* ── Follow-request item variant ── */
.inbox-item--follow {
  cursor: default;
  background: rgba(100, 180, 255, 0.04);
  border-left: 2px solid rgba(100, 180, 255, 0.3);
}
.inbox-item--follow:hover { background: rgba(100, 180, 255, 0.07); }

/* Type pills */
.inbox-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.inbox-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.inbox-type-pill {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border-radius: 999px;
  padding: 2px 7px;
}
.inbox-type-pill--follow {
  background: rgba(100,180,255,0.15);
  color: #88bef5;
}
.inbox-type-pill--whisky {
  background: rgba(200,130,42,0.15);
  color: var(--amber-light);
}

.inbox-from {
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  color: var(--amber-light);
}
.inbox-dot { color: var(--peat-light); font-size: 0.7rem; }
.inbox-date {
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  color: var(--peat-light);
}

.inbox-delete {
  background: none;
  border: none;
  color: var(--peat-light);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 2px 4px;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.inbox-delete:hover { opacity: 1; color: #E24B4A; }

/* Follow request body */
.inbox-follow-from {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.4;
  margin-bottom: 12px;
}
.inbox-follow-email {
  font-family: 'DM Mono', monospace;
  font-size: 0.75rem;
  color: var(--text-primary);
  display: block;
  margin-bottom: 2px;
}
.inbox-follow-actions {
  display: flex;
  gap: 8px;
}
.follow-accept-btn {
  padding: 7px 18px;
  background: rgba(29,158,117,0.15);
  border: 0.5px solid rgba(29,158,117,0.5);
  border-radius: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #1D9E75;
  cursor: pointer;
  transition: background 0.15s;
}
.follow-accept-btn:hover:not(:disabled) { background: rgba(29,158,117,0.25); }
.follow-accept-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.follow-decline-btn {
  padding: 7px 14px;
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 6px;
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--peat-light);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.follow-decline-btn:hover:not(:disabled) {
  background: rgba(226,75,74,0.08);
  color: #e08888;
  border-color: rgba(226,75,74,0.35);
}
.follow-decline-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Whisky message body */
.inbox-whisky-name {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 1rem;
  color: var(--text-primary);
  line-height: 1.3;
  margin-bottom: 2px;
}
.inbox-whisky-sub {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
  margin-bottom: 4px;
}
.inbox-expand-hint {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  opacity: 0.5;
  margin-top: 6px;
  letter-spacing: 0.05em;
}

/* Expanded detail */
.inbox-detail {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 0.5px solid var(--border);
}
.inbox-notes {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  font-style: italic;
  color: var(--peat-light);
  line-height: 1.55;
  margin-bottom: 10px;
  padding-left: 10px;
  border-left: 2px solid rgba(200,130,42,0.3);
}
.inbox-bars { margin-bottom: 8px; }
.inbox-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.inbox-bar-lbl {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--peat-light);
  width: 68px;
  flex-shrink: 0;
}
.inbox-bar-track {
  flex: 1;
  height: 4px;
  background: rgba(250,245,236,0.1);
  border-radius: 4px;
  overflow: hidden;
}
.inbox-bar-fill {
  height: 100%;
  background: var(--amber-light);
  border-radius: 4px;
  transition: width 0.3s ease;
}
.inbox-bar-val {
  font-family: 'DM Mono', monospace;
  font-size: 0.6rem;
  color: var(--amber-light);
  width: 12px;
  text-align: right;
}
.inbox-rating {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: var(--amber);
  margin-top: 4px;
}
</style>
