<template>
  <!-- Auth screen -->
  <div v-if="!currentUser" style="position:fixed;inset:0;z-index:500;background:var(--peat);display:flex;align-items:center;justify-content:center;">
    <AuthBox :initial-tab="route.query.auth === 'register' ? 'register' : 'login'" />
  </div>

  <!-- Main app: sidebar + content -->
  <div v-else class="app-layout">

    <!-- Fixed left sidebar (becomes bottom nav on mobile) -->
    <AppSidebar :active-list="activeList" @set-list="setActiveList" />

    <!-- Main scrollable column -->
    <div class="main-content">
      <div class="sticky-top">
        <AppHeader />

        <AppToolbar
          :selected-count="selected.length"
          :compare-open="compareOpen"
          :active-list="activeList"
          :on-clear-selected="clearSelected"
          :filters-open="filtersOpen"
          :filter-count="activeFilterCount"
          @compare="toggleCompare"
          @filter="filtersOpen = !filtersOpen"
          @add="openAddModal"
        />
      </div>

      <!-- Cascading filter bar (journal only) -->
      <div v-if="activeList === 'journal' && filtersOpen" class="filter-bar">
        <select v-model="filterCountry" class="filter-select">
          <option value="">All countries</option>
          <option v-for="c in availableCountries" :key="c" :value="c">{{ c }}</option>
        </select>
        <select v-model="filterRegion" class="filter-select">
          <option value="">All regions</option>
          <option v-for="r in availableRegions" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="filterDistillery" class="filter-select">
          <option value="">All distilleries</option>
          <option v-for="d in availableDistilleries" :key="d" :value="d">{{ d }}</option>
        </select>
        <select v-model="filterAge" class="filter-select">
          <option value="">All ages</option>
          <option v-for="a in availableAges" :key="a" :value="a">{{ a === 'NAS' ? 'NAS' : a + ' yo' }}</option>
        </select>
        <div class="filter-sort-group">
          <select v-model="sortBy" class="filter-select">
            <option value="date">Date</option>
            <option value="rating">Rating</option>
            <option value="name">Name</option>
          </select>
          <button class="btn-sort-dir" @click="sortDir = sortDir === 'desc' ? 'asc' : 'desc'" :title="sortDir === 'desc' ? 'Newest / highest first' : 'Oldest / lowest first'">
            <ArrowDownIcon v-if="sortDir === 'desc'" :size="13" aria-hidden="true" />
            <ArrowUpIcon v-else :size="13" aria-hidden="true" />
          </button>
        </div>
        <button v-if="activeFilterCount > 0" class="btn-clear-filters" @click="clearFilters">Clear filters</button>
      </div>

      <!-- Grid area -->
      <div class="grid-area">

        <!-- ── View-toggle row (journal only) ── -->
        <div v-if="activeList === 'journal'" class="view-toggle-row">
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'gallery' }"
            @click="viewMode = 'gallery'"
            :aria-pressed="viewMode === 'gallery'"
            :aria-label="t.galleryView"
          ><LayoutGridIcon :size="13" aria-hidden="true" /> {{ t.galleryView }}</button>
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'list' }"
            @click="viewMode = 'list'"
            :aria-pressed="viewMode === 'list'"
            :aria-label="t.listView"
          ><ListIcon :size="13" aria-hidden="true" /> {{ t.listView }}</button>
          <button
            class="view-toggle-btn"
            :class="{ active: viewMode === 'timeline' }"
            @click="viewMode = 'timeline'"
            :aria-pressed="viewMode === 'timeline'"
            aria-label="Timeline"
          ><CalendarIcon :size="13" aria-hidden="true" /> Timeline</button>
        </div>

        <!-- ── Wishlist: two-column layout ── -->
        <div v-if="activeList === 'wishlist'" class="wishlist-layout">
          <div class="wishlist-col">
            <div class="wishlist-section-lbl"><SparklesIcon :size="12" style="display:inline;vertical-align:middle;margin-right:5px;" />{{ t.wishlist }}</div>
            <div class="whisky-grid wishlist-grid">
              <div class="empty-grid" v-if="activeItems.length === 0">
                <div class="empty-icon"><SparklesIcon :size="36" /></div>
                <div class="empty-text">{{ t.emptyWishlist }}</div>
              </div>
              <WhiskyCard
                v-for="w in activeItems"
                :key="w.id"
                :whisky="w"
                :selected="false"
                :select-color="null"
                @view="openViewModal(w)"
                @delete="doDelete(w)"
                @share="openShareModal(w)"
                @move="doMoveToJournal(w)"
              />
            </div>
          </div>
          <div class="recs-col">
            <RecommendationsPanel />
          </div>
        </div>

        <!-- ── Journal grid ── -->
        <div
          v-if="activeList === 'journal' && viewMode !== 'timeline'"
          class="whisky-grid"
          :class="{ 'list-view': viewMode === 'list' }"
        >
          <template v-if="activeItems.length === 0">
            <div class="empty-grid">
              <div class="empty-icon"><GlassWaterIcon :size="36" /></div>
              <div class="empty-text">{{ t.emptyJournal }}</div>
            </div>
          </template>
          <WhiskyCard
            v-for="w in activeItems"
            :key="w.id"
            :whisky="w"
            :selected="selected.includes(w.id)"
            :select-color="selected.includes(w.id) ? COLOR_HEX[selected.indexOf(w.id)] : null"
            :compact="viewMode === 'list'"
            @view="openViewModal(w)"
            @toggle="toggleSelect(w.id)"
            @delete="doDelete(w)"
            @share="openShareModal(w)"
          />
        </div>

        <!-- ── Timeline (journal sub-view) ── -->
        <TimelinePanel v-if="activeList === 'journal' && viewMode === 'timeline'" :entries="filteredJournal" @open-entry="openViewModal" />

        <!-- ── Community Feed ── -->
        <FeedPanel v-if="activeList === 'feed'" />

        <!-- ── Trash (journal tab) ── -->
        <template v-if="activeList === 'journal' && trash.length > 0">
          <div class="trash-divider">
            <span><Trash2Icon :size="12" /> {{ t.trashSection }} · {{ t.trashAutoFlush }}</span>
          </div>
          <div class="whisky-grid trash-grid" :class="{ 'list-view': viewMode === 'list' }">
            <WhiskyCard
              v-for="w in trash"
              :key="w.id"
              :whisky="w"
              :selected="false"
              :select-color="null"
              :compact="viewMode === 'list'"
              @restore="doRestore(w)"
              @delete="doHardDelete(w)"
            />
          </div>
        </template>

      </div><!-- /grid-area -->
    </div><!-- /main-content -->

    <!-- ── Floating Action Button ── -->
    <div class="fab-wrap" ref="fabWrap">
      <button
        class="fab"
        @click.stop="fabOpen = !fabOpen"
        :aria-label="t.logNewDram"
        :aria-expanded="fabOpen"
      >
        <PlusIcon :size="22" aria-hidden="true" />
      </button>
      <transition name="fab-menu">
        <div v-if="fabOpen" class="fab-menu" role="menu">
          <button class="fab-menu-item" @click.stop="chooseFab('add')" role="menuitem">
            <SearchIcon :size="14" aria-hidden="true" />
            Search catalogue
          </button>
          <button class="fab-menu-item" @click.stop="chooseFab('scan')" role="menuitem">
            <CameraIcon :size="14" aria-hidden="true" />
            {{ t.scan }} bottle
          </button>
        </div>
      </transition>
    </div>

    <!-- ── Panels ── -->
    <ComparePanel
      v-if="compareOpen && selected.length > 0"
      :whiskies="selectedWhiskies"
      @close="compareOpen = false"
    />

    <WhiskyModal
      v-if="modalOpen"
      :editing="editingWhisky"
      :prefill="scanPrefill"
      :list="activeList"
      :view-mode="isViewMode"
      @saved="onSaved"
      @close="modalOpen = false; scanPrefill = null"
    />

    <ShareModal
      v-if="shareModalWhisky"
      :whisky="shareModalWhisky"
      @close="shareModalWhisky = null"
    />

    <ScanModal
      v-if="scanOpen"
      :list="activeList"
      @close="scanOpen = false"
    />

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { useWhiskies, journal, wishlist, trash } from '../composables/useWhiskies.js'
import { myFollowers } from '../composables/useSubscriptions.js'
import { loadEarnedBadges, checkBadges } from '../composables/useBadges.js'
import { usePhoto } from '../composables/usePhoto.js'
import { useToast } from '../composables/useToast.js'
import { useI18n, detectLocale } from '../composables/useI18n.js'
import { searchQuery } from '../composables/useSearch.js'
import { COLOR_HEX } from '../lib/constants.js'
import {
  Plus as PlusIcon,
  Search as SearchIcon,
  Camera as CameraIcon,
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  LayoutGrid as LayoutGridIcon,
  List as ListIcon,
  Calendar as CalendarIcon,
  GlassWater as GlassWaterIcon,
  Sparkles as SparklesIcon,
  Trash2 as Trash2Icon,
} from 'lucide-vue-next'

