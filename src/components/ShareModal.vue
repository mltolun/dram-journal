<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal" style="max-width:480px">
      <div class="modal-header">
        <div class="modal-title">{{ t.shareThisDram }}</div>
        <button class="modal-close" @click="$emit('close')"><XIcon :size="14" /></button>
      </div>

      <!-- Tabs -->
      <div class="share-tabs">
        <button class="share-tab" :class="{ active: tab === 'link' }" @click="tab = 'link'">
          <LinkIcon :size="12" /> Share link
        </button>
        <button class="share-tab" :class="{ active: tab === 'send' }" @click="tab = 'send'">
          <SendIcon :size="12" /> Send to friend
          <span v-if="myFollowers.length" class="tab-count">{{ myFollowers.length }}</span>
        </button>
      </div>

      <!-- Link tab -->
      <div v-if="tab === 'link'" class="tab-body">
        <p class="share-desc">{{ t.shareDescription }}</p>
        <div class="share-link-box">
          <input type="text" :value="shareUrl" readonly>
          <button @click="copy">{{ t.copy }}</button>
        </div>
        <div class="share-tip">{{ tip }}</div>
      </div>

      <!-- Send to friend tab -->
      <div v-else class="tab-body">
        <p class="share-desc">
          Send <strong>{{ whisky.name }}</strong> directly to one of your friends.
          They'll see it in their inbox inside the app.
        </p>

        <div v-if="myFollowers.length === 0" class="share-empty">
          You don't have any followers yet. Once someone follows you and you accept,
          they'll appear here.
        </div>

        <div v-else>
          <!-- Recently sent strip -->
          <div v-if="recentFollowers.length" class="recent-section">
            <div class="recent-label">Recently sent to</div>
            <div class="recent-strip">
              <button
                v-for="sub in recentFollowers"
                :key="sub.follower_id"
                class="recent-chip"
                :class="{ sent: sentTo.has(sub.follower_id), sending: sendingTo === sub.follower_id }"
                :disabled="sentTo.has(sub.follower_id) || sendingTo === sub.follower_id"
                @click="selectFriend(sub)"
                :title="sub.follower_email"
              >
                <div class="chip-avatar" :style="{ background: avatarBg(sub.follower_email), color: avatarFg(sub.follower_email) }">
                  <CheckIcon v-if="sentTo.has(sub.follower_id)" :size="12" />
                  <span v-else>{{ initials(sub.follower_email) }}</span>
                </div>
                <div class="chip-name">{{ firstName(sub.follower_email) }}</div>
              </button>
            </div>
          </div>

          <!-- Search bar -->
          <div class="search-wrap">
            <SearchIcon :size="13" class="search-icon-inner" />
            <input
              v-model="search"
              class="search-input"
              type="search"
              placeholder="Search friends…"
              autocomplete="off"
              spellcheck="false"
            />
            <button v-if="search" class="search-clear" @click="search = ''"><XIcon :size="11" /></button>
          </div>

          <!-- Scrollable friend list -->
          <div class="follower-list" :class="{ 'follower-list--scroll': filteredFollowers.length > 4 }">
            <div v-if="filteredFollowers.length === 0" class="search-empty">
              No friends match "{{ search }}"
            </div>
            <button
              v-for="sub in filteredFollowers"
              :key="sub.id"
              class="follower-row"
              :class="{ sent: sentTo.has(sub.follower_id), sending: sendingTo === sub.follower_id }"
              :disabled="sentTo.has(sub.follower_id) || sendingTo === sub.follower_id"
              @click="selectFriend(sub)"
            >
              <div class="follower-avatar" :style="{ background: avatarBg(sub.follower_email), color: avatarFg(sub.follower_email) }">
                {{ initials(sub.follower_email) }}
              </div>
              <span class="follower-email">{{ sub.follower_email }}</span>
              <span class="follower-action">
                <CheckIcon v-if="sentTo.has(sub.follower_id)" :size="12" />
                <template v-else-if="sendingTo === sub.follower_id">…</template>
                <template v-else>Send <ArrowRightIcon :size="12" /></template>
              </span>
            </button>
          </div>

          <!-- Compose panel — slides in after selecting a friend -->
          <transition name="compose">
            <div v-if="selectedFriend" class="compose-panel">
              <div class="compose-to">
                <div class="compose-avatar" :style="{ background: avatarBg(selectedFriend.follower_email), color: avatarFg(selectedFriend.follower_email) }">
                  {{ initials(selectedFriend.follower_email) }}
                </div>
                <span class="compose-email">{{ selectedFriend.follower_email }}</span>
                <button class="compose-clear" @click="selectedFriend = null"><XIcon :size="11" /></button>
              </div>
              <textarea
                v-model="message"
                class="share-message"
                placeholder="Add a message (optional)…"
                rows="2"
                maxlength="280"
              ></textarea>
              <button class="btn-send-confirm" @click="doSend(selectedFriend)" :disabled="sendingTo === selectedFriend.follower_id">
                <SendIcon :size="13" />
                {{ sendingTo === selectedFriend.follower_id ? 'Sending…' : 'Send to ' + firstName(selectedFriend.follower_email) }}
              </button>
            </div>
          </transition>
        </div>

        <div v-if="sendError" class="share-tip" style="color:#E24B4A;">{{ sendError }}</div>
      </div>

      <div class="modal-actions" style="margin-top:1.2rem">
        <button class="btn-cancel" @click="$emit('close')">{{ t.close }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  X as XIcon,
  Check as CheckIcon,
  ArrowRight as ArrowRightIcon,
  Link as LinkIcon,
  Send as SendIcon,
  Search as SearchIcon,
} from 'lucide-vue-next'
import { sb } from '../lib/supabase.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { useMessages } from '../composables/useMessages.js'
import { myFollowers, useSubscriptions } from '../composables/useSubscriptions.js'

