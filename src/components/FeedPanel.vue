<template>
  <div class="feed-panel">

    <!-- Loading -->
    <div v-if="feedLoading" class="feed-loading">
      <div class="feed-spinner"></div>
    </div>

    <!-- No follows and no editorial content -->
    <div v-else-if="feedItems.length === 0 && myFollowing.length === 0" class="feed-empty">
      <div class="feed-empty-icon"><EyeIcon :size="40" /></div>
      <div class="feed-empty-text">{{ t.feedNoFollows }}</div>
      <div class="feed-empty-sub">{{ t.feedNoFollowsSub }}</div>
    </div>

    <!-- Has follows but no activity at all -->
    <div v-else-if="feedItems.length === 0" class="feed-empty">
      <div class="feed-empty-icon"><GlassWaterIcon :size="40" /></div>
      <div class="feed-empty-text">{{ t.feedNoActivity }}</div>
      <button class="feed-refresh-btn" @click="loadFeed">{{ t.feedRefresh }}</button>
    </div>

    <!-- Has items but search filtered them all out -->
    <div v-else-if="filteredFeed.length === 0" class="feed-empty">
      <div class="feed-empty-icon"><GlassWaterIcon :size="40" /></div>
      <div class="feed-empty-text">No results for "{{ searchQuery }}"</div>
    </div>

    <!-- Feed list: mixed social + editorial, newest first -->
    <template v-else>
      <div class="feed-list">

        <!-- Hint bar when user has no follows but editorial exists -->
        <div v-if="myFollowing.length === 0" class="feed-follow-hint">
          <EyeIcon :size="12" />
          <span>{{ t.feedNoFollowsSub }}</span>
        </div>

        <template v-for="item in filteredFeed" :key="item.id">

          <!-- ── Editorial card ── -->
          <div v-if="item.source === 'editorial'" class="feed-editorial" :class="`feed-editorial--${item.type}`">
            <div class="feed-editorial-icon">
              <TrophyIcon    v-if="item.type === 'award'"        :size="14" />
              <CalendarIcon  v-else-if="item.type === 'event'"   :size="14" />
              <MegaphoneIcon v-else-if="item.type === 'announcement'" :size="14" />
              <NewsIcon      v-else                              :size="14" />
            </div>
            <div class="feed-editorial-body">
              <div class="feed-editorial-meta">
                <span class="feed-editorial-type">{{ t[`editorialType_${item.type}`] }}</span>
                <span v-if="item.source_name" class="feed-editorial-source">{{ item.source_name }}</span>
                <span class="feed-time">{{ relativeTime(item.created_at) }}</span>
              </div>
              <div class="feed-editorial-title">
                <a v-if="item.source_url" :href="item.source_url" target="_blank" rel="noopener" class="feed-editorial-link">{{ item.title }}</a>
                <span v-else>{{ item.title }}</span>
              </div>
              <div v-if="item.body" class="feed-editorial-desc">{{ item.body }}</div>
              <div v-if="item.type === 'event' && (item.event_date || item.location)" class="feed-editorial-event-info">
                <span v-if="item.event_date">{{ formatDate(item.event_date) }}</span>
                <span v-if="item.event_date && item.location"> · </span>
                <span v-if="item.location">{{ item.location }}</span>
              </div>
            </div>
          </div>

          <!-- ── Social activity card ── -->
          <div v-else class="feed-item">
            <!-- Left: bottle image -->
            <div class="feed-card-img">
              <img v-if="item.photo_url" :src="item.photo_url" :alt="item.whisky_name" class="feed-card-img-el">
              <div v-else class="feed-card-img-ph"><GlassWaterIcon :size="32" /></div>
            </div>
            <!-- Right: content -->
            <div class="feed-card-body">
              <!-- User row -->
              <div class="feed-card-user-row">
                <div class="feed-card-avatar">{{ displayName(item.user_id)[0].toUpperCase() }}</div>
                <div class="feed-card-user-info">
                  <span class="feed-card-username">{{ displayName(item.user_id) }}</span>
                  <span class="feed-card-time">{{ relativeTime(item.created_at) }}</span>
                </div>
                <div v-if="item.rating" class="feed-card-rating">
                  <StarIcon :size="11" class="feed-card-rating-star" />
                  <span class="feed-card-rating-val">{{ item.rating }}.0</span>
                </div>
              </div>
              <!-- Whisky name + distillery -->
              <div class="feed-card-whisky-name">{{ item.whisky_name }}</div>
              <div v-if="item.whisky_distillery" class="feed-card-whisky-sub">{{ item.whisky_distillery }}</div>
              <!-- Quote: notes or palate -->
              <div v-if="item.notes || item.palate || item.nose" class="feed-card-quote">
                "{{ item.notes || item.palate || item.nose }}"
              </div>
              <!-- Flavor tags -->
              <div v-if="flavorTags(item).length" class="feed-card-tags">
                <span v-for="tag in flavorTags(item)" :key="tag" class="feed-card-tag">{{ tag }}</span>
              </div>
            </div>
          </div>

        </template>
      </div>
      <div class="feed-footer">
        <button class="feed-refresh-btn" @click="loadFeed">{{ t.feedRefresh }}</button>
      </div>
    </template>

  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { GlassWater as GlassWaterIcon, Eye as EyeIcon, Star as StarIcon, Newspaper as NewsIcon, Calendar as CalendarIcon, Trophy as TrophyIcon, Megaphone as MegaphoneIcon } from 'lucide-vue-next'
