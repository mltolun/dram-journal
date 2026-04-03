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

      <!-- Send to follower tab -->
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
          <textarea
            v-model="message"
            class="share-message"
            placeholder="Add a message (optional)…"
            rows="2"
            maxlength="280"
          ></textarea>

          <div class="follower-list">
          <button
            v-for="sub in myFollowers"
            :key="sub.id"
            class="follower-row"
            :class="{ sent: sentTo.has(sub.follower_id), sending: sendingTo === sub.follower_id }"
            :disabled="sentTo.has(sub.follower_id) || sendingTo === sub.follower_id"
            @click="doSend(sub)"
          >
            <span class="follower-email">{{ sub.follower_email }}</span>
            <span class="follower-action">
              <CheckIcon v-if="sentTo.has(sub.follower_id)" :size="12" /> <template v-else-if="sendingTo === sub.follower_id">…</template> <template v-else>Send <ArrowRightIcon :size="12" /></template>
            </span>
          </button>
          </div>
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
import { ref, onMounted } from 'vue'
import { X as XIcon, Check as CheckIcon, ArrowRight as ArrowRightIcon, Link as LinkIcon, Send as SendIcon } from 'lucide-vue-next'
import { sb } from '../lib/supabase.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { useMessages } from '../composables/useMessages.js'
import { myFollowers, useSubscriptions } from '../composables/useSubscriptions.js'

const props = defineProps({ whisky: Object })
defineEmits(['close'])

const { toast } = useToast()
const { t } = useI18n()
const { sendMessage } = useMessages()
const { loadSubscriptions } = useSubscriptions()

const tab       = ref('link')
const shareUrl  = ref('')
const tip       = ref('')
const sentTo    = ref(new Set())
const sendingTo = ref(null)
const sendError = ref('')
const message   = ref('')

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

function copy() {
  navigator.clipboard.writeText(shareUrl.value)
    .then(() => toast(t.value.linkCopied))
    .catch(() => toast(t.value.linkCopied))
}

async function doSend(sub) {
  sendingTo.value = sub.follower_id
  sendError.value = ''
  try {
    await sendMessage(sub.follower_id, sub.follower_email, props.whisky, message.value)
    sentTo.value = new Set([...sentTo.value, sub.follower_id])
    toast(`Sent to ${sub.follower_email}!`)
  } catch (err) {
    sendError.value = 'Could not send: ' + err.message
  } finally {
    sendingTo.value = null
  }
}
</script>

<style scoped>
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
.share-tab.active {
  color: var(--amber);
  border-bottom-color: var(--amber);
}

.tab-count {
  background: var(--amber);
  color: #fff;
  font-size: 0.55rem;
  border-radius: 999px;
  padding: 1px 5px;
  line-height: 1.5;
}

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

.share-message {
  width: 100%;
  box-sizing: border-box;
  background: rgba(200, 130, 42, 0.04);
  border: 0.5px solid var(--border-hi);
  border-radius: 8px;
  padding: 10px 14px;
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  color: var(--text-primary);
  resize: none;
  margin-bottom: 12px;
  line-height: 1.5;
  outline: none;
  transition: border-color 0.15s;
}
.share-message::placeholder { color: var(--peat-light); }
.share-message:focus { border-color: var(--amber); }

.follower-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.follower-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
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

.follower-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.follower-action {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  color: var(--amber);
  flex-shrink: 0;
  margin-left: 12px;
}
.follower-row.sent .follower-action { color: #1D9E75; }

.share-tip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
  margin-top: 10px;
  text-align: center;
}
</style>