import AuthBox             from '../components/AuthBox.vue'
import AppHeader           from '../components/AppHeader.vue'
import AppToolbar          from '../components/AppToolbar.vue'
import AppSidebar          from '../components/AppSidebar.vue'
import WhiskyCard          from '../components/WhiskyCard.vue'
import WhiskyModal         from '../components/WhiskyModal.vue'
import ComparePanel        from '../components/ComparePanel.vue'
import ShareModal          from '../components/ShareModal.vue'
import ScanModal           from '../components/ScanModal.vue'
import RecommendationsPanel from '../components/RecommendationsPanel.vue'
import TimelinePanel       from '../components/TimelinePanel.vue'
import FeedPanel           from '../components/FeedPanel.vue'

const { getSession } = useAuth()
const { loadWhiskies, deleteWhisky, moveToJournal, moveToTrash, restoreFromTrash } = useWhiskies()
const { deletePhoto } = usePhoto()
const { toast } = useToast()
const { t } = useI18n()
const route = useRoute()

const activeList    = ref('journal')
const selected      = ref([])
const compareOpen   = ref(false)
const modalOpen     = ref(false)
const editingWhisky = ref(null)
const isViewMode    = ref(false)
const shareModalWhisky = ref(null)
const scanOpen      = ref(false)
const scanPrefill   = ref(null)
const viewMode      = ref('gallery') // 'gallery' | 'list'

