<template>
  <header :style="headerStyle">
    <div class="header-top">

      <!-- Brand -->
      <div class="header-brand">
        <div class="brand-title">The <span>Dram</span> Journal</div>
        <div class="brand-sub">{{ t.brandSub }}</div>
      </div>

      <!-- Search bar -->
      <div class="header-search">
        <SearchIcon :size="14" class="search-icon" aria-hidden="true" />
        <input
          class="search-input"
          type="search"
          :placeholder="t.searchPlaceholder"
          v-model="searchQuery"
          aria-label="Search journal entries"
          autocomplete="off"
          spellcheck="false"
        />
      </div>

      <!-- Right: Inbox + Avatar -->
      <div class="header-right">

        <!-- Inbox button -->
        <button class="btn-inbox" @click="inboxOpen = true" :aria-label="t.inbox">
          <InboxIcon :size="16" aria-hidden="true" />
          <span>{{ t.inbox }}</span>
          <span v-if="totalInboxCount" class="inbox-dot-badge" aria-label="unread messages">{{ totalInboxCount }}</span>
        </button>

        <!-- Avatar + dropdown -->
        <div class="avatar-wrap" ref="avatarWrap">
          <div
            class="user-avatar"
            :title="currentUser?.email"
            @click="menuOpen = !menuOpen"
            :class="{ active: menuOpen }"
            role="button"
            :aria-expanded="menuOpen"
            aria-label="User menu"
          >
            <span class="avatar-letter">{{ avatarLetter }}</span>
            <span class="avatar-sync-dot" :style="{ background: syncColor }"></span>
            <span v-if="earnedCount > 0" class="avatar-badge-count">{{ earnedCount }}/{{ badges.length }}</span>
          </div>

          <transition name="menu">
            <div class="avatar-menu" v-if="menuOpen" role="menu">
              <div class="avatar-menu-email">{{ currentUser?.email }}</div>

              <!-- Theme picker -->
              <div class="avatar-menu-divider"></div>
              <div class="theme-row">
                <span class="theme-row-label">Theme</span>
                <div class="theme-options">
                  <button
                    v-for="th in THEMES"
                    :key="th"
                    class="theme-option"
                    :class="{ active: theme === th }"
                    @click="setTheme(th)"
                    :title="th"
                    role="menuitemradio"
                    :aria-checked="theme === th"
                  >
                    <span class="theme-option-icon"><SunIcon v-if="th === 'light'" :size="14" /><MoonIcon v-else :size="14" /></span>
                    <span class="theme-option-label">{{ th }}</span>
                  </button>
                </div>
              </div>

              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item" @click="doExport" role="menuitem">
                <DownloadIcon :size="14" aria-hidden="true" /> {{ t.exportCsv }}
              </button>
              <template v-if="isAdmin">
                <div class="avatar-menu-divider"></div>
                <button class="avatar-menu-item avatar-menu-item--admin" @click="openAdminPanel" role="menuitem">
                  <SettingsIcon :size="14" aria-hidden="true" /> {{ t.adminRequests }}
                  <span v-if="openRequestCount" class="menu-badge">{{ openRequestCount }}</span>
                </button>
              </template>
              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item" @click="doToggleLocale" role="menuitem">
                <GlobeIcon :size="14" aria-hidden="true" /> {{ locale === 'en' ? 'Español' : 'English' }}
              </button>
              <div class="avatar-menu-divider"></div>
              <button class="avatar-menu-item avatar-menu-item--danger" @click="doSignOut" role="menuitem">
                <LogOutIcon :size="14" aria-hidden="true" /> {{ t.signOut }}
              </button>
            </div>
          </transition>
        </div>

      </div>
    </div>
  </header>

  <InboxPanel v-if="inboxOpen" @close="inboxOpen = false" />
  <AdminFeaturePanel v-if="adminOpen" @close="adminOpen = false" />
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { whiskies, syncStatus } from '../composables/useWhiskies.js'
import { useTheme } from '../composables/useTheme.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { exportCSV } from '../utils/csv.js'
import { sb } from '../lib/supabase.js'
import { useSubscriptions } from '../composables/useSubscriptions.js'
import { useMessages } from '../composables/useMessages.js'
import { unreadCount } from '../composables/useMessages.js'
import { pendingRequests } from '../composables/useSubscriptions.js'
import InboxPanel from './InboxPanel.vue'
import AdminFeaturePanel from './AdminFeaturePanel.vue'
import { useFeatureRequests, featureRequests } from '../composables/useFeatureRequests.js'
import { useBadges } from '../composables/useBadges.js'
import { searchQuery } from '../composables/useSearch.js'
import {
  Inbox as InboxIcon,
  Download as DownloadIcon,
  Settings as SettingsIcon,
  Globe as GlobeIcon,
  LogOut as LogOutIcon,
  Sun as SunIcon,
  Moon as MoonIcon,
  Search as SearchIcon,
} from 'lucide-vue-next'

const { signOut } = useAuth()
const { theme, THEMES } = useTheme()
const { toast } = useToast()
const { locale, t, toggleLocale } = useI18n()
const { loadSubscriptions } = useSubscriptions()
const { loadInbox } = useMessages()

const menuOpen   = ref(false)
const avatarWrap = ref(null)
const inboxOpen  = ref(false)
const adminOpen  = ref(false)

const { isAdmin: isAdminFn } = useFeatureRequests()
const { earnedCount, badges } = useBadges()

const isAdmin = computed(() => isAdminFn())

const openRequestCount = computed(() =>
  featureRequests.value.filter(r => r.status === 'open').length
)