import { useFeed } from '../composables/useFeed.js'
import { myFollowing } from '../composables/useSubscriptions.js'
import { useI18n } from '../composables/useI18n.js'
import { searchQuery } from '../composables/useSearch.js'

const { feedItems, feedLoading, displayNames, loadFeed } = useFeed()
const { t, locale } = useI18n()

function displayName(userId) {
  return displayNames.value.get(userId) || userId.slice(0, 8)
}

// Flat filtered feed — social + editorial interleaved, newest first
const filteredFeed = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return feedItems.value
  return feedItems.value.filter(item => {
    if (item.source === 'editorial') {
      return (
        item.title?.toLowerCase().includes(q) ||
        item.body?.toLowerCase().includes(q) ||
        item.source_name?.toLowerCase().includes(q) ||
        item.type?.toLowerCase().includes(q)
      )
    }
    // social
    const name = displayName(item.user_id).toLowerCase()
    return (
      item.whisky_name?.toLowerCase().includes(q) ||
      item.whisky_distillery?.toLowerCase().includes(q) ||
      name.includes(q)
    )
  })
})

const FLAVOR_TAG_MAP = [
  { key: 'ahumado',   threshold: 3, en: 'Smoky',   es: 'Ahumado'  },
  { key: 'dulzor',    threshold: 3, en: 'Sweet',    es: 'Dulce'    },
  { key: 'frutado',   threshold: 3, en: 'Fruity',   es: 'Frutado'  },
  { key: 'especiado', threshold: 3, en: 'Spiced',   es: 'Especiado'},
  { key: 'cuerpo',    threshold: 4, en: 'Full Body', es: 'Cuerpo'  },
]

function flavorTags(item) {
  return FLAVOR_TAG_MAP
    .filter(f => item[f.key] != null && item[f.key] >= f.threshold)
    .map(f => locale.value === 'es' ? f.es : f.en)
    .slice(0, 4)
}

function verbFor(type) {
  if (type === 'rating')       return t.value.feedRated
  if (type === 'wishlist_add') return t.value.feedWishlisted
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

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
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

/* ── User groups ── */
.feed-group {
  margin-bottom: 8px;
}

.feed-group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0 6px;
  border-bottom: 0.5px solid var(--border, rgba(200, 130, 42, 0.1));
  margin-bottom: 0;
}

.feed-group-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(200, 130, 42, 0.15);
  border: 0.5px solid var(--border-hi, rgba(200, 130, 42, 0.4));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--amber-light, #E8A84C);
  flex-shrink: 0;
}

.feed-group-name {
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary, #F8F4EE);
  flex: 1;
}

.feed-group-count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.06em;
  color: var(--peat-light, #8A7060);
}

/* ── Feed list ── */
.feed-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── Rich social card ── */
.feed-item {
  display: flex;
  align-items: stretch;
  gap: 0;
  border-radius: 12px;
  border: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
  background: rgba(200, 130, 42, 0.04);
  overflow: hidden;
  margin-bottom: 12px;
}