const RECENT_KEY = 'dram_recent_sends'
const AVATAR_PALETTE = [
  { bg: '#FAEEDA', fg: '#854F0B' },
  { bg: '#E1F5EE', fg: '#0F6E56' },
  { bg: '#EEEDFE', fg: '#3C3489' },
  { bg: '#FAECE7', fg: '#993C1D' },
  { bg: '#E6F1FB', fg: '#0C447C' },
  { bg: '#EAF3DE', fg: '#3B6D11' },
  { bg: '#FBEAF0', fg: '#993556' },
  { bg: '#F1EFE8', fg: '#5F5E5A' },
]

const props = defineProps({ whisky: Object })
defineEmits(['close'])

const { toast } = useToast()
const { t } = useI18n()
const { sendMessage } = useMessages()
const { loadSubscriptions } = useSubscriptions()

const tab            = ref('link')
const shareUrl       = ref('')
const tip            = ref('')
const sentTo         = ref(new Set())
const sendingTo      = ref(null)
const sendError      = ref('')
const message        = ref('')
const search         = ref('')
const selectedFriend = ref(null)

// ── Avatar helpers ──────────────────────────────────────────────
function avatarIndex(email) {
  let hash = 0
  for (const c of (email || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return hash % AVATAR_PALETTE.length
}
function avatarBg(email) { return AVATAR_PALETTE[avatarIndex(email)].bg }
function avatarFg(email) { return AVATAR_PALETTE[avatarIndex(email)].fg }
function initials(email) {
  const [local] = (email || '').split('@')
  const parts = local.split(/[._-]/).filter(Boolean)
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase()
}
function firstName(email) {
  return (email || '').split('@')[0].split(/[._-]/)[0]
}

// ── Recently sent ───────────────────────────────────────────────
function getRecentIds() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function pushRecentId(id) {
  const ids = [id, ...getRecentIds().filter(x => x !== id)].slice(0, 4)
  localStorage.setItem(RECENT_KEY, JSON.stringify(ids))
}

const recentFollowers = computed(() => {
  const ids = getRecentIds()
  return ids
    .map(id => myFollowers.value.find(f => f.follower_id === id))
    .filter(Boolean)
})

// ── Filtered list ───────────────────────────────────────────────
const filteredFollowers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return myFollowers.value
  return myFollowers.value.filter(f =>
    f.follower_email.toLowerCase().includes(q)
  )
})

// ── Lifecycle ───────────────────────────────────────────────────
onMounted(async () => {
  tip.value = t.value.generatingLink
  const { data: existing } = await sb
    .from('shared_whiskies')
    .select('share_id')
    .eq('payload->>id', String(props.whisky.id))
    .maybeSingle()

  let shareId
  if (existing) {
    shareId = existing.share_id
  } else {
    const { data, error } = await sb
      .from('shared_whiskies')
      .insert({ payload: props.whisky })
      .select('share_id')
      .single()
    if (error) { tip.value = t.value.couldNotGenerateLink + error.message; return }
    shareId = data.share_id
  }

  shareUrl.value = window.location.origin + window.location.pathname + '#/share/' + shareId
  tip.value = t.value.linkPublicDram

  await loadSubscriptions()
})

// ── Actions ─────────────────────────────────────────────────────
function copy() {
  navigator.clipboard.writeText(shareUrl.value)
    .then(() => toast(t.value.linkCopied))
    .catch(() => toast(t.value.linkCopied))
}

function selectFriend(sub) {
  if (sentTo.value.has(sub.follower_id)) return
  selectedFriend.value = selectedFriend.value?.follower_id === sub.follower_id ? null : sub
  message.value = ''
  sendError.value = ''
}