const totalInboxCount = computed(() =>
  unreadCount.value + pendingRequests.value.length
)

const safeAreaTop  = ref(0)
const isStandalone = ref(false)

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
  loadSubscriptions()
  loadInbox()

  isStandalone.value = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches

  if (isStandalone.value) {
    safeAreaTop.value = 44
  }
})
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside, true))

const headerStyle = computed(() => ({
  paddingTop: safeAreaTop.value > 0 ? `calc(${safeAreaTop.value}px + 1.4rem)` : undefined
}))

const avatarLetter = computed(() =>
  (currentUser.value?.email?.[0] ?? '?').toUpperCase()
)

const syncColor = computed(() => ({
  loading: '#7A6255', saving: '#E8A84C', ok: '#1D9E75', error: '#E24B4A'
})[syncStatus.value] || '#1D9E75')

function onClickOutside(e) {
  if (avatarWrap.value && !avatarWrap.value.contains(e.target)) {
    menuOpen.value = false
  }
}

function setTheme(t) {
  theme.value = t
}

function openAdminPanel() {
  menuOpen.value = false
  adminOpen.value = true
}

function doExport() {
  menuOpen.value = false
  if (whiskies.value.length === 0) { toast(t.value.nothingToExport); return }
  exportCSV(whiskies.value)
  toast(t.value.csvExported)
}

async function doToggleLocale() {
  toggleLocale()
  await sb.auth.updateUser({ data: { locale: locale.value } })
}

async function doSignOut() {
  menuOpen.value = false
  await signOut()
}
</script>

<style scoped>
/* ── Search bar ── */
.header-search {
  flex: 1;
  max-width: 400px;
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 16px;
}
.search-icon {
  position: absolute;
  left: 10px;
  color: var(--peat-light);
  pointer-events: none;
  flex-shrink: 0;
}
.search-input {
  width: 100%;
  background: var(--bg-input);
  border: 0.5px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  padding: 7px 11px 7px 32px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  /* allow up to 30% wider text for i18n */
  min-width: 0;
}
.search-input:focus {
  border-color: var(--amber);
  box-shadow: 0 0 0 3px rgba(200, 130, 42, 0.1);
}
.search-input::placeholder { color: var(--peat-light); opacity: 0.8; }
/* hide browser's native clear button */
.search-input::-webkit-search-cancel-button { display: none; }

/* ── Avatar ── */
.avatar-wrap { position: relative; flex-shrink: 0; }
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
.user-avatar:hover, .user-avatar.active {
  background: rgba(200, 130, 42, 0.28);
  border-color: var(--amber);
}
.avatar-letter {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--amber-light);
  line-height: 1;
  user-select: none;
}
.avatar-sync-dot {
  position: absolute;
  bottom: 1px; right: 1px;
  width: 9px; height: 9px;
  border-radius: 50%;
  border: 1.5px solid var(--bg);
  transition: background 0.3s;
}
.avatar-badge-count {
  position: absolute;
  top: -5px; left: -5px;
  background: var(--bg-modal, #1e1408);
  border: 0.5px solid var(--amber, #A8620A);
  color: var(--amber-light, #E8A84C);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.44rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 4px;
  line-height: 1.5;
  white-space: nowrap;
  pointer-events: none;
}

/* ── Dropdown menu ── */
.avatar-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  overflow: hidden;
  z-index: 500;
  transform-origin: top right;
}
.avatar-menu-email {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  padding: 10px 14px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.avatar-menu-divider { height: 0.5px; background: var(--border); margin: 0; }

/* Theme picker */
.theme-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  gap: 10px;
}
.theme-row-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.theme-options { display: flex; gap: 5px; }
.theme-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 5px 8px;
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.theme-option:hover { border-color: var(--amber); background: rgba(200,130,42,0.08); }
.theme-option.active { border-color: var(--amber); background: rgba(200,130,42,0.15); }
.theme-option-icon { font-size: 0.9rem; }
.theme-option-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.46rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--peat-light);
}
.theme-option.active .theme-option-label { color: var(--amber-light); }

/* Menu items */
.avatar-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: none;
  border: none;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
}
.avatar-menu-item:hover { background: rgba(200,130,42,0.08); color: var(--text-primary); }
.avatar-menu-item--danger:hover { background: rgba(226,75,74,0.1); color: #e08888; }
.avatar-menu-item--admin:hover { background: rgba(200,130,42,0.1); color: var(--amber-light); }
.avatar-menu-item svg { opacity: 0.7; flex-shrink: 0; }
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

/* Inbox button */
.btn-inbox {
  position: relative;
  background: none;
  border: 0.5px solid var(--border);
  border-radius: 7px;
  padding: 5px 10px;
  cursor: pointer;
  transition: all 0.18s;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: 'Inter', sans-serif;
}
.btn-inbox:hover { border-color: var(--border-hi); color: var(--text-primary); }
.inbox-dot-badge {
  position: absolute;
  top: -4px; right: -4px;
  background: var(--amber);
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.5rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 4px;
  line-height: 1.4;
  min-width: 14px;
  text-align: center;
}

/* Transition */
.menu-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.menu-leave-active { transition: opacity 0.1s ease, transform 0.1s ease; }
.menu-enter-from, .menu-leave-to { opacity: 0; transform: scale(0.95) translateY(-4px); }

/* ── Responsive ── */
@media (max-width: 680px) {
  .header-search { max-width: none; margin: 0 8px; }
  .btn-inbox span { display: none; }
}
@media (max-width: 480px) {
  .header-search { display: none; }
}
</style>