// FAB
const fabOpen = ref(false)
const fabWrap = ref(null)

function chooseFab(action) {
  fabOpen.value = false
  if (action === 'add') openAddModal()
  else scanOpen.value = true
}

function onFabClickOutside(e) {
  if (fabWrap.value && !fabWrap.value.contains(e.target)) fabOpen.value = false
}

onMounted(() => document.addEventListener('click', onFabClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onFabClickOutside))

// ── Filters ──────────────────────────────────────────────────────────────────
const filtersOpen      = ref(false)
const filterCountry    = ref('')
const filterRegion     = ref('')
const filterDistillery = ref('')
const filterAge        = ref('')
const sortBy           = ref('date')   // 'date' | 'rating' | 'name'
const sortDir          = ref('desc')   // 'desc' | 'asc'

function parseAge(v) {
  const m = String(v || '').match(/\d+/)
  return m ? parseInt(m[0]) : null
}

const availableCountries = computed(() =>
  [...new Set(journal.value.map(w => w.origin).filter(Boolean))].sort()
)
const afterCountry = computed(() => {
  if (!filterCountry.value) return journal.value
  return journal.value.filter(w => w.origin === filterCountry.value)
})
const availableRegions = computed(() =>
  [...new Set(afterCountry.value.map(w => w.region).filter(Boolean))].sort()
)
const afterCountryAndRegion = computed(() => {
  if (!filterRegion.value) return afterCountry.value
  return afterCountry.value.filter(w => w.region === filterRegion.value)
})
const availableDistilleries = computed(() =>
  [...new Set(afterCountryAndRegion.value.map(w => w.distillery).filter(Boolean))].sort()
)
const availableAges = computed(() => {
  const ages = new Set()
  journal.value.forEach(w => {
    const a = parseAge(w.age)
    ages.add(a !== null ? String(a) : 'NAS')
  })
  return [...ages].sort((a, b) => {
    if (a === 'NAS') return 1
    if (b === 'NAS') return -1
    return parseInt(a) - parseInt(b)
  })
})

