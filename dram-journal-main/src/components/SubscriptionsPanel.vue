<template>
  <div class="subs-overlay" @click.self="$emit('close')">
    <div class="subs-panel">

      <div class="subs-header">
        <div class="subs-title">Friends &amp; Followers</div>
        <button class="subs-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Follow by email -->
      <div class="subs-section">
        <div class="subs-section-label">✦ Follow someone</div>
        <div class="follow-form">
          <input
            v-model="emailInput"
            type="email"
            placeholder="Enter their email address…"
            class="follow-input"
            @keydown.enter="doFollow"
            :disabled="following"
          />
          <button class="follow-btn" @click="doFollow" :disabled="following || !emailInput.trim()">
            {{ following ? '…' : 'Send request' }}
          </button>
        </div>
        <div v-if="followError" class="follow-error">{{ followError }}</div>
        <div v-if="followSuccess" class="follow-success">{{ followSuccess }}</div>
      </div>

      <!-- Pending requests (people wanting to follow me) -->
      <div class="subs-section" v-if="pendingRequests.length">
        <div class="subs-section-label">⏳ Pending requests</div>
        <div class="sub-row" v-for="req in pendingRequests" :key="req.id">
          <span class="sub-email">{{ req.follower_email || req.follower_id.slice(0, 8) + '…' }}</span>
          <div class="sub-actions">
            <button class="sub-btn sub-btn--accept" @click="doAccept(req.id, req.follower_email)">Accept</button>
            <button class="sub-btn sub-btn--remove" @click="doRemove(req.id)">Decline</button>
          </div>
        </div>
      </div>

      <!-- People I follow -->
      <div class="subs-section">
        <div class="subs-section-label">👁 Following ({{ myFollowing.length }})</div>
        <div v-if="myFollowing.length === 0" class="sub-empty">Not following anyone yet.</div>
        <div class="sub-row" v-for="sub in myFollowing" :key="sub.id">
          <span class="sub-email">{{ sub.following_email || sub.following_id.slice(0, 8) + '…' }}</span>
          <button class="sub-btn sub-btn--remove" @click="doRemove(sub.id)">Unfollow</button>
        </div>
      </div>

      <!-- My followers -->
      <div class="subs-section">
        <div class="subs-section-label">🥃 Followers ({{ myFollowers.length }})</div>
        <div v-if="myFollowers.length === 0" class="sub-empty">No followers yet.</div>
        <div class="sub-row" v-for="sub in myFollowers" :key="sub.id">
          <span class="sub-email">{{ sub.follower_email || sub.follower_id.slice(0, 8) + '…' }}</span>
          <button class="sub-btn sub-btn--remove" @click="doRemove(sub.id)">Remove</button>
        </div>
      </div>

      <div class="subs-footer">
        Followers receive a weekly digest of your new journal entries and ratings.
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { ref } from 'vue'
import {
  useSubscriptions,
  pendingRequests,
  myFollowing,
  myFollowers,
} from '../composables/useSubscriptions.js'

defineEmits(['close'])

const { loadSubscriptions, requestFollowByEmail, acceptRequest, removeSubscription } = useSubscriptions()

const emailInput    = ref('')
const following     = ref(false)
const followError   = ref('')
const followSuccess = ref('')

onMounted(async () => {
  await loadSubscriptions()
})

async function doFollow() {
  const email = emailInput.value.trim()
  if (!email) return
  following.value = true
  followError.value = ''
  followSuccess.value = ''
  try {
    await requestFollowByEmail(email)
    followSuccess.value = `Follow request sent to ${email}!`
    emailInput.value = ''
  } catch (err) {
    followError.value = err.message
  } finally {
    following.value = false
  }
}

async function doAccept(id, requesterEmail) {
  await acceptRequest(id, requesterEmail)
}

async function doRemove(id) {
  await removeSubscription(id)
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
  font-family: 'Inter', sans-serif; font-weight: 600; letter-spacing: -0.01em;
  font-size: 1.15rem;
  color: var(--text-primary, #F8F4EE);
}

.subs-close {
  background: none;
  border: none;
  color: var(--peat-light, #8A7060);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}
.subs-close:hover { color: var(--text-primary); }

.subs-section {
  padding: 18px 24px;
  border-bottom: 0.5px solid var(--border, rgba(200,130,42,0.12));
}

.subs-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber, #A8620A);
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
  background: var(--amber, #A8620A);
  color: var(--peat, #F8F4EE);
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

.follow-error   { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: #E24B4A; margin-top: 8px; }
.follow-success { font-family: 'JetBrains Mono', monospace; font-size: 0.65rem; color: #1D9E75; margin-top: 8px; }

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
.sub-btn--accept { border-color: #1D9E75; color: #1D9E75; }
.sub-btn--accept:hover { background: rgba(29,158,117,0.1); }
.sub-btn--remove { border-color: rgba(226,75,74,0.5); color: #E24B4A; }
.sub-btn--remove:hover { background: rgba(226,75,74,0.1); }

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
