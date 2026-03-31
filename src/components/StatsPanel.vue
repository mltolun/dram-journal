<template>
  <div class="stats-overlay" @click.self="$emit('close')">
    <div class="stats-panel">

      <div class="stats-header">
        <div class="stats-title">My Dram Stats</div>
        <button class="stats-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Summary row -->
      <div class="summary-row">
        <div class="summary-stat">
          <div class="summary-num">{{ journal.length }}</div>
          <div class="summary-lbl">Drams</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-stat">
          <div class="summary-num">{{ passport.length }}</div>
          <div class="summary-lbl">Countries</div>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-stat">
          <div class="summary-num">{{ earnedCount }}<span class="summary-denom">/{{ badges.length }}</span></div>
          <div class="summary-lbl">Badges</div>
        </div>
      </div>

      <!-- Achievements -->
      <div class="stats-section">
        <div class="stats-section-label">✦ Achievements</div>
        <div class="badge-grid">
          <div
            v-for="b in badges"
            :key="b.id"
            class="badge-card"
            :class="{ 'badge-card--earned': b.earned }"
          >
            <div class="badge-icon">{{ b.icon }}</div>
            <div class="badge-body">
              <div class="badge-name">{{ b.name }}</div>
              <div class="badge-desc">{{ b.desc }}</div>
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
              <div v-else class="badge-earned-label">Earned</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Regional Passport -->
      <div class="stats-section" v-if="passport.length">
        <div class="stats-section-label">🌍 Regional Passport</div>
        <div class="passport-list">
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

      <div class="stats-footer">Keep exploring — more badges unlock as you taste!</div>
    </div>
  </div>
</template>

<script setup>
import { journal } from '../composables/useWhiskies.js'
import { useBadges } from '../composables/useBadges.js'

defineEmits(['close'])

const { badges, earnedCount, passport } = useBadges()
</script>

<style scoped>
.stats-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(20, 12, 4, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.stats-panel {
  background: var(--bg-modal, #1e1408);
  border: 0.5px solid var(--border-hi, rgba(200, 130, 42, 0.35));
  border-radius: 16px;
  width: 100%;
  max-width: 520px;
  max-height: 88vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
}

.stats-title {
  font-family: 'Inter', sans-serif;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-size: 1.15rem;
  color: var(--text-primary, #F8F4EE);
}

.stats-close {
  background: none;
  border: none;
  color: var(--peat-light, #8A7060);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  transition: color 0.15s;
}
.stats-close:hover { color: var(--text-primary); }

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
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 1px;
  filter: grayscale(0);
}

.badge-card:not(.badge-card--earned) .badge-icon {
  filter: grayscale(1);
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
