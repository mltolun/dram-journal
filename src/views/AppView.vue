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
      @add="openAddModal"
      @compare="toggleCompare"
      @export="doExport"
      @scan="scanOpen = true"
    />
    <div class="grid-area">
      <div class="whisky-grid">
        <template v-if="whiskies.length === 0">
          <div class="empty-grid">
            <div class="empty-icon">🥃</div>
            <div class="empty-text">No whiskies yet<br>Press "＋ Add" to get started</div>
          </div>
        </template>
        <WhiskyCard
          v-for="(w, i) in whiskies"
          :key="w.id"
          :whisky="w"
          :selected="selected.includes(w.id)"
          :select-color="selected.includes(w.id) ? COLOR_HEX[selected.indexOf(w.id)] : null"
          @toggle="toggleSelect(w.id)"
          @edit="openEditModal(w)"
          @delete="doDelete(w)"
          @share="openShareModal(w)"
        />
      </div>
    </div>

    <Transition name="slide-down">
      <ComparePanel
        v-if="compareOpen && selected.length > 0"
        :whiskies="selectedWhiskies"
      />
    </Transition>

    <WhiskyModal
      v-if="modalOpen"
      :editing="editingWhisky"
      :prefill="scanPrefill"
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
      @close="scanOpen = false"
      @identified="onScanned"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth, currentUser } from '../composables/useAuth.js'
import { useWhiskies, whiskies } from '../composables/useWhiskies.js'
import { useLookups } from '../composables/useLookups.js'
import { usePhoto } from '../composables/usePhoto.js'
import { useToast } from '../composables/useToast.js'
import { exportCSV } from '../utils/csv.js'
import { COLOR_HEX } from '../lib/constants.js'

import AuthBox      from '../components/AuthBox.vue'
import AppHeader    from '../components/AppHeader.vue'
import AppToolbar   from '../components/AppToolbar.vue'
import WhiskyCard   from '../components/WhiskyCard.vue'
import WhiskyModal  from '../components/WhiskyModal.vue'
import ComparePanel from '../components/ComparePanel.vue'
import ShareModal   from '../components/ShareModal.vue'
import ScanModal    from '../components/ScanModal.vue'

const { getSession } = useAuth()
const { loadWhiskies, deleteWhisky } = useWhiskies()
const { deletePhoto } = usePhoto()
const { loadLookups } = useLookups()
const { toast } = useToast()

const selected      = ref([])
const compareOpen   = ref(false)
const modalOpen     = ref(false)
const editingWhisky = ref(null)
const shareModalWhisky = ref(null)
const scanOpen      = ref(false)
const scanPrefill   = ref(null)

const selectedWhiskies = computed(() =>
  selected.value.map(id => whiskies.value.find(w => w.id === id)).filter(Boolean)
)

onMounted(async () => {
  const session = await getSession()
  if (session) {
    await Promise.all([loadWhiskies(), loadLookups()])
  }
})

function toggleSelect(id) {
  const idx = selected.value.indexOf(id)
  if (idx >= 0) {
    selected.value.splice(idx, 1)
  } else {
    if (selected.value.length >= 4) { toast('Maximum 4 whiskies for comparison'); return }
    selected.value.push(id)
  }
}

function toggleCompare() {
  if (selected.value.length === 0) { toast('Select a card first to compare'); return }
  compareOpen.value = !compareOpen.value
}

function openAddModal() {
  editingWhisky.value = null
  scanPrefill.value   = null
  modalOpen.value = true
}

function onScanned(data) {
  scanOpen.value      = false
  editingWhisky.value = null
  scanPrefill.value   = data
  modalOpen.value     = true
}

function openEditModal(w) {
  editingWhisky.value = w
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
  toast('Deleted')
}

function onSaved(w) {
  modalOpen.value = false
  toast('✓ ' + w.name + (editingWhisky.value ? ' updated' : ' added'))
}

function doExport() {
  if (whiskies.value.length === 0) { toast('No whiskies to export'); return }
  exportCSV(whiskies.value)
  toast('✓ CSV exported')
}
</script>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-10px); }
</style>