watch(filterCountry, () => {
  if (filterRegion.value && !availableRegions.value.includes(filterRegion.value)) filterRegion.value = ''
  if (filterDistillery.value && !availableDistilleries.value.includes(filterDistillery.value)) filterDistillery.value = ''
})
watch(filterRegion, () => {
  if (filterDistillery.value && !availableDistilleries.value.includes(filterDistillery.value)) filterDistillery.value = ''
})

const filteredJournal = computed(() => {
  let items = afterCountryAndRegion.value
  if (filterDistillery.value) items = items.filter(w => w.distillery === filterDistillery.value)
  if (filterAge.value === 'NAS') {
    items = items.filter(w => parseAge(w.age) === null)
  } else if (filterAge.value) {
    const age = parseInt(filterAge.value)
    items = items.filter(w => parseAge(w.age) === age)
  }
  // Search query filter (name, distillery, origin/region)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    items = items.filter(w =>
      w.name?.toLowerCase().includes(q) ||
      w.distillery?.toLowerCase().includes(q) ||
      w.origin?.toLowerCase().includes(q) ||
      w.region?.toLowerCase().includes(q)
    )
  }
  // Sort
  const dir = sortDir.value === 'asc' ? 1 : -1
  items = [...items].sort((a, b) => {
    if (sortBy.value === 'date') {
      const da = new Date(a.date || a.created_at || 0).getTime()
      const db = new Date(b.date || b.created_at || 0).getTime()
      return dir * (da - db)
    }
    if (sortBy.value === 'rating') {
      const ra = a.rating ?? -1
      const rb = b.rating ?? -1
      return dir * (ra - rb)
    }
    if (sortBy.value === 'name') {
      return dir * (a.name || '').localeCompare(b.name || '')
    }
    return 0
  })
  return items
})

const activeFilterCount = computed(() =>
  [filterCountry, filterRegion, filterDistillery, filterAge]
    .filter(f => f.value !== '').length +
  (sortBy.value !== 'date' || sortDir.value !== 'desc' ? 1 : 0)
)

function clearFilters() {
  filterCountry.value = filterRegion.value = filterDistillery.value = filterAge.value = ''
  sortBy.value = 'date'
  sortDir.value = 'desc'
}

const filteredWishlist = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return wishlist.value
  return wishlist.value.filter(w =>
    w.name?.toLowerCase().includes(q) ||
    w.distillery?.toLowerCase().includes(q) ||
    w.origin?.toLowerCase().includes(q) ||
    w.region?.toLowerCase().includes(q)
  )
})

const activeItems = computed(() => activeList.value === 'wishlist' ? filteredWishlist.value : filteredJournal.value)

const selectedWhiskies = computed(() =>
  selected.value.map(id => journal.value.find(w => w.id === id)).filter(Boolean)
)

let badgeWatcherActive = false

