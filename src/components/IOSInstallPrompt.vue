<template>
  <Teleport to="body">
    <Transition name="ios-prompt">
      <div v-if="show" class="ios-prompt">
        <div class="ios-prompt-content">
          <div class="ios-prompt-icon">🥃</div>
          <div class="ios-prompt-text">
            <div class="ios-prompt-title">Install The Dram Journal</div>
            <div class="ios-prompt-desc">
              Tap <span class="ios-share-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
              </span> then <strong>Add to Home Screen</strong>
            </div>
          </div>
          <button class="ios-prompt-close" @click="dismiss">✕</button>
        </div>
        <div class="ios-prompt-arrow">▼</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const show = ref(false)
const DISMISSED_KEY = 'dram-ios-prompt-dismissed'

onMounted(() => {
  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase())
  const isStandalone = window.navigator.standalone === true
  const dismissedAt = localStorage.getItem(DISMISSED_KEY)

  // Don't show again within 7 days of dismissal
  const cooldownPassed = !dismissedAt || (Date.now() - Number(dismissedAt)) > 7 * 24 * 60 * 60 * 1000

  if (isIos && !isStandalone && cooldownPassed) {
    setTimeout(() => { show.value = true }, 2000)
  }
})

function dismiss() {
  show.value = false
  localStorage.setItem(DISMISSED_KEY, Date.now())
}
</script>

<style scoped>
.ios-prompt {
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

.ios-prompt-content {
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

.ios-prompt-icon {
  font-size: 2rem;
  flex-shrink: 0;
  line-height: 1;
}

.ios-prompt-text { flex: 1; }

.ios-prompt-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 0.95rem;
  color: var(--text-primary, #F8F4EE);
  margin-bottom: 3px;
}

.ios-prompt-desc {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light, #8A7060);
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.ios-prompt-desc strong { color: var(--amber-light, #C07820); }

.ios-share-icon {
  display: inline-flex;
  align-items: center;
  color: var(--amber-light, #C07820);
  vertical-align: middle;
  margin: 0 2px;
}

.ios-prompt-close {
  background: none;
  border: none;
  color: var(--peat-light, #8A7060);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
  transition: color 0.15s;
}
.ios-prompt-close:hover { color: var(--text-primary); }

.ios-prompt-arrow {
  font-size: 1.2rem;
  color: var(--amber, #A8620A);
  margin-top: -4px;
  line-height: 1;
}

.ios-prompt-enter-active { transition: transform 0.35s ease, opacity 0.35s ease; }
.ios-prompt-leave-active { transition: transform 0.25s ease, opacity 0.25s ease; }
.ios-prompt-enter-from,
.ios-prompt-leave-to { transform: translateY(100%); opacity: 0; }
</style>