async function doSend(sub) {
  sendingTo.value = sub.follower_id
  sendError.value = ''
  try {
    await sendMessage(sub.follower_id, sub.follower_email, props.whisky, message.value)
    sentTo.value = new Set([...sentTo.value, sub.follower_id])
    pushRecentId(sub.follower_id)
    toast(`Sent to ${sub.follower_email}!`)
    selectedFriend.value = null
    message.value = ''
  } catch (err) {
    sendError.value = 'Could not send: ' + err.message
  } finally {
    sendingTo.value = null
  }
}
</script>

<style scoped>
/* ── Tabs ── */
.share-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 0.5px solid var(--border);
}
.share-tab {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  padding: 8px 12px 10px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.share-tab:hover { color: var(--text-primary); }
.share-tab.active { color: var(--amber); border-bottom-color: var(--amber); }
.tab-count {
  background: var(--amber);
  color: #fff;
  font-size: 0.55rem;
  border-radius: 999px;
  padding: 1px 5px;
  line-height: 1.5;
}

/* ── Tab body ── */
.tab-body { min-height: 100px; padding: 16px 20px; }
.share-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  color: var(--peat-light);
  margin-bottom: 1rem;
  line-height: 1.6;
}
.share-empty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.6;
  text-align: center;
  padding: 20px 0;
}

/* ── Recently sent strip ── */
.recent-section { margin-bottom: 14px; }
.recent-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
  margin-bottom: 8px;
}
.recent-strip { display: flex; gap: 10px; }
.recent-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s, transform 0.15s;
}
.recent-chip:hover:not(:disabled) { transform: translateY(-2px); }
.recent-chip.sent { opacity: 0.55; cursor: default; }
.chip-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  font-weight: 600;
  transition: box-shadow 0.15s;
}
.recent-chip:hover:not(:disabled) .chip-avatar { box-shadow: 0 0 0 2px var(--amber); }
.chip-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--text-secondary);
  max-width: 46px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Search ── */
.search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.search-icon-inner {
  position: absolute;
  left: 10px;
  color: var(--peat-light);
  pointer-events: none;
}
.search-input {
  width: 100%;
  background: rgba(200, 130, 42, 0.04);
  border: 0.5px solid var(--border-hi);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  padding: 8px 32px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.search-input:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(200,130,42,0.1); }
.search-input::placeholder { color: var(--peat-light); opacity: 0.8; }
.search-input::-webkit-search-cancel-button { display: none; }
.search-clear {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--peat-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}
.search-clear:hover { color: var(--text-primary); }

/* ── Friend list ── */
.follower-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 10px;
}
.follower-list--scroll {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 2px;
}
.follower-list--scroll::-webkit-scrollbar { width: 3px; }
.follower-list--scroll::-webkit-scrollbar-track { background: transparent; }
.follower-list--scroll::-webkit-scrollbar-thumb { background: var(--border-hi); border-radius: 2px; }

.search-empty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  color: var(--peat-light);
  font-style: italic;
  text-align: center;
  padding: 14px 0;
}

.follower-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(200, 130, 42, 0.05);
  border: 0.5px solid var(--border-hi);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  width: 100%;
  text-align: left;
}
.follower-row:hover:not(:disabled) {
  background: rgba(200, 130, 42, 0.12);
  border-color: var(--amber);
}
.follower-row.sent { opacity: 0.6; cursor: default; }
.follower-row:disabled { cursor: default; }

.follower-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  font-weight: 600;
  flex-shrink: 0;
}
.follower-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.follower-action {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--amber);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.follower-row.sent .follower-action { color: #1D9E75; }

/* ── Compose panel ── */
.compose-panel {
  background: rgba(200, 130, 42, 0.04);
  border: 0.5px solid var(--border-hi);
  border-radius: 10px;
  padding: 12px 14px;
  margin-bottom: 10px;
}
.compose-to {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.compose-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  font-weight: 600;
  flex-shrink: 0;
}
.compose-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  color: var(--text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.compose-clear {
  background: none;
  border: none;
  color: var(--peat-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
  flex-shrink: 0;
}
.compose-clear:hover { color: var(--text-primary); }

.share-message {
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: 0.5px solid var(--border-hi);
  border-radius: 8px;
  padding: 8px 12px;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: var(--text-primary);
  resize: none;
  margin-bottom: 10px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s;
}
.share-message::placeholder { color: var(--peat-light); }
.share-message:focus { border-color: var(--amber); }

.btn-send-confirm {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 14px;
  background: var(--amber);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-send-confirm:hover:not(:disabled) { opacity: 0.88; }
.btn-send-confirm:disabled { opacity: 0.6; cursor: default; }

/* ── Compose transition ── */
.compose-enter-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.compose-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.compose-enter-from, .compose-leave-to { opacity: 0; transform: translateY(-6px); }

/* ── Misc ── */
.share-tip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
  margin-top: 10px;
  text-align: center;
}
</style>
