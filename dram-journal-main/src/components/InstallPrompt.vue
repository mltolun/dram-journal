<template>
  <Teleport to="body">
    <Transition name="install-prompt">
      <div v-if="show" class="install-prompt" :class="{ 'install-prompt--ios': isIos }">
        <div class="install-prompt-content">
          <div class="install-prompt-icon">🥃</div>
          <div class="install-prompt-text">
            <div class="install-prompt-title">Install The Dram Journal</div>
            <div class="install-prompt-desc">
              <!-- iOS: manual share sheet instructions -->
              <template v-if="isIos">
                Tap <span class="install-share-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                </span> then <strong>Add to Home Screen</strong>
              </template>
              <!-- Android: one-tap native install -->
              <template v-else>
                Add to your home screen for the full app experience
              </template>
            </div>
          </div>

          <!-- Android: native install button -->
          <button v-if="!isIos" class="install-prompt-btn" @click="triggerAndroidInstall">
            Install
          </button>

          <button class="install-prompt-close" @click="dismiss">✕</button>
        </div>
        <!-- iOS only: arrow pointing to Safari share button -->
        <div v-if="isIos" class="install-prompt-arrow">▼</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const show = ref(false)
const isIos = ref(false)
const DISMISSED_KEY = 'dram-install-prompt-dismissed'

// Holds the deferred Android beforeinstallprompt event
let deferredPrompt = null

function onBeforeInstallPrompt(e) {
  // Prevent the browser's mini-infobar from showing immediately
  e.preventDefault()
  deferredPrompt = e
  showPromptIfEligible()
}

function showPromptIfEligible() {
  const dismissedAt = localStorage.getItem(DISMISSED_KEY)
  const cooldownPassed =
    !dismissedAt || Date.now() - Number(dismissedAt) > 7 * 24 * 60 * 60 * 1000

  if (cooldownPassed) {
    setTimeout(() => { show.value = true }, 2000)
  }
}

onMounted(() => {
  const ua = window.navigator.userAgent.toLowerCase()
  const isIosDevice = /iphone|ipad|ipod/.test(ua)
  const isStandalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  // Already installed — never show
  if (isStandalone) return

  if (isIosDevice) {
    isIos.value = true
    showPromptIfEligible()
  } else {
    // Android / Chrome: wait for the browser's deferred prompt event
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
})

async function triggerAndroidInstall() {
  if (!deferredPrompt) return
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  // Dismiss the banner regardless of the user's choice
  show.value = false
  if (outcome === 'accepted') {
    // Accepted — set a long cooldown so it won't reappear
    localStorage.setItem(DISMISSED_KEY, Date.now())
  }
}

function dismiss() {
  show.value = false
  localStorage.setItem(DISMISSED_KEY, Date.now())
}
</script>

<style scoped>
.install-prompt {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 9000;
  padding: 0 12px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.install-prompt-content {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-modal, #2a1e0e);
  border: 0.5px solid var(--border-hi, rgba(200,130,42,0.4));
  border-radius: 14px;
  padding: 14px 16px;
  width: 100%;
  max-width: 460px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}

.install-prompt-icon {
  font-size: 2rem;
  flex-shrink: 0;
  line-height: 1;
}

.install-prompt-text { flex: 1; }

.install-prompt-title {
  font-family: 'Inter', sans-serif; font-weight: 600; letter-spacing: -0.01em;
  font-size: 0.95rem;
  color: var(--text-primary, #F8F4EE);
  margin-bottom: 3px;
}

.install-prompt-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light, #8A7060);
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.install-prompt-desc strong { color: var(--amber-light, #C07820); }

.install-share-icon {
  display: inline-flex;
  align-items: center;
  color: var(--amber-light, #C07820);
  vertical-align: middle;
  margin: 0 2px;
}

/* Android install button */
.install-prompt-btn {
  flex-shrink: 0;
  background: var(--amber, #A8620A);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 7px 14px;
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.install-prompt-btn:hover {
  background: var(--amber-light, #C07820);
  transform: scale(1.03);
}
.install-prompt-btn:active {
  transform: scale(0.97);
}

.install-prompt-close {
  background: none;
  border: none;
  color: var(--peat-light, #8A7060);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.install-prompt-close:hover { color: var(--text-primary); }

/* iOS-only bottom arrow pointing at Safari's share button */
.install-prompt-arrow {
  font-size: 1.2rem;
  color: var(--amber, #A8620A);
  margin-top: -4px;
  line-height: 1;
}

/* Slide-up / slide-down transitions */
.install-prompt-enter-active { transition: transform 0.35s ease, opacity 0.35s ease; }
.install-prompt-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.install-prompt-enter-from,
.install-prompt-leave-to { transform: translateY(100%); opacity: 0; }
</style>
