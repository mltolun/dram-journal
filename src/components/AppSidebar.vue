<template>
  <aside class="app-sidebar" role="navigation" aria-label="Main navigation">

    <!-- ── Quick Stats ─────────────────────────────────────────────────────── -->
    <div class="sidebar-quick-stats">
      <div class="sidebar-section-label">{{ t.quickStats }}</div>

      <div class="qs-row">
        <span class="qs-icon" aria-hidden="true">🥃</span>
        <span class="qs-label">{{ t.totalDrams }}</span>
        <span class="qs-value">{{ journal.length }}</span>
      </div>

      <div class="qs-row">
        <span class="qs-icon" aria-hidden="true">🏅</span>
        <span class="qs-label">{{ t.statsBadges }}</span>
        <span class="qs-value">{{ earnedCount }}/{{ badges.length }}</span>
      </div>

      <!-- Next-badge progress -->
      <template v-if="nextBadge && earnedCount < badges.length">
        <div class="qs-next-label">
          <span>{{ nextBadge.icon }} {{ nextBadge.name }}</span>
          <span class="qs-next-pct">{{ nextBadgePct }}%</span>
        </div>
        <div class="qs-track" role="progressbar" :aria-valuenow="nextBadgePct" aria-valuemin="0" aria-valuemax="100">
          <div class="qs-fill" :style="{ width: nextBadgePct + '%' }"></div>
        </div>
      </template>
      <div v-else-if="earnedCount === badges.length" class="qs-complete">
        ✦ All badges earned
      </div>
    </div>

    <div class="sidebar-divider"></div>

    <!-- ── Navigation ──────────────────────────────────────────────────────── -->
    <nav class="sidebar-nav">
      <button
        class="sidebar-nav-item"
        :class="{ active: activeList === 'journal' }"
        @click="$emit('setList', 'journal')"
        aria-label="Journal"
      >
        <BookOpenIcon :size="15" aria-hidden="true" />
        <span class="sidebar-nav-label">{{ t.journal }}</span>
      </button>

      <button
        class="sidebar-nav-item"
        :class="{ active: activeList === 'wishlist' }"
        @click="$emit('setList', 'wishlist')"
        aria-label="Wishlist"
      >
        <HeartIcon :size="15" aria-hidden="true" />
        <span class="sidebar-nav-label">{{ t.wishlist }}</span>
      </button>

      <button
        class="sidebar-nav-item"
        :class="{ active: activeList === 'timeline' }"
        @click="$emit('setList', 'timeline')"
        aria-label="Timeline"
      >
        <CalendarIcon :size="15" aria-hidden="true" />
        <span class="sidebar-nav-label">Timeline</span>
      </button>

      <button
        class="sidebar-nav-item"
        :class="{ active: activeList === 'feed' }"
        @click="$emit('setList', 'feed')"
        aria-label="Community feed"
      >
        <UsersIcon :size="15" aria-hidden="true" />
        <span class="sidebar-nav-label">{{ t.feed }}</span>
      </button>
    </nav>

    <div class="sidebar-divider sidebar-divider--desktop-only"></div>

    <!-- ── Panel Links (desktop only) ─────────────────────────────────────── -->
    <div class="sidebar-panel-links">
      <button class="sidebar-panel-item" @click="statsOpen = true" :aria-label="t.statsAndBadges">
        <BarChart2Icon :size="14" aria-hidden="true" />
        <span>{{ t.statsAndBadges }}</span>
      </button>

      <button class="sidebar-panel-item" @click="subsOpen = true" :aria-label="t.friendsFollowers">
        <UserPlusIcon :size="14" aria-hidden="true" />
        <span>{{ t.friendsFollowers }}</span>
        <span v-if="pendingRequests.length" class="sidebar-badge" aria-label="pending requests">{{ pendingRequests.length }}</span>
      </button>

      <button class="sidebar-panel-item" @click="featureOpen = true" :aria-label="t.featureRequests">
        <LightbulbIcon :size="14" aria-hidden="true" />
        <span>{{ t.featureRequests }}</span>
      </button>
    </div>

  </aside>

  <!-- ── Panels ────────────────────────────────────────────────────────────── -->
  <StatsPanel v-if="statsOpen" @close="statsOpen = false" />
  <SubscriptionsPanel v-if="subsOpen" @close="subsOpen = false" />
  <FeatureRequestPanel v-if="featureOpen" @close="featureOpen = false" />
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  BookOpen as BookOpenIcon,
  Heart as HeartIcon,
  Calendar as CalendarIcon,
  Users as UsersIcon,
  BarChart2 as BarChart2Icon,
  UserPlus as UserPlusIcon,
  Lightbulb as LightbulbIcon,
} from 'lucide-vue-next'

import { useI18n } from '../composables/useI18n.js'
import { useBadges } from '../composables/useBadges.js'
import { journal } from '../composables/useWhiskies.js'
import { pendingRequests } from '../composables/useSubscriptions.js'
import StatsPanel from './StatsPanel.vue'
import SubscriptionsPanel from './SubscriptionsPanel.vue'
import FeatureRequestPanel from './FeatureRequestPanel.vue'

