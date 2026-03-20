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
      @share-wishlist="wishlistShareOpen = true"
    />
    <div class="grid-area">
      <RecommendationsPanel v-if="activeList === 'wishlist'" />
      <div v-if="activeList === 'wishlist'" class="wishlist-section-lbl">✦ {{ t.wishlist }}</div>
      <div class="whisky-grid">
        <template v-if="activeItems.length === 0">
          <div class="empty-grid">
            <div class="empty-icon">{{ activeList === 'wishlist' ? '✦' : '🥃' }}</div>
            <div class="empty-text">
              {{ activeList === 'wishlist' ? t.emptyWishlist : t.emptyJournal }}
            </div>
          </div>
        </template>
        <WhiskyCard
          v-for="w in activeItems"
          :key="w.id"
          :whisky="w"
          :selected="selected.includes(w.id)"
          :select-color="selected.includes(w.id) ? COLOR_HEX[selected.indexOf(w.id)] : null"
          @toggle="activeList === 'journal' ? toggleSelect(w.id) : null"
          @view="openViewModal(w)"
          @delete="doDelete(w)"
          @share="openShareModal(w)"
          @move="doMoveToJournal(w)"
        />
      </div>
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

    <WishlistShareModal
      v-if="wishlistShareOpen"
      :items="wishlist"
      @close="wishlistShareOpen = false"
    />

    <ScanModal
      v-if="scanOpen"
      :list="activeList"
      @close="scanOpen = false"
      @identified="onScanned"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { useWhiskies, journal, wishlist } from '../composables/useWhiskies.js'
import { useLookups } from '../composables/useLookups.js'
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
import WishlistShareModal  from '../components/WishlistShareModal.vue'
import RecommendationsPanel from '../components/RecommendationsPanel.vue'

const { getSession } = useAuth()
const { loadWhiskies, deleteWhisky, moveToJournal } = useWhiskies()
const { deletePhoto } = usePhoto()
const { loadLookups } = useLookups()
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
const wishlistShareOpen = ref(false)

const activeItems = computed(() => activeList.value === 'wishlist' ? wishlist.value : journal.value)

const selectedWhiskies = computed(() =>
  selected.value.map(id => journal.value.find(w => w.id === id)).filter(Boolean)
)

onMounted(async () => {
  if (route.query.list === 'wishlist') activeList.value = 'wishlist'
  const session = await getSession()
  if (session) {
    await Promise.all([loadWhiskies(), loadLookups()])
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

function onScanned(data) {
  scanOpen.value      = false
  editingWhisky.value = null
  scanPrefill.value   = data
  isViewMode.value    = false
  modalOpen.value     = true
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
  if (!confirm(`Delete "${w.name}"?`)) return
  await deleteWhisky(w.id)
  if (w.photo_url) deletePhoto(w.id)
  selected.value = selected.value.filter(id => id !== w.id)
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
</style>
