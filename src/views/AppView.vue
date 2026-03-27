<template>
  <!-- Auth screens -->
  <div v-if="!currentUser" style="position:fixed;inset:0;z-index:500;background:var(--peat);display:flex;align-items:center;justify-content:center;">
    <AuthBox />
  </div>

  <!-- Main app -->
  <div v-else>
    <AppHeader />
    <AppToolbar
      :selected-count="selected.length"
      :compare-open="compareOpen"
      :active-list="activeList"
      :on-clear-selected="clearSelected"
      @add="openAddModal"
      @compare="toggleCompare"
      @scan="scanOpen = true"
      @set-list="setActiveList"
      @timeline="timelineOpen = true"
    />
    <div class="grid-area">
      <!-- Wishlist: two-column layout — items left (4-col grid), recs right (column) -->
      <div v-if="activeList === 'wishlist'" class="wishlist-layout">
        <div class="wishlist-col">
          <div class="wishlist-section-lbl">✦ {{ t.wishlist }}</div>
          <div class="whisky-grid wishlist-grid">
        <template v-if="activeList === 'wishlist'">
            <div class="empty-grid" v-if="activeItems.length === 0">
              <div class="empty-icon">✦</div>
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
          </template>
          <template v-else>
            <template v-if="activeItems.length === 0">
              <div class="empty-grid">
                <div class="empty-icon">🥃</div>
                <div class="empty-text">{{ t.emptyJournal }}</div>
              </div>
            </template>
            <WhiskyCard
              v-for="w in activeItems"
              :key="w.id"
              :whisky="w"
              :selected="selected.includes(w.id)"
              :select-color="selected.includes(w.id) ? COLOR_HEX[selected.indexOf(w.id)] : null"
              @toggle="toggleSelect(w.id)"
              @view="openViewModal(w)"
              @delete="doDelete(w)"
              @share="openShareModal(w)"
              @move="doMoveToJournal(w)"
            />
          </template>
        </div>
        </div><!-- /wishlist-col -->
        <div class="recs-col">
          <RecommendationsPanel />
        </div>
      </div><!-- /wishlist-layout -->

      <!-- Journal grid — plain, no two-column wrapper -->
      <div v-if="activeList === 'journal'" class="whisky-grid">
        <template v-if="activeItems.length === 0">
          <div class="empty-grid">
            <div class="empty-icon">🥃</div>
            <div class="empty-text">{{ t.emptyJournal }}</div>
          </div>
        </template>
        <WhiskyCard
          v-for="w in activeItems"
          :key="w.id"
          :whisky="w"
          :selected="selected.includes(w.id)"
          :select-color="selected.includes(w.id) ? COLOR_HEX[selected.indexOf(w.id)] : null"
          @toggle="toggleSelect(w.id)"
          @view="openViewModal(w)"
          @delete="doDelete(w)"
          @share="openShareModal(w)"
        />
      </div>

      <!-- Trash section — only shown on journal tab when there are trashed items -->
      <template v-if="activeList === 'journal' && trash.length > 0">
        <div class="trash-divider">
          <span>🗑 {{ t.trashSection }} · {{ t.trashAutoFlush }}</span>
        </div>
        <div class="whisky-grid trash-grid">
          <WhiskyCard
            v-for="w in trash"
            :key="w.id"
            :whisky="w"
            :selected="false"
            :select-color="null"
            @restore="doRestore(w)"
            @delete="doHardDelete(w)"
          />
        </div>
      </template>
    </div>

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

    <TimelinePanel
      v-if="timelineOpen"
      @close="timelineOpen = false"
      @open-entry="openViewModal"
    />

    <ScanModal
      v-if="scanOpen"
      :list="activeList"
      @close="scanOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { useWhiskies, journal, wishlist, trash } from '../composables/useWhiskies.js'
import { usePhoto } from '../composables/usePhoto.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { COLOR_HEX } from '../lib/constants.js'

import AuthBox      from '../components/AuthBox.vue'
import AppHeader    from '../components/AppHeader.vue'
import AppToolbar   from '../components/AppToolbar.vue'
import WhiskyCard   from '../components/WhiskyCard.vue'
import WhiskyModal  from '../components/WhiskyModal.vue'
import ComparePanel from '../components/ComparePanel.vue'
import ShareModal          from '../components/ShareModal.vue'
import ScanModal           from '../components/ScanModal.vue'
import RecommendationsPanel from '../components/RecommendationsPanel.vue'
import TimelinePanel from '../components/TimelinePanel.vue'

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
const timelineOpen      = ref(false)

const activeItems = computed(() => activeList.value === 'wishlist' ? wishlist.value : journal.value)

const selectedWhiskies = computed(() =>
  selected.value.map(id => journal.value.find(w => w.id === id)).filter(Boolean)
)

onMounted(async () => {
  if (route.query.list === 'wishlist') activeList.value = 'wishlist'
  const session = await getSession()
  if (session) {
    await loadWhiskies()
  }
})

function setActiveList(list) {
  activeList.value = list
  selected.value = []
  compareOpen.value = false
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
  if (w.list === "wishlist") {
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
    console.error("moveToTrash failed:", err)
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
.trash-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
.trash-grid {
  opacity: 0.85;
}
.wishlist-layout {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 24px;
  align-items: start;
}
.wishlist-col {
  min-width: 0;
}
.wishlist-grid {
  grid-template-columns: repeat(3, minmax(0, 255px)) !important;
}
.recs-col {
  position: sticky;
  top: 70px;
}
@media (max-width: 1100px) {
  .wishlist-layout { grid-template-columns: 1fr; }
  .recs-col { position: static; }
  .wishlist-grid { grid-template-columns: repeat(2, minmax(0, 255px)) !important; }
  .wishlist-layout { grid-template-columns: 1fr 240px; }
}
@media (max-width: 600px) {
  .wishlist-grid { grid-template-columns: 1fr !important; }
}
</style>