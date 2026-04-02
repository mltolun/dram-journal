<template>
  <div class="stats-overlay" @click.self="$emit('close')">
    <div class="stats-panel">

      <div class="stats-header">
        <button class="stats-close" @click="$emit('close')" aria-label="Back">
          <ArrowLeftIcon :size="14" /> Back
        </button>
        <div class="stats-title">{{ t.statsTitle }}</div>
      </div>

      <!-- Summary row -->
      <div class="summary-row">
        <div class="summary-stat">
          <div class="summary-num">{{ journal.length }}</div>
          <div class="summary-lbl">{{ t.statsDrams }}</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-stat">
          <div class="summary-num">{{ passport.length }}</div>
          <div class="summary-lbl">{{ t.statsCountries }}</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-stat">
          <div class="summary-num">{{ earnedCount }}<span class="summary-denom">/{{ badges.length }}</span></div>
          <div class="summary-lbl">{{ t.statsBadges }}</div>
        </div>
      </div>

      <!-- Achievements -->
      <div class="stats-section">
        <div class="stats-section-label">{{ t.statsAchievements }}</div>
        <div class="badge-grid">
          <div
            v-for="b in badges"
            :key="b.id"
            class="badge-card"
            :class="{ 'badge-card--earned': b.earned }"
          >
            <div class="badge-icon"><component :is="BADGE_ICON_MAP[b.icon]" :size="28" /></div>
            <div class="badge-body">
              <div class="badge-name">{{ t.badges[b.id]?.name ?? b.name }}</div>
              <div class="badge-desc">{{ t.badges[b.id]?.desc ?? b.desc }}</div>
              <template v-if="!b.earned">
                <div class="badge-progress">
                  <div class="badge-progress-track">
                    <div
                      class="badge-progress-fill"
                      :style="{ width: (b.current / b.target * 100) + '%' }"
                    ></div>
                  </div>
                  <div class="badge-progress-text">{{ b.current }}/{{ b.target }}</div>
                </div>
              </template>
              <div v-else class="badge-earned-label">{{ t.statsEarned }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Flavour Profile Wheel -->
      <div class="stats-section">
        <div class="stats-section-label">{{ t.statsFlavorWheel }}</div>
        <div v-if="flavorProfile" class="flavor-wheel-wrap">
          <FlavorWheel :profile="flavorProfile" />
          <div class="flavor-wheel-sub">{{ t.statsFlavorWheelSub }} · {{ flavorProfile.count }}</div>
        </div>
        <div v-else class="flavor-empty">{{ t.statsNotEnoughData }}</div>
      </div>

      <!-- Regional Passport -->
      <div class="stats-section" v-if="passport.length">
        <div class="stats-section-label"><MapIcon :size="11" style="display:inline;vertical-align:middle;margin-right:5px;" />{{ t.statsPassport }}</div>

        <!-- Continent summary headline -->
        <div v-if="continentPassport.length > 1" class="passport-headline">
          {{ t.statsContinentHeadline(passport.length, continentPassport.length) }}
        </div>

        <!-- Continent groups -->
        <div v-if="continentPassport.length > 1" class="continent-groups">
          <div v-for="group in continentPassport" :key="group.continent" class="continent-group">
            <div class="continent-label">{{ continentLabel(group.continent) }}</div>
            <div class="passport-list">
              <div v-for="p in group.countries" :key="p.country" class="passport-row">
                <div class="passport-country">{{ p.country }}</div>
                <div class="passport-bar-wrap">
                  <div class="passport-bar" :style="{ width: (p.count / passport[0].count * 100) + '%' }"></div>
                </div>
                <div class="passport-count">{{ p.count }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Flat list fallback (single continent or ungrouped) -->
        <div v-else class="passport-list">
          <div v-for="p in passport" :key="p.country" class="passport-row">
            <div class="passport-country">{{ p.country }}</div>
            <div class="passport-bar-wrap">
              <div
                class="passport-bar"
                :style="{ width: (p.count / passport[0].count * 100) + '%' }"
              ></div>
            </div>
            <div class="passport-count">{{ p.count }}</div>
          </div>
        </div>
      </div>

      <div class="stats-footer">{{ t.statsFooter }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  ArrowLeft as ArrowLeftIcon,
  Map as MapIcon,
  GlassWater, Hash, Trophy, Globe, Flame, Star, FlaskConical, Users,
} from 'lucide-vue-next'

const BADGE_ICON_MAP = { GlassWater, Hash, Trophy, Globe, Flame, Star, FlaskConical, Users }
import { journal } from '../composables/useWhiskies.js'
import { useBadges } from '../composables/useBadges.js'
import { useI18n } from '../composables/useI18n.js'
import FlavorWheel from './FlavorWheel.vue'

defineEmits(['close'])

const { badges, earnedCount, passport, flavorProfile, continentPassport } = useBadges()
const { t } = useI18n()

const CONTINENT_KEY_MAP = {
  'British Isles': 'statsContinentBritishIsles',
  'Europe':        'statsContinentEurope',
  'Americas':      'statsContinentAmericas',
  'Asia':          'statsContinentAsia',
  'Rest of World': 'statsContinentRestOfWorld',
}

function continentLabel(continent) {
  const key = CONTINENT_KEY_MAP[continent]
  return key ? t.value[key] : continent
}
</script>

<style scoped>
.stats-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: var(--bg-modal, #1e1408);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.stats-panel {
  background: var(--bg-modal, #1e1408);
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  border-radius: 0;
  border: none;
}

/* Centre content on wide screens */
.stats-panel > * {
  max-width: 680px;
  width: 100%;
  align-self: center;
  box-sizing: border-box;
}

/* ── Header ── */
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
  position: sticky;
  top: 0;
  background: var(--bg-modal, #1e1408);
  z-index: 1;
}

.stats-title {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-size: 1rem;
  color: var(--text-primary, #F8F4EE);
}

.stats-close {
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
.stats-close:hover { color: var(--text-primary); background: rgba(200,130,42,0.07); }

/* ── Summary row ── */
.summary-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 20px 24px;
  border-bottom: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
}

.summary-stat {
  flex: 1;
  text-align: center;
}

.summary-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--amber-light, #E8A84C);
  line-height: 1;
  margin-bottom: 4px;
}

.summary-denom {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--peat-light, #8A7060);
}

.summary-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--peat-light, #8A7060);
}

.summary-divider {
  width: 0.5px;
  height: 36px;
  background: var(--border, rgba(200, 130, 42, 0.15));
  flex-shrink: 0;
}

/* ── Sections ── */
.stats-section {
  padding: 20px 24px;
  border-bottom: 0.5px solid var(--border, rgba(200, 130, 42, 0.12));
}

.stats-section-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber, #A8620A);
  margin-bottom: 14px;
}

/* ── Badge grid ── */
.badge-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.badge-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 0.5px solid var(--border, rgba(200, 130, 42, 0.1));
  border-radius: 10px;
  opacity: 0.45;
  transition: opacity 0.2s;
}