async function initUserData() {
  await loadWhiskies()
  await loadEarnedBadges()
  await checkBadges()

  if (!badgeWatcherActive) {
    badgeWatcherActive = true
    watch(
      () => {
        const j = journal.value
        const f = myFollowers.value
        return [
          j.length,
          j.filter(w => w.rating != null).length,
          j.filter(w => (w.ahumado ?? 0) >= 4).length,
          j.filter(w =>
            (w.dulzor ?? 0) > 0 && (w.ahumado ?? 0) > 0 && (w.cuerpo ?? 0) > 0 &&
            (w.frutado ?? 0) > 0 && (w.especiado ?? 0) > 0
          ).length,
          new Set(j.map(w => w.origin).filter(Boolean)).size,
          f.length,
        ].join(',')
      },
      checkBadges,
    )
  }
}

onMounted(async () => {
  // Detect locale from browser/IP for first-time visitors (no-op if already set)
  if (!localStorage.getItem('dj_locale')) detectLocale()

  if (route.query.list === 'wishlist') activeList.value = 'wishlist'
  const session = await getSession()
  if (session) {
    await initUserData()
  }
})

// Handle login that happens after the component is already mounted
// (onMounted ran while user was on the login screen, so getSession() returned null)
watch(currentUser, async (newUser, oldUser) => {
  if (newUser && !oldUser) {
    await initUserData()
  }
})

function setActiveList(list) {
  activeList.value = list
  selected.value = []
  compareOpen.value = false
  filtersOpen.value = false
  clearFilters()
  searchQuery.value = ''
}

function toggleSelect(id) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    if (selected.value.length >= 3) { toast(t.value.maxWhiskies); return }
    selected.value.push(id)
  }
}

function toggleCompare() {
  if (selected.value.length < 2) { toast(t.value.selectFirst); return }
  compareOpen.value = !compareOpen.value
}

function clearSelected() {
  selected.value = []
  compareOpen.value = false
}

function openAddModal() {
  editingWhisky.value = null
  scanPrefill.value   = null
  isViewMode.value    = false
  modalOpen.value = true
}

function openViewModal(w) {
  editingWhisky.value = w
  isViewMode.value    = true
  modalOpen.value = true
}

function openShareModal(w) {
  shareModalWhisky.value = w
}

async function doDelete(w) {
  if (w.list === 'wishlist') {
    if (!confirm(`Delete "${w.name}" from your wishlist?`)) return
    await deleteWhisky(w.id)
    if (w.photo_url) deletePhoto(w.id, null, w.photo_url)
    toast(t.value.deleted)
    return
  }
  if (!confirm(`Move "${w.name}" to trash?`)) return
  try {
    await moveToTrash(w.id)
    selected.value = selected.value.filter(id => id !== w.id)
    toast(t.value.trashMoved(w.name))
  } catch (err) {
    console.error('moveToTrash failed:', err)
    toast(`⚠ Could not move to trash: ${err.message}`)
  }
}

async function doRestore(w) {
  await restoreFromTrash(w.id)
  toast(t.value.trashRestored(w.name))
}

async function doHardDelete(w) {
  if (!confirm(`Permanently delete "${w.name}"? This cannot be undone.`)) return
  await deleteWhisky(w.id)
  if (w.photo_url) deletePhoto(w.id, null, w.photo_url)
  toast(t.value.deleted)
}

async function doMoveToJournal(w) {
  await moveToJournal(w.id)
  toast(t.value.movedToJournal(w.name))
}

function onSaved(w) {
  modalOpen.value = false
  toast(editingWhisky.value ? t.value.whiskyUpdated(w.name) : t.value.whiskyAdded(w.name))
}
</script>

<style scoped>
/* ── Sticky header+toolbar on mobile ── */
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg);
}

/* ── View toggle ── */
.view-toggle-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
.view-toggle-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 6px;
  background: transparent;
  border: 0.5px solid var(--border);
  color: var(--text-secondary);
  font-family: 'Inter', sans-serif;
  font-size: 0.72rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.view-toggle-btn:hover { border-color: var(--border-hi); color: var(--text-primary); }
