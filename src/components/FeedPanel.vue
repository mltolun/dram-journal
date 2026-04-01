<template>
  <div class="feed-panel">

    <!-- Loading -->
    <div v-if="feedLoading" class="feed-loading">
      <div class="feed-spinner"></div>
    </div>

    <!-- No follows -->
    <div v-else-if="myFollowing.length === 0" class="feed-empty">
      <div class="feed-empty-icon">👁</div>
      <div class="feed-empty-text">{{ t.feedNoFollows }}</div>
      <div class="feed-empty-sub">{{ t.feedNoFollowsSub }}</div>
    </div>

    <!-- Has follows but no activity -->
    <div v-else-if="feedItems.length === 0" class="feed-empty">
      <div class="feed-empty-icon">🥃</div>
      <div class="feed-empty-text">{{ t.feedNoActivity }}</div>
      <button class="feed-refresh-btn" @click="loadFeed">{{ t.feedRefresh }}</button>
    </div>

    <!-- Feed list -->
    <template v-else>
      <div class="feed-list">
        <div v-for="item in feedItems" :key="item.id" class="feed-item">

          <!-- Bottle thumbnail -->
          <div class="feed-thumb">
            <img v-if="item.photo_url" :src="item.photo_url" :alt="item.whisky_name" class="feed-thumb-img">
            <div v-else class="feed-thumb-ph">🥃</div>
          </div>

          <div class="feed-body">
            <div class="feed-action">
              <span class="feed-user">{{ displayName(item.user_id) }}</span>
              <span class="feed-verb">{{ verbFor(item.type) }}</span>
              <span class="feed-whisky">{{ item.whisky_name }}</span>
              <span v-if="item.whisky_distillery" class="feed-distillery"> · {{ item.whisky_distillery }}</span>
            </div>
            <div v-if="item.rating" class="feed-rating">
              <span v-for="n in 5" :key="n" class="feed-star" :class="{ filled: n <= item.rating }">★</span>
            </div>
            <div v-if="item.nose" class="feed-tasting"><span class="feed-tasting-label">{{ t.nose }}</span> {{ item.nose }}</div>
            <div v-if="item.palate" class="feed-tasting"><span class="feed-tasting-label">{{ t.palate }}</span> {{ item.palate }}</div>
            <div v-if="item.notes" class="feed-tasting"><span class="feed-tasting-label">{{ t.notes }}</span> {{ item.notes }}</div>
            <div class="feed-time">{{ relativeTime(item.created_at) }}</div>
          </div>
        </div>
      </div>
      <div class="feed-footer">
        <button class="feed-refresh-btn" @click="loadFeed">{{ t.feedRefresh }}</button>
      </div>
    </template>

  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useFeed } from '../composables/useFeed.js'
import { myFollowing } from '../composables/useSubscriptions.js'
import { useI18n } from '../composables/useI18n.js'

const { feedItems, feedLoading, displayNames, loadFeed } = useFeed()
const { t } = useI18n()

function displayName(userId) {
  return displayNames.value.get(userId) || userId.slice(0, 8)
}

function verbFor(type) {
  if (type === 'rating') return t.value.feedRated
  return t.value.feedLogged // journal_add and anything else
}

function relativeTime(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return t.value.feedJustNow
  if (hours < 1)  return t.value.feedMinutesAgo(mins)
  if (days < 1)   return t.value.feedHoursAgo(hours)
  return t.value.feedDaysAgo(days)
}

onMounted(loadFeed)
</script>

<style scoped>
.feed-panel {
  padding: 20px 16px;
  max-width: 640px;
  margin: 0 auto;
  min-height: 200px;
}

/* ── Loading ── */
.feed-loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.feed-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border, rgba(200, 130, 42, 0.2));
  border-top-color: var(--amber, #A8620A);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

/* ── Empty states ── */
.feed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
}

.feed-empty-icon {
  font-size: 2rem;
  margin-bottom: 4px;
  opacity: 0.6;
}

.feed-empty-text {
  font-family: 'Inter', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary, #C0A882);
}

.feed-empty-sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  color: var(--peat-light, #8A7060);
  line-height: 1.5;
}

/* ── Feed list ── */
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.feed-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 0.5px solid var(--border, rgba(200, 130, 42, 0.1));
}

.feed-item:first-child {
  border-top: 0.5px solid var(--border, rgba(200, 130, 42, 0.1));
}

/* ── Bottle thumbnail ── */
.feed-thumb {
  flex-shrink: 0;
  width: 44px;
  height: 54px;
  border-radius: 8px;
  background: rgba(200, 130, 42, 0.07);
  border: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.feed-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  padding: 2px;
}

.feed-thumb-ph {
  font-size: 1.3rem;
  opacity: 0.45;
}

/* ── Body ── */
.feed-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feed-action {
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  line-height: 1.4;
  color: var(--text-secondary, #C0A882);
  flex-wrap: wrap;
}

.feed-user {
  font-weight: 600;
  color: var(--text-primary, #F8F4EE);
  margin-right: 4px;
}

.feed-verb {
  color: var(--peat-light, #8A7060);
  margin-right: 4px;
}

.feed-whisky {
  color: var(--amber-light, #E8A84C);
  font-weight: 500;
}

.feed-distillery {
  color: var(--peat-light, #8A7060);
  font-size: 0.78rem;
}

/* ── Rating ── */
.feed-rating {
  display: flex;
  gap: 1px;
}

.feed-star {
  font-size: 0.7rem;
  color: var(--border, rgba(200, 130, 42, 0.2));
}

.feed-star.filled {
  color: var(--amber, #A8620A);
}

/* ── Tasting notes ── */
.feed-tasting {
  font-family: 'Inter', sans-serif;
  font-size: 0.76rem;
  color: var(--text-secondary, #C0A882);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-tasting-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--peat-light, #8A7060);
  margin-right: 4px;
}

/* ── Timestamp ── */
.feed-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light, #8A7060);
  letter-spacing: 0.04em;
}

/* ── Footer ── */
.feed-footer {
  display: flex;
  justify-content: center;
  padding: 16px 0 4px;
}

.feed-refresh-btn {
  background: transparent;
  border: 0.5px solid var(--border-hi, rgba(200, 130, 42, 0.3));
  color: var(--peat-light, #8A7060);
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}

.feed-refresh-btn:hover {
  color: var(--amber-light, #E8A84C);
  border-color: var(--amber, #A8620A);
}
</style>
