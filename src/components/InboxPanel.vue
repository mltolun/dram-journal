<template>
  <div class="subs-overlay" @click.self="$emit('close')">
    <div class="subs-panel">

      <div class="subs-header">
        <div class="subs-title">
          Inbox
          <span v-if="unreadCount" class="inbox-unread-badge">{{ unreadCount }}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button v-if="unreadCount" class="mark-all-btn" @click="markAllRead">
            Mark all read
          </button>
          <button class="subs-close" @click="$emit('close')">✕</button>
        </div>
      </div>

      <div v-if="inbox.length === 0" class="inbox-empty">
        <div class="empty-icon">📬</div>
        <div>No messages yet. When a friend sends you a whisky recommendation it'll appear here.</div>
      </div>

      <div v-else class="inbox-list">
        <div
          v-for="msg in inbox"
          :key="msg.id"
          class="inbox-item"
          :class="{ unread: !msg.read }"
          @click="expand(msg)"
        >
          <div class="inbox-item-header">
            <div class="inbox-meta">
              <span class="inbox-from">{{ msg.sender_email }}</span>
              <span class="inbox-dot">·</span>
              <span class="inbox-date">{{ formatDate(msg.created_at) }}</span>
            </div>
            <button class="inbox-delete" @click.stop="deleteMessage(msg.id)" title="Delete">✕</button>
          </div>

          <div class="inbox-whisky-name">
            🥃 {{ msg.whisky_payload.name }}
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
              ★ {{ msg.whisky_payload.rating }} / 5 rated by sender
            </div>
          </div>

          <div class="inbox-expand-hint">
            {{ expanded === msg.id ? '▲ less' : '▼ more' }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useMessages, inbox, unreadCount } from '../composables/useMessages.js'

defineEmits(['close'])

const { loadInbox, markRead, markAllRead, deleteMessage } = useMessages()

const ATTRS = ['dulzor', 'ahumado', 'cuerpo', 'frutado', 'especiado']
const ATTR_LABELS = {
  dulzor: 'Sweetness', ahumado: 'Smokiness', cuerpo: 'Body',
  frutado: 'Fruitiness', especiado: 'Spiciness',
}

const expanded = ref(null)

onMounted(loadInbox)

function expand(msg) {
  if (expanded.value === msg.id) {
    expanded.value = null
  } else {
    expanded.value = msg.id
    if (!msg.read) markRead(msg.id)
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

.inbox-empty {
  padding: 40px 24px;
  text-align: center;
  font-family: 'DM Mono', monospace;
  font-size: 0.68rem;
  color: var(--peat-light);
  line-height: 1.7;
}
.empty-icon { font-size: 2rem; margin-bottom: 12px; }

.inbox-list {
  display: flex;
  flex-direction: column;
}

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

.inbox-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.inbox-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}

.inbox-from {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  color: var(--amber-light);
}

.inbox-dot {
  color: var(--peat-light);
  font-size: 0.7rem;
}

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