.view-toggle-btn.active {
  background: rgba(200, 130, 42, 0.1);
  border-color: var(--amber);
  color: var(--amber-light);
}

/* ── Filter bar ── */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 10px 24px;
  border-bottom: 0.5px solid var(--border);
  background: rgba(200,130,42,0.03);
}
.filter-select {
  padding: 5px 10px;
  border-radius: 6px;
  border: 0.5px solid var(--border);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 0.72rem;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  outline: none;
  max-width: 160px;
}
.filter-select:focus { border-color: var(--amber); }
.filter-select option { background: var(--bg-modal); color: var(--text-primary); }
.filter-sort-group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.btn-sort-dir {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 0.5px solid var(--border);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.btn-sort-dir:hover { border-color: var(--amber); color: var(--amber); }
.btn-clear-filters {
  margin-left: auto;
  padding: 5px 12px;
  border-radius: 6px;
  border: 0.5px solid rgba(200,130,42,0.3);
  background: transparent;
  color: var(--amber-light);
  font-size: 0.7rem;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-clear-filters:hover { background: rgba(200,130,42,0.1); color: var(--amber); }

/* ── Trash divider ── */
.trash-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 32px 0 16px;
  padding: 0 4px;
  color: var(--peat-light);
  font-size: 0.65rem;
  font-family: 'JetBrains Mono', monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.5;
}
.trash-divider::before,
.trash-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
.trash-grid { opacity: 0.85; }

/* ── Wishlist two-column ── */
.wishlist-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 24px;
  align-items: start;
}
.wishlist-col { min-width: 0; }
.wishlist-grid {
  grid-template-columns: repeat(3, minmax(0, 255px)) !important;
}
.recs-col {
  position: sticky;
  top: 70px;
}

/* ── FAB ── */
.fab-wrap {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 300;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-end;
  gap: 8px;
}
.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--amber);
  color: #fff;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(200, 130, 42, 0.45);
  transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
  flex-shrink: 0;
}
.fab:hover {
  background: var(--amber-light);
  transform: translateY(-2px) scale(1.06);
  box-shadow: 0 6px 24px rgba(200, 130, 42, 0.55);
}
.fab:active { transform: scale(0.96); }
.fab-menu {
  background: var(--bg-modal);
  border: 0.5px solid var(--border-hi);
  border-radius: 10px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  min-width: 170px;
}
.fab-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 11px 14px;
  background: none;
  border: none;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-family: 'Inter', sans-serif;
  text-align: left;
}
.fab-menu-item:hover { background: rgba(200,130,42,0.08); color: var(--text-primary); }
.fab-menu-item + .fab-menu-item { border-top: 0.5px solid var(--border); }

/* FAB menu transition */
.fab-menu-enter-active { transition: opacity 0.15s, transform 0.15s; }
.fab-menu-leave-active { transition: opacity 0.1s, transform 0.1s; }
.fab-menu-enter-from,
.fab-menu-leave-to { opacity: 0; transform: scale(0.92) translateY(8px); }

/* ── Responsive ── */
@media (max-width: 1100px) {
  .wishlist-layout { grid-template-columns: 1fr; }
  .recs-col { position: static; }
  .wishlist-grid { grid-template-columns: repeat(2, minmax(0, 255px)) !important; }
}
@media (max-width: 768px) {
  .fab-wrap { bottom: calc(64px + env(safe-area-inset-bottom) + 1rem); }
}
@media (max-width: 680px) {
  .filter-bar { padding: 8px 12px; gap: 6px; }
  .filter-select { max-width: 100%; flex: 1 1 40%; }
  .btn-clear-filters { margin-left: 0; width: 100%; text-align: center; }
}
@media (max-width: 600px) {
  .wishlist-grid { grid-template-columns: 1fr !important; }
}
</style>