.badge-card--earned {
  opacity: 1;
  background: rgba(200, 130, 42, 0.08);
  border-color: var(--border-hi, rgba(200, 130, 42, 0.3));
}

.badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--amber, #A8620A);
  opacity: 1;
}

.badge-card:not(.badge-card--earned) .badge-icon {
  color: var(--peat-light, #8A7060);
}

.badge-body {
  flex: 1;
  min-width: 0;
}

.badge-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary, #F8F4EE);
  margin-bottom: 2px;
}

.badge-desc {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  color: var(--peat-light, #8A7060);
  margin-bottom: 6px;
  line-height: 1.4;
}

.badge-earned-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #1D9E75;
}

/* Progress bar */
.badge-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.badge-progress-track {
  flex: 1;
  height: 3px;
  background: var(--border, rgba(200, 130, 42, 0.15));
  border-radius: 99px;
  overflow: hidden;
}

.badge-progress-fill {
  height: 100%;
  background: var(--amber, #A8620A);
  border-radius: 99px;
  transition: width 0.4s ease;
  min-width: 2px;
}

.badge-progress-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Passport ── */
.passport-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.passport-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.passport-country {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  color: var(--text-secondary, #C0A882);
  width: 110px;
  flex-shrink: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.passport-bar-wrap {
  flex: 1;
  height: 5px;
  background: var(--border, rgba(200, 130, 42, 0.12));
  border-radius: 99px;
  overflow: hidden;
}

.passport-bar {
  height: 100%;
  background: var(--amber, #A8620A);
  border-radius: 99px;
  min-width: 4px;
  transition: width 0.4s ease;
}

.passport-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--amber-light, #E8A84C);
  width: 24px;
  text-align: right;
  flex-shrink: 0;
}

/* ── Flavour Wheel ── */
.flavor-wheel-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.flavor-wheel-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light, #8A7060);
  text-align: center;
  font-style: italic;
}

.flavor-empty {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light, #8A7060);
  font-style: italic;
  line-height: 1.5;
}

/* ── Passport enhancements ── */
.passport-headline {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #C0A882);
  margin-bottom: 14px;
}

.continent-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.continent-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.continent-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--amber, #A8620A);
  margin-bottom: 4px;
}

/* ── Footer ── */
.stats-footer {
  padding: 16px 24px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light);
  line-height: 1.5;
  text-align: center;
  font-style: italic;
}
</style>