/* Left image panel */
.feed-card-img {
  flex-shrink: 0;
  width: 80px;
  min-height: 120px;
  background: rgba(200, 130, 42, 0.07);
  border-right: 0.5px solid var(--border, rgba(200, 130, 42, 0.12));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.feed-card-img-el {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.feed-card-img-ph {
  opacity: 0.3;
  color: var(--amber-light, #E8A84C);
}

/* Right content */
.feed-card-body {
  flex: 1;
  min-width: 0;
  padding: 16px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* User row: avatar + name/time + rating */
.feed-card-user-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.feed-card-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(200, 130, 42, 0.15);
  border: 0.5px solid rgba(200, 130, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--amber-light, #E8A84C);
  flex-shrink: 0;
}

.feed-card-user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.feed-card-username {
  font-family: 'Inter', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary, #F8F4EE);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.feed-card-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.57rem;
  color: var(--peat-light, #8A7060);
  letter-spacing: 0.04em;
}

.feed-card-rating {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.feed-card-rating-star {
  color: var(--amber, #A8620A);
}

.feed-card-rating-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--amber-light, #E8A84C);
}

/* Whisky name & distillery */
.feed-card-whisky-name {
  font-family: 'Inter', sans-serif;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--amber, #A8620A);
  line-height: 1.25;
}

.feed-card-whisky-sub {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  font-style: italic;
  color: var(--peat-light, #8A7060);
  margin-top: -2px;
}

/* Tasting quote */
.feed-card-quote {
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--text-secondary, #C0A882);
  line-height: 1.55;
  border-left: 2px solid rgba(200, 130, 42, 0.35);
  padding-left: 10px;
  margin: 2px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Flavor tags */
.feed-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 2px;
}

.feed-card-tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  color: var(--amber, #A8620A);
  background: rgba(200, 130, 42, 0.1);
  border: 0.5px solid rgba(200, 130, 42, 0.25);
  border-radius: 20px;
  padding: 3px 8px;
}

/* ── Timestamp (kept for editorial use) ── */
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


/* ── Follow hint bar ── */
.feed-follow-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: rgba(200, 130, 42, 0.06);
  border: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light, #8A7060);
  letter-spacing: 0.04em;
}

/* ── Editorial cards ── */
.feed-editorial {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 12px;
  margin-bottom: 8px;
  border-radius: 8px;
  border: 0.5px solid var(--border, rgba(200, 130, 42, 0.15));
  background: rgba(200, 130, 42, 0.04);
}

.feed-editorial--award {
  border-color: rgba(200, 130, 42, 0.35);
  background: rgba(200, 130, 42, 0.08);
}

.feed-editorial--event {
  border-color: rgba(100, 160, 200, 0.25);
  background: rgba(100, 160, 200, 0.04);
}

.feed-editorial--announcement {
  border-color: rgba(200, 130, 42, 0.25);
  background: rgba(200, 130, 42, 0.05);
}

.feed-editorial-icon {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(200, 130, 42, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--amber-light, #E8A84C);
  margin-top: 1px;
}

.feed-editorial--award .feed-editorial-icon {
  background: rgba(200, 130, 42, 0.2);
  color: var(--amber, #A8620A);
}

.feed-editorial--event .feed-editorial-icon {
  background: rgba(100, 160, 200, 0.15);
  color: #6ab0d8;
}

.feed-editorial-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feed-editorial-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.feed-editorial-type {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--amber, #A8620A);
  background: rgba(200, 130, 42, 0.12);
  padding: 1px 5px;
  border-radius: 3px;
}

.feed-editorial--event .feed-editorial-type {
  color: #6ab0d8;
  background: rgba(100, 160, 200, 0.12);
}

.feed-editorial-source {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light, #8A7060);
}

.feed-editorial-title {
  font-family: 'Inter', sans-serif;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--text-primary, #F8F4EE);
  line-height: 1.35;
}

.feed-editorial-link {
  color: var(--amber-light, #E8A84C);
  text-decoration: none;
}

.feed-editorial-link:hover {
  text-decoration: underline;
}

.feed-editorial-desc {
  font-family: 'Inter', sans-serif;
  font-size: 0.76rem;
  color: var(--text-secondary, #C0A882);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.feed-editorial-event-info {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: #6ab0d8;
  letter-spacing: 0.04em;
}
</style>