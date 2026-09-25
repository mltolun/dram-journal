<template>
  <div class="subs-overlay" ref="rootEl" role="dialog" aria-modal="true" :aria-label="t.friendsFollowers" @click.self="$emit('close')">
    <div class="subs-panel">

      <div class="subs-header">
        <button class="subs-close" :aria-label="t.close" @click="$emit('close')">
          <ArrowLeftIcon :size="14" aria-hidden="true" /> {{ t.back }}
        </button>
        <div class="subs-title">{{ t.friendsFollowers }}</div>
      </div>

      <!-- Follow by email -->
      <div class="subs-section">
        <div class="subs-section-label"><SparklesIcon :size="11" class="subs-section-icon" /> {{ t.followSomeone }}</div>
        <div class="follow-form">
          <input
            id="follow-email"
            v-model="emailInput"
            type="email"
            :placeholder="t.followEmailPlaceholder"
            :aria-label="t.followEmailPlaceholder"
            autocomplete="email"
            class="follow-input"
            @keydown.enter="doFollow"
            :disabled="following"
          />
          <button class="follow-btn" @click="doFollow" :disabled="following || !emailInput.trim()" :aria-busy="following">
            {{ following ? t.sending : t.sendRequest }}
          </button>
        </div>
        <div v-if="followError" class="follow-error" role="alert">{{ followError }}</div>
        <div v-if="followSuccess" class="follow-success" role="status">{{ followSuccess }}</div>
      </div>

      <!-- Pending requests (people wanting to follow me) -->
      <div class="subs-section" v-if="pendingRequests.length">
        <div class="subs-section-label"><ClockIcon :size="12" /> {{ t.pendingRequests }}</div>
        <div class="sub-row" v-for="req in pendingRequests" :key="req.id">
          <span class="sub-email">{{ req.follower_email || req.follower_id.slice(0, 8) + '…' }}</span>
          <div class="sub-actions">
            <button class="sub-btn sub-btn--accept" :disabled="actioning === req.id" @click="doAccept(req.id, req.follower_email)">{{ actioning === req.id ? t.processing : t.accept }}</button>
            <button class="sub-btn sub-btn--remove" :disabled="actioning === req.id" @click="doDecline(req.id)">{{ t.decline }}</button>
          </div>
        </div>
      </div>

      <!-- People I follow -->
      <div class="subs-section">
        <div class="subs-section-label"><EyeIcon :size="11" class="subs-section-icon" /> {{ t.followingTitle(myFollowing.length) }}</div>
        <div v-if="myFollowing.length === 0" class="sub-empty">{{ t.notFollowingAnyone }}</div>
        <div class="sub-row" v-for="sub in myFollowing" :key="sub.id">
          <span class="sub-email">{{ sub.following_email || sub.following_id.slice(0, 8) + '…' }}</span>
          <button class="sub-btn sub-btn--remove" @click="confirmRemove(sub.id, 'unfollow')">{{ t.unfollow }}</button>
        </div>
      </div>

      <!-- My followers -->
      <div class="subs-section">
        <div class="subs-section-label"><UsersIcon :size="11" class="subs-section-icon" /> {{ t.followersTitle(myFollowers.length) }}</div>
        <div v-if="myFollowers.length === 0" class="sub-empty">{{ t.noFollowers }}</div>
        <div class="sub-row" v-for="sub in myFollowers" :key="sub.id">
          <span class="sub-email">{{ sub.follower_email || sub.follower_id.slice(0, 8) + '…' }}</span>
          <button class="sub-btn sub-btn--remove" @click="confirmRemove(sub.id, 'remove')">{{ t.remove }}</button>
        </div>
      </div>

      <div class="subs-footer">
        {{ t.digestDisclosure }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { ref } from 'vue'
import { GlassWater as GlassWaterIcon, Users as UsersIcon, Sparkles as SparklesIcon,
  ArrowLeft as ArrowLeftIcon, Eye as EyeIcon, Clock as ClockIcon } from 'lucide-vue-next'
import {
  useSubscriptions,
  pendingRequests,
  myFollowing,
  myFollowers,
} from '../composables/useSubscriptions.js'
import { useI18n } from '../composables/useI18n.js'
import { useDialog } from '../composables/useDialog.js'
import { useToast } from '../composables/useToast.js'

const emit = defineEmits(['close'])

const { loadSubscriptions, requestFollowByEmail, acceptRequest, removeSubscription } = useSubscriptions()
const { t } = useI18n()
const { toast } = useToast()

const rootEl = ref(null)
useDialog(rootEl, { onClose: () => emit('close') })

const emailInput    = ref('')
const following     = ref(false)
const followError   = ref('')
const followSuccess = ref('')
const actioning     = ref(null)
let successTimer    = null

onMounted(async () => {
  await loadSubscriptions()
})

onBeforeUnmount(() => {
  if (successTimer) clearTimeout(successTimer)
})

function flashSuccess(msg) {
  followSuccess.value = msg
  if (successTimer) clearTimeout(successTimer)
  successTimer = setTimeout(() => { followSuccess.value = '' }, 6000)
}

async function doFollow() {
  const email = emailInput.value.trim()
  if (!email) return
  following.value = true
  followError.value = ''
  followSuccess.value = ''
  try {
    await requestFollowByEmail(email)
    flashSuccess(t.value.followRequestSent(email))
    emailInput.value = ''
  } catch (err) {
    console.error('requestFollowByEmail failed:', err)
    if (err?.message === 'SELF') followError.value = t.value.cannotFollowSelf
    else if (err?.message === 'DUPLICATE') followError.value = t.value.alreadyRequested
    else followError.value = t.value.followRequestFailed
  } finally {
    following.value = false
  }
}

async function doAccept(id, requesterEmail) {
  actioning.value = id
  try {
    await acceptRequest(id, requesterEmail)
    toast(t.value.requestAccepted(requesterEmail))
  } catch (e) {
    console.error('acceptRequest failed:', e)
    toast('⚠ ' + t.value.actionFailed)
  } finally {
    actioning.value = null
  }
}

async function doDecline(id) {
  if (!window.confirm(t.value.confirmDecline)) return
  actioning.value = id
  try {
    await removeSubscription(id)
    toast(t.value.requestDeclined)
  } catch (e) {
    console.error('decline request failed:', e)
    toast('⚠ ' + t.value.actionFailed)
  } finally {
    actioning.value = null
  }
}

async function confirmRemove(id, kind) {
  if (!window.confirm(kind === 'unfollow' ? t.value.confirmUnfollow : t.value.confirmRemoveFollower)) return
  try {
    await removeSubscription(id)
    toast(t.value.removed)
  } catch (e) {
    console.error('removeSubscription failed:', e)
    toast('⚠ ' + t.value.actionFailed)
  }
}
</script>

<style scoped>
.subs-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
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
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* Centre content on wide screens */
.subs-panel > * {
  max-width: 680px;
  width: 100%;
  align-self: center;
  box-sizing: border-box;
}

.subs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.15));
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

