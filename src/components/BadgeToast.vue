<template>
  <Teleport to="body">
    <Transition name="badge-toast">
      <div v-if="badgeToastVisible && badgeToastData" class="badge-toast">
        <div class="badge-toast-label">Badge Unlocked</div>
        <div class="badge-toast-icon"><component :is="BADGE_ICON_MAP[badgeToastData.icon]" :size="38" /></div>
        <div class="badge-toast-name">{{ badgeToastData.name }}</div>
        <div class="badge-toast-desc">{{ badgeToastData.desc }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useBadgeToast } from '../composables/useBadgeToast.js'
import { GlassWater, Hash, Trophy, Globe, Flame, Star, FlaskConical, Users } from 'lucide-vue-next'

const BADGE_ICON_MAP = { GlassWater, Hash, Trophy, Globe, Flame, Star, FlaskConical, Users }

const { badgeToastData, badgeToastVisible } = useBadgeToast()
</script>

<style scoped>
.badge-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  translate: -50% 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 18px 28px 16px;
  background: var(--bg-modal, #1e1408);
  border: 1px solid var(--amber, #A8620A);
  border-radius: 14px;
  box-shadow: 0 0 0 1px rgba(200, 130, 42, 0.15), 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(168, 98, 10, 0.2);
  min-width: 200px;
  text-align: center;
  pointer-events: none;
}

.badge-toast-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber, #A8620A);
  margin-bottom: 6px;
}

.badge-toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--amber, #A8620A);
  margin-bottom: 6px;
}

.badge-toast-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary, #F8F4EE);
  letter-spacing: -0.01em;
}

.badge-toast-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light, #8A7060);
  line-height: 1.4;
  max-width: 180px;
}

/* Transition */
.badge-toast-enter-active { transition: opacity 0.3s ease, translate 0.3s ease; }
.badge-toast-leave-active { transition: opacity 0.25s ease, translate 0.25s ease; }
.badge-toast-enter-from   { opacity: 0; translate: -50% -12px; }
.badge-toast-leave-to     { opacity: 0; translate: -50% -8px; }
</style>
