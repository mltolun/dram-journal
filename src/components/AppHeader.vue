<template>
  <header>
    <div class="header-top">
      <div class="header-brand">
        <div class="brand-title">The <span>Dram</span> Journal</div>
        <div class="brand-sub">{{ t.brandSub }}</div>
      </div>
      <div class="header-right">
        <button class="btn-theme" @click="cycleTheme" :title="`Theme: ${theme}`">{{ themeIcon }}</button>

        <div class="avatar-wrap" ref="avatarWrap">
          <div class="user-avatar" :title="currentUser?.email" @click="menuOpen = !menuOpen" :class="{ active: menuOpen }">
            <span class="avatar-letter">{{ avatarLetter }}</span>
            <span class="avatar-sync-dot" :style="{ background: syncColor }"></span>
          </div>

          <transition name="menu">
            <div class="avatar-menu" v-if="menuOpen">
              <div class="avatar-menu-email">{{ currentUser?.email }}</div>
              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item" @click="doExport">
                <span class="menu-item-icon">↓</span> {{ t.exportCsv }}
              </button>
              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item" @click="openSubscriptions">
                <span class="menu-item-icon">👁</span> Friends &amp; Followers
                <span v-if="pendingRequests.length" class="menu-badge">{{ pendingRequests.length }}</span>
              </button>
              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item" @click="doToggleLocale">
                <span class="menu-item-icon">🌐</span> {{ locale === 'en' ? 'Español' : 'English' }}
              </button>
              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item avatar-menu-item--danger" @click="doSignOut">
                <span class="menu-item-icon">↪</span> {{ t.signOut }}
              </button>
            </div>
          </transition>
        </div>

      </div>
    </div>
  </header>

  <SubscriptionsPanel v-if="subsOpen" @close="subsOpen = false" />
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { whiskies, syncStatus } from '../composables/useWhiskies.js'
import { useTheme } from '../composables/useTheme.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { exportCSV } from '../utils/csv.js'
import { useSubscriptions, pendingRequests } from '../composables/useSubscriptions.js'
import SubscriptionsPanel from './SubscriptionsPanel.vue'

const { signOut } = useAuth()
const { theme, cycleTheme } = useTheme()
const { toast } = useToast()
const { locale, t, toggleLocale } = useI18n()
const { loadSubscriptions } = useSubscriptions()

const menuOpen = ref(false)
const avatarWrap = ref(null)
const subsOpen = ref(false)

const avatarLetter = computed(() =>
  (currentUser.value?.email?.[0] ?? '?').toUpperCase()
)

const themeIcon = computed(() => ({
  whisky: '🥃',
  dark: '🌑',
  light: '☀️'
})[theme.value] || '🥃')

const syncColor = computed(() => ({
  loading: '#7A6255', saving: '#E8A84C', ok: '#1D9E75', error: '#E24B4A'
})[syncStatus.value] || '#1D9E75')

function onClickOutside(e) {
  if (avatarWrap.value && !avatarWrap.value.contains(e.target)) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
  loadSubscriptions()
})
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside, true))

function openSubscriptions() {
  menuOpen.value = false
  subsOpen.value = true
}

function doExport() {
  menuOpen.value = false
  if (whiskies.value.length === 0) { toast(t.value.nothingToExport); return }
  exportCSV(whiskies.value)
  toast(t.value.csvExported)
}

function doToggleLocale() {
  toggleLocale()
  // keep menu open so user sees the change
}

async function doSignOut() {
  menuOpen.value = false
  await signOut()
}
</script>

<style scoped>
.btn-theme {
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 5px;
  font-size: 0.85rem;
  padding: 2px 6px;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1.6;
  color: var(--text-primary);
}
.btn-theme:hover {
  border-color: var(--amber);
  transform: scale(1.1);
}

/* Avatar */
.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}
.user-avatar {
  position: relative;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(200, 130, 42, 0.15);
  border: 0.5px solid var(--border-hi);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.user-avatar:hover,
.user-avatar.active {
  background: rgba(200, 130, 42, 0.28);
  border-color: var(--amber);
}
.avatar-letter {
  font-family: 'DM Mono', monospace;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--amber-light);
  line-height: 1;
  user-select: none;
}
.avatar-sync-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--bg);
  transition: background 0.3s;
}

/* Dropdown menu */
.avatar-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  z-index: 500;
  transform-origin: top right;
}
.avatar-menu-email {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  padding: 10px 14px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avatar-menu-divider {
  height: 0.5px;
  background: var(--border);
  margin: 0;
}
.avatar-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
}
.avatar-menu-item:hover {
  background: rgba(200, 130, 42, 0.08);
  color: var(--text-primary);
}
.avatar-menu-item--danger:hover {
  background: rgba(226, 75, 74, 0.1);
  color: #e08888;
}
.menu-item-icon {
  font-size: 0.75rem;
  opacity: 0.7;
}
.menu-badge {
  margin-left: auto;
  background: var(--amber, #A8620A);
  color: #fff;
  font-size: 0.55rem;
  font-weight: 600;
  border-radius: 999px;
  padding: 1px 6px;
  line-height: 1.5;
}

/* Transition */
.menu-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.menu-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