.subs-section {
  padding: 18px 24px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.12));
}

.subs-section-icon { display:inline; vertical-align:middle; margin-right:4px; }
.subs-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber);
  margin-bottom: 12px;
}

/* Follow form */
.follow-form {
  display: flex;
  gap: 8px;
}

.follow-input {
  flex: 1;
  background: rgba(250,245,236,0.05);
  border: 0.5px solid var(--border-hi, rgba(200,130,42,0.3));
  border-radius: 8px;
  padding: 9px 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-primary, #F8F4EE);
  outline: none;
  transition: border-color 0.2s;
}
.follow-input:focus { border-color: var(--amber); }
.follow-input::placeholder { color: var(--peat-light); }

.follow-btn {
  background: var(--amber);
  color: var(--on-amber);
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}
.follow-btn:disabled { opacity: 0.5; cursor: default; }
.follow-btn:not(:disabled):hover { opacity: 0.85; }

.follow-error   { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: var(--danger); margin-top: 8px; }
.follow-success { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: var(--success); margin-top: 8px; }

/* Rows */
.sub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.08));
}
.sub-row:last-child { border-bottom: none; }

.sub-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.72rem;
  color: var(--text-secondary, #C0A882);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-empty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  color: var(--peat-light);
  font-style: italic;
}

.sub-actions { display: flex; gap: 6px; flex-shrink: 0; }

.sub-btn {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 0.5px solid;
  border-radius: 6px;
  padding: 5px 10px;
  cursor: pointer;
  transition: opacity 0.15s;
  white-space: nowrap;
  background: none;
}
.sub-btn--accept { border-color: var(--success); color: var(--success-soft); }
.sub-btn--accept:hover { background: rgba(29,158,117,0.1); }
.sub-btn--remove { border-color: var(--danger); color: var(--danger); }
.sub-btn--remove:hover { background: var(--danger-soft); }

.subs-footer {
  padding: 16px 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light);
  line-height: 1.5;
  text-align: center;
  font-style: italic;
}
</style>