defineProps({ activeList: String })
defineEmits(['setList'])

const { t } = useI18n()
const { badges, earnedCount } = useBadges()

const statsOpen   = ref(false)
const subsOpen    = ref(false)
const featureOpen = ref(false)

// First unearned badge with the most progress
const nextBadge = computed(() =>
  badges.value
    .filter(b => !b.earned)
    .sort((a, b) => (b.current / b.target) - (a.current / a.target))[0] ?? null
)

const nextBadgePct = computed(() => {
  if (!nextBadge.value) return 0
  return Math.min(100, Math.round((nextBadge.value.current / nextBadge.value.target) * 100))
})
</script>

<style scoped>
.app-sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--bg);
  border-right: 0.5px solid var(--border);
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 20px 0 24px;
  flex-shrink: 0;
  transition: background 0.25s;
}

/* ── Section label ── */
.sidebar-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.56rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--peat-light);
  padding: 0 18px;
  margin-bottom: 10px;
  opacity: 0.7;
}

/* ── Quick Stats ── */
.sidebar-quick-stats {
  padding: 4px 0 12px;
}

.qs-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 18px;
}
.qs-icon { font-size: 0.9rem; line-height: 1; flex-shrink: 0; }
.qs-label {
  font-size: 0.72rem;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  flex: 1;
}
.qs-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--amber-light);
}

.qs-next-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 18px 4px;
  font-size: 0.68rem;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
}
.qs-next-pct {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  color: var(--amber);
  margin-left: 6px;
  flex-shrink: 0;
}
.qs-track {
  height: 3px;
  background: var(--bg-bar-track);
  border-radius: 2px;
  margin: 2px 18px 4px;
  overflow: hidden;
}
.qs-fill {
  height: 100%;
  background: var(--amber);
  border-radius: 2px;
  transition: width 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}
.qs-complete {
  padding: 6px 18px;
  font-size: 0.65rem;
  color: var(--amber-light);
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.04em;
}

/* ── Divider ── */
.sidebar-divider {
  height: 0.5px;
  background: var(--border);
  margin: 8px 0;
  flex-shrink: 0;
}

/* ── Nav ── */
.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 10px;
}
.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  width: 100%;
}
.sidebar-nav-item svg { flex-shrink: 0; opacity: 0.7; transition: opacity 0.15s; }
.sidebar-nav-item:hover {
  background: rgba(200, 130, 42, 0.07);
  color: var(--text-primary);
}
.sidebar-nav-item:hover svg { opacity: 1; }
.sidebar-nav-item.active {
  background: rgba(200, 130, 42, 0.12);
  color: var(--amber-light);
  font-weight: 600;
}
.sidebar-nav-item.active svg { opacity: 1; color: var(--amber); }

/* ── Panel links ── */
.sidebar-panel-links {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px 10px;
}
.sidebar-panel-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 12px;
  border-radius: 7px;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  font-size: 0.76rem;
  font-weight: 400;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  text-align: left;
  width: 100%;
}
.sidebar-panel-item svg { flex-shrink: 0; opacity: 0.6; transition: opacity 0.15s; }
.sidebar-panel-item:hover {
  background: rgba(200, 130, 42, 0.07);
  color: var(--text-primary);
}
.sidebar-panel-item:hover svg { opacity: 0.9; }
.sidebar-badge {
  margin-left: auto;
  background: var(--amber);
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.52rem;
  font-weight: 700;
  border-radius: 999px;
  padding: 1px 6px;
  line-height: 1.5;
  flex-shrink: 0;
}

/* ── Mobile: bottom tab bar ─────────────────────────────────────────────── */
@media (max-width: 768px) {
  .app-sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    min-width: unset;
    height: auto;
    flex-direction: row;
    padding: 0;
    border-right: none;
    border-top: 0.5px solid var(--border);
    z-index: 200;
    background: var(--bg-modal);
    backdrop-filter: blur(12px);
    overflow: visible;
    /* Respect iOS safe area */
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sidebar-quick-stats,
  .sidebar-divider,
  .sidebar-panel-links,
  .sidebar-divider--desktop-only { display: none; }
  .sidebar-nav {
    flex-direction: row;
    flex: 1;
    gap: 0;
    padding: 0;
  }
  .sidebar-nav-item {
    flex: 1;
    flex-direction: column;
    gap: 3px;
    padding: 10px 4px;
    border-radius: 0;
    font-size: 0.58rem;
    justify-content: center;
    align-items: center;
  }
  .sidebar-nav-item svg { opacity: 0.6; }
  .sidebar-nav-item.active {
    background: transparent;
    color: var(--amber-light);
  }
  .sidebar-nav-item.active svg { color: var(--amber); opacity: 1; }
  .sidebar-nav-item:hover { background: transparent; }
  .sidebar-nav-label { display: block; }
}
</style>
