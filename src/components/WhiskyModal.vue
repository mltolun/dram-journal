<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" v-if="isViewMode">
          <span>{{ editing?.name }}</span>
        </div>
        <div class="modal-title" v-else-if="!editing && !cataloguePicked && !manualMode">
          {{ t.addToJournal }}
        </div>
        <div class="modal-title" v-else-if="!editing">
          {{ list === 'wishlist' ? t.addToWishlist : t.addToJournal }}
        </div>
        <div class="modal-title" v-else>{{ t.edit }} <span>{{ editing.name }}</span></div>
        <button class="modal-close" @click="$emit('close')"><XIcon :size="18" /></button>
      </div>

      <!-- ── VIEW MODE ── -->
      <template v-if="isViewMode"><div style="padding: 20px 20px 20px;">

        <div :class="isJournal && form.photo_url ? 'view-layout-split' : ''">

          <!-- Left: photo -->
          <div v-if="isJournal && form.photo_url" class="view-photo-col">
            <img :src="form.photo_url" class="view-photo" :alt="form.name" @click="lightboxOpen = true">
          </div>

          <!-- Right (or full-width if no photo): details -->
          <div class="view-details-col">
            <div class="view-grid-2">
              <div class="view-field" v-if="form.distillery">
                <div class="view-label">{{ t.distillery }}</div>
                <div class="view-value">{{ form.distillery }}</div>
              </div>
              <div class="view-field" v-if="form.origin">
                <div class="view-label">{{ t.country }}</div>
                <div class="view-value">{{ form.origin }}</div>
              </div>
              <div class="view-field" v-if="form.region">
                <div class="view-label">{{ t.region }}</div>
                <div class="view-value">{{ form.region }}</div>
              </div>
              <div class="view-field">
                <div class="view-label">{{ t.ageMaturation }}</div>
                <div class="view-value">{{ form.age || 'NAS' }}</div>
              </div>
              <div class="view-field" v-if="form.abv">
                <div class="view-label">{{ t.abv }}</div>
                <div class="view-value">{{ form.abv }}</div>
              </div>
            </div>

            <div class="view-grid-2">
              <div class="view-field" v-if="form.type">
                <div class="view-label">{{ t.style }}</div>
                <div class="view-value">
                  <span class="wcard-type" :class="`type-${form.type}`">{{ t.types[form.type] || form.type }}</span>
                </div>
              </div>
            </div>

            <div class="view-grid-2">
              <div class="view-field" v-if="form.price || cataloguePriceRange">
                <div class="view-label">{{ t.price }}</div>
                <div class="view-value">
                  <!-- Always show as tappable badge — label is price_band if available, else form.price -->
                  <button
                    class="price-range-btn"
                    :title="`Search prices for ${form.name}`"
                    @click.stop="openPriceSearch"
                  >
                    <span class="price-range-value">{{ cataloguePriceRange || form.price }}</span>
                    <span class="price-range-icon"><ShoppingCartIcon :size="12" /></span>
                  </button>
                </div>
              </div>
              <div class="view-field" v-if="isJournal && form.date">
                <div class="view-label">{{ t.tastingDate }}</div>
                <div class="view-value">{{ form.date }}</div>
              </div>
            </div>

            <div class="view-grid-2" v-if="isJournal">
              <div class="view-field" v-if="form.nose">
                <div class="view-label">{{ t.nose }}</div>
                <div class="view-value">{{ form.nose }}</div>
              </div>
              <div class="view-field" v-if="form.palate">
                <div class="view-label">{{ t.palate }}</div>
                <div class="view-value">{{ form.palate }}</div>
              </div>
            </div>
          </div>
        </div>

        <template v-if="isJournal">
          <div class="view-section-lbl">{{ t.flavourProfileView }}</div>
          <div v-for="a in ATTRS" :key="a" class="slider-row view-slider-row">
            <div class="slider-header">
              <span class="slider-lbl">{{ t.attrs[a] }}</span>
              <span class="slider-val">{{ form[a] }}</span>
            </div>
            <div class="view-bar-track">
              <div class="view-bar-fill" :style="{ width: (form[a] || 0) * 20 + '%' }"></div>
            </div>
          </div>

          <div class="view-field" v-if="form.rating">
            <div class="view-label">{{ t.rating }}</div>
            <div class="view-stars">
              <span v-for="n in 5" :key="n" class="view-star" :class="{ filled: n <= form.rating }"><StarIcon :size="12" /></span>
            </div>
          </div>
        </template>

        <div class="view-field" v-if="form.notes">
          <div class="view-label">{{ isJournal ? t.personalNotes : t.wishlistNotes }}</div>
          <div class="view-value view-notes">{{ form.notes }}</div>
        </div>

        <div v-if="isJournal" class="view-field view-bottle-row">
          <div class="view-label">{{ t.bottleCount }}</div>
          <div class="view-value view-bottle-val">
            <template v-if="form.bottle_count">
              <PackageIcon :size="13" /> × {{ form.bottle_count }}
              <span v-if="form.last_finished" class="view-bottle-date">· {{ t.lastFinished }}: {{ form.last_finished }}</span>
            </template>
            <template v-else>—</template>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-save" :disabled="editLoading" @click="emit('share', props.editing || form)">
            <Share2Icon :size="14" /> Share
          </button>
          <button class="btn-save" :disabled="editLoading" @click="switchToEdit"><PencilIcon :size="14" /> {{ t.editBtn }}</button>
          <button class="btn-cancel" @click="$emit('close')">{{ t.close }}</button>
        </div>

        <!-- Lightbox -->
        <Teleport to="body">
          <div v-if="lightboxOpen" class="lightbox" @click="lightboxOpen = false">
            <div class="lightbox-inner" @click.stop>
              <button class="lightbox-close" @click="lightboxOpen = false"><XIcon :size="16" /></button>
              <img :src="form.photo_url" :alt="form.name" class="lightbox-img">
            </div>
          </div>
        </Teleport>
        </div>
      </template>

      <!-- ── SCAN MATCH STEP — shown when opened via bottle scan ── -->
      <template v-else-if="scanMode && !cataloguePicked">
        <div class="scan-match-header">
          <div class="scan-match-label">{{ t.scanMatchLabel || 'Is this the whisky?' }}</div>
          <div class="scan-match-name">{{ form.name }}</div>
          <div v-if="form.distillery" class="scan-match-sub">{{ form.distillery }}</div>
        </div>

        <div v-if="scanSearching" class="cs-state">{{ t.searching || 'Searching…' }}</div>

        <template v-else>
          <!-- Catalogue matches found -->
          <div v-if="scanResults.length" class="cs-results scan-results">
            <div class="scan-match-hint">{{ t.scanMatchHint || 'Select the matching bottle from the catalogue:' }}</div>
            <div
              v-for="item in scanResults"
              :key="item.id"
              class="cs-item"
              @click="onCataloguePick(item); scanMode = false"
            >
              <div class="cs-thumb">
                <img v-if="item.photo_url" :src="item.photo_url" :alt="item.name" class="cs-img">
                <div v-else class="cs-img-placeholder"><GlassWaterIcon :size="32" /></div>
              </div>
              <div class="cs-info">
                <div class="cs-name">{{ item.name }}</div>
                <div class="cs-meta">
                  <span v-if="item.distillery">{{ item.distillery }}</span>
                  <span v-if="item.country" class="cs-dot">· {{ item.country }}</span>
                  <span v-if="item.type" class="cs-badge" :class="`type-${item.type}`">{{ t.types?.[item.type] }}</span>
                </div>
                <div class="cs-sub" v-if="item.age || item.abv">
                  <span v-if="item.age">{{ item.age }}</span>
                  <span v-if="item.age && item.abv" class="cs-dot">·</span>
                  <span v-if="item.abv">{{ item.abv }}</span>
                </div>
              </div>
              <span class="cs-arrow">›</span>
            </div>
          </div>

          <div v-else class="cs-state cs-empty">
            {{ t.scanNoMatch || 'No catalogue match found.' }}
          </div>

          <!-- Always offer manual fallback -->
          <div class="cs-manual">
            <span class="cs-manual-label">{{ t.scanNotRight || 'Not the right one?' }}</span>
            <button class="cs-manual-btn" @click="dismissScanResults">
              {{ t.scanUseScanned || 'Use scanned data' }}
            </button>
          </div>
        </template>
      </template>

      <!-- ── CATALOGUE SEARCH STEP (new journal entry only) ── -->
      <template v-else-if="!editing && !cataloguePicked && !manualMode">
        <CatalogueSearch @pick="onCataloguePick" @manual="manualMode = true" />
      </template>

      <!-- Loading catalogue entry for existing record -->
      <template v-else-if="editLoading">
        <div class="cs-state">{{ t.searching || 'Loading…' }}</div>
      </template>

      <!-- ── ADD / EDIT MODE ── -->
      <template v-else>
        <div v-if="!cataloguePicked" class="form-row">
          <label>{{ t.name }}</label>
          <input type="text" v-model="form.name" :placeholder="t.namePlaceholder">
        </div>

        <div v-if="isJournal && !cataloguePicked" class="form-row">
          <label>{{ t.photo }}</label>
          <PhotoUpload
            :preview-src="previewUrl"
            :kb="compressedKb"
            @picked="onPhotoSelected"
            @remove="onPhotoRemove"
          />
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label>
              {{ t.country }}
              <span v-if="cataloguePicked && form.origin !== (cataloguePicked.country || '')" class="override-badge">
                yours · <button class="reset-btn" @click="form.origin = cataloguePicked.country || ''">↺</button>
              </span>
            </label>
            <input type="text" v-model="form.origin" :placeholder="t.countryPlaceholder">
          </div>
          <div class="form-row">
            <label>
              {{ t.region }}
              <span v-if="cataloguePicked && form.region !== (cataloguePicked.region || '')" class="override-badge">
                yours · <button class="reset-btn" @click="form.region = cataloguePicked.region || ''">↺</button>
              </span>
            </label>
            <Autocomplete v-model="form.region" category="origin" :placeholder="t.regionPlaceholder" />
          </div>
          <div class="form-row">
            <label>
              {{ t.ageMaturation }}
              <span v-if="cataloguePicked && form.age !== (cataloguePicked.age || '')" class="override-badge">
                yours · <button class="reset-btn" @click="form.age = cataloguePicked.age || ''">↺</button>
              </span>
            </label>
            <input type="text" v-model="form.age" :placeholder="t.agePlaceholder">
          </div>
        </div>

        <div class="form-grid-2">
          <div v-if="!cataloguePicked" class="form-row">
            <label>{{ t.style }}</label>
            <select v-model="form.type">
              <option value="scotch">{{ t.scotch }}</option>
              <option value="irish">{{ t.irish }}</option>
              <option value="bourbon">{{ t.bourbon }}</option>
              <option value="japanese">{{ t.japanese }}</option>
              <option value="other">{{ t.other }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>
              {{ t.price }}
              <span v-if="cataloguePicked && form.price !== (cataloguePicked.price_band || '')" class="override-badge">
                yours · <button class="reset-btn" @click="form.price = cataloguePicked.price_band || ''">↺</button>
              </span>
            </label>
            <input type="text" v-model="form.price" :placeholder="t.pricePlaceholder">
          </div>
          <div v-if="isJournal" class="form-row">
            <label>{{ t.tastingDate }}</label>
            <input type="date" v-model="form.date">
          </div>
        </div>

        <!-- Bottle counter — edit mode, journal only -->
        <div v-if="isJournal && editing" class="form-grid-2">
          <div class="form-row">
            <label>{{ t.bottleCount }}</label>
            <input type="number" v-model.number="form.bottle_count" min="1" step="1">
          </div>
          <div class="form-row">
            <label>{{ t.lastFinished }}</label>
            <input type="date" v-model="form.last_finished">
          </div>
        </div>

        <!-- Catalogue locked fields — shown when picked from catalogue -->
        <div v-if="cataloguePicked" class="catalogue-locked-card">
          <div class="catalogue-locked-thumb">
            <img v-if="cataloguePicked.photo_url" :src="cataloguePicked.photo_url" :alt="cataloguePicked.name" class="catalogue-locked-img">
            <div v-else class="catalogue-locked-placeholder"><GlassWaterIcon :size="32" /></div>
          </div>
          <div class="catalogue-locked-info">
            <div class="catalogue-locked-name">{{ cataloguePicked.name }}</div>
            <div class="catalogue-locked-meta">
              <span v-if="cataloguePicked.distillery">{{ cataloguePicked.distillery }}</span>
              <span v-if="cataloguePicked.country"> · {{ cataloguePicked.country }}</span>
              <span v-if="cataloguePicked.region"> · {{ cataloguePicked.region }}</span>
            </div>
            <div class="catalogue-locked-sub">
              <span v-if="cataloguePicked.type" class="cs-badge" :class="`type-${cataloguePicked.type}`">{{ t.types?.[cataloguePicked.type] }}</span>
              <span v-if="cataloguePicked.age"> · {{ cataloguePicked.age }}</span>
              <span v-if="cataloguePicked.abv"> · {{ cataloguePicked.abv }}</span>
            </div>
          </div>
          <button class="catalogue-locked-change" @click="cataloguePicked = null" title="Change whisky">↩</button>
        </div>

        <!-- Tasting fields only for journal -->
        <template v-if="isJournal">
          <div class="form-section-lbl">{{ t.flavourProfile }}</div>
          <div v-for="a in ATTRS" :key="a" class="slider-row">
            <div class="slider-header">
              <span class="slider-lbl">{{ t.attrs[a] }}</span>
              <span
                v-if="cataloguePicked && form[a] !== cataloguePicked[a]"
                class="override-badge"
                :title="t.yourOverride || 'Your override'"
              >yours</span>
              <span class="slider-val">{{ form[a] }}</span>
            </div>
            <input type="range" min="0" max="5" step="1" v-model.number="form[a]">
          </div>
          <div class="form-row">
            <label>{{ t.nose }}
              <span v-if="cataloguePicked && form.nose !== cataloguePicked.nose && form.nose" class="override-badge">yours</span>
            </label>
            <input type="text" v-model="form.nose" :placeholder="t.nosePlaceholder">
          </div>
          <div class="form-row">
            <label>{{ t.palate }}
              <span v-if="cataloguePicked && form.palate !== cataloguePicked.palate && form.palate" class="override-badge">yours</span>
            </label>
            <input type="text" v-model="form.palate" :placeholder="t.palatePlaceholder">
          </div>
        </template>

        <div v-if="isJournal" class="form-row">
          <label>{{ t.rating }}</label>
          <div class="star-picker">
            <button
              v-for="n in 5" :key="n"
              type="button"
              class="star-btn"
              :class="{ filled: n <= form.rating }"
              @click="form.rating = form.rating === n ? 0 : n"
              :title="`${n} star${n > 1 ? 's' : ''}`"
            ><StarIcon :size="14" /></button>
            <span v-if="form.rating" class="star-clear" @click="form.rating = 0"><XIcon :size="10" /></span>
          </div>
        </div>

        <div class="form-row">
          <label>{{ isJournal ? t.personalNotes : t.wishlistNotes }}</label>
          <textarea v-model="form.notes" :placeholder="isJournal ? t.notesPlaceholder : t.wishlistNotesPlaceholder"></textarea>
        </div>

        <div v-if="(cataloguePicked || manualMode || editing) && !scanMode" class="modal-actions">
          <button class="btn-save" :disabled="saving" @click="save">
            <CheckIcon v-if="!saving" :size="14" /> {{ saving ? t.saving : (editing ? t.saveChanges : (isJournal ? t.addToJournalBtn : t.addToWishlistBtn)) }}
          </button>
          <button class="btn-cancel" @click="$emit('close')">{{ t.cancel }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { X as XIcon, Pencil as PencilIcon, Check as CheckIcon, GlassWater as GlassWaterIcon, ShoppingCart as ShoppingCartIcon, Star as StarIcon, Package as PackageIcon, Share2 as Share2Icon } from 'lucide-vue-next'
import { useWhiskies } from '../composables/useWhiskies.js'
import { usePhoto } from '../composables/usePhoto.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import CatalogueSearch from './CatalogueSearch.vue'
import { useCatalogue, cleanSearchQuery } from '../composables/useCatalogue.js'
import { ATTRS, DEFAULTS, TYPE_LABELS } from '../lib/constants.js'
import { compressImage } from '../utils/compressImage.js'
import Autocomplete from './Autocomplete.vue'
import PhotoUpload  from './PhotoUpload.vue'

const props = defineProps({
  editing: Object,
  prefill: Object,
  list: { type: String, default: 'journal' },
  viewMode: { type: Boolean, default: false },
})
const emit  = defineEmits(['saved', 'close', 'share'])

const { insertWhisky, updateWhisky } = useWhiskies()
const { pendingBlob, previewUrl, compressedKb, clearPhoto, loadExisting, uploadPhoto } = usePhoto()
const { toast } = useToast()
const { t } = useI18n()

const saving       = ref(false)
const inViewMode   = ref(props.viewMode)
const lightboxOpen = ref(false)
const editLoading  = ref(false)  // true while fetching catalogue entry on mount
const cataloguePicked = ref(null)
const manualMode      = ref(false)
const scanMode        = ref(false)

const isViewMode = computed(() => inViewMode.value)
const isJournal = computed(() => (props.editing?.list || props.list) === 'journal')

// Price range from catalogue entry — shown in view mode as a tappable badge
const cataloguePriceRange = computed(() => cataloguePicked.value?.price_band || null)

function openPriceSearch() {
  const name       = (cataloguePicked.value?.name       || form.name       || '').trim()
  const distillery = (cataloguePicked.value?.distillery || form.distillery || '').trim()

  // Only append distillery if it isn't already part of the name (avoids "Deanston Virgin Oak Deanston")
  const nameIncludesDistillery = distillery && name.toLowerCase().includes(distillery.toLowerCase())
  const query = nameIncludesDistillery ? name : [name, distillery].filter(Boolean).join(' ')

  if (!query) return

  // udm=28 = Google Products tab (better retailer coverage than tbm=shop / Shopping tab)
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=28`
  window.open(url, '_blank', 'noopener,noreferrer')
}

function switchToEdit() {
  inViewMode.value = false
}

const catalogueSearch = useCatalogue()
const scanResults     = ref([])   // catalogue matches for the scanned whisky
const scanSearching   = ref(false)

const form = reactive({
  name: '', distillery: '', origin: '', region: '', type: 'scotch', age: '', abv: '',
  price: '', date: new Date().toISOString().split('T')[0],
  nose: '', palate: '', notes: '', rating: 0,
  bottle_count: null, last_finished: null,
  ...Object.fromEntries(ATTRS.map(a => [a, DEFAULTS[a]])),
})

onMounted(async () => {
  if (props.editing) {
    Object.assign(form, props.editing)
    loadExisting(props.editing.photo_url || null)

    if (props.editing.catalogue_id) {
      editLoading.value = true
      try {
        const entry = await catalogueSearch.getById(props.editing.catalogue_id)
        cataloguePicked.value = entry
      } catch {
        manualMode.value = true
      } finally {
        editLoading.value = false
      }
    } else {
      manualMode.value = true
    }
  } else {
    clearPhoto()
    if (props.prefill) {
      Object.assign(form, props.prefill)

      // Use name only — distillery is usually already in the scanned name
      const raw = props.prefill.name || ''
      const q   = cleanSearchQuery(raw) || raw
      console.log('[Scan] raw query:', raw)
      console.log('[Scan] cleaned query:', q)
      if (q.trim().length >= 2) {
        scanMode.value      = true
        scanSearching.value = true
        try {
          await catalogueSearch.search(q)
          scanResults.value = catalogueSearch.results.value
        } finally {
          scanSearching.value = false
        }
      }
    }
  }
})

async function onPhotoSelected(file) {
  const { blob, dataUrl, kb } = await compressImage(file, 600, 0.78)
  pendingBlob.value  = blob
  previewUrl.value   = dataUrl
  compressedKb.value = kb
}

function onPhotoRemove() {
  clearPhoto()
}

function dismissScanResults() {
  // User confirmed the scanned data is correct — use it as manual entry
  scanMode.value    = false
  scanResults.value = []
  manualMode.value  = true
}

function onCataloguePick(entry) {
  cataloguePicked.value = entry

  // Pre-fill form with catalogue data — user can override tasting fields
  Object.assign(form, {
    name:       entry.name,
    distillery: entry.distillery || '',
    origin:     entry.country    || '',
    region:     entry.region     || '',
    type:       entry.type       || 'other',
    age:        entry.age        || '',
    price:      entry.price_band || '',
    nose:       entry.nose       || '',
    palate:     entry.palate     || '',
    ...Object.fromEntries(ATTRS.map(a => [a, entry[a] ?? DEFAULTS[a]])),
  })

  // Use catalogue photo
  if (entry.photo_url) loadExisting(entry.photo_url)
}

async function save() {
  if (!form.name.trim()) { toast(t.value.nameRequired); return }
  saving.value = true
  try {
    const recordId = props.editing?.id || Date.now()

    // Only upload a new photo for manual entries — catalogue entries use photo_url from catalogue
    let photo_url = cataloguePicked.value?.photo_url || null
    if (!cataloguePicked.value) {
      try {
        photo_url = await uploadPhoto(recordId)
      } catch (e) {
        toast(e.message)
        saving.value = false
        return
      }
    }

    // eslint-disable-next-line no-unused-vars
    const { catalogue, ...formData } = form
    const fields = {
      ...formData,
      photo_url:    photo_url || null,
      catalogue_id: cataloguePicked.value?.id || null,
      list:         props.editing?.list || props.list,
    }

    const savedRecord = props.editing
      ? await updateWhisky(props.editing.id, fields)
      : await insertWhisky({ id: recordId, ...fields })

    emit('saved', { ...fields, ...savedRecord })
  } catch (e) {
    toast('⚠ ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.star-picker {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
}
.star-btn {
  background: none;
  border: none;
  font-size: 1.4rem;
  color: var(--border-hi);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.12s, transform 0.12s;
}
.star-btn.filled {
  color: var(--amber-light);
}
.star-btn:hover {
  color: var(--amber);
  transform: scale(1.15);
}
.star-clear {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  color: var(--peat-light);
  cursor: pointer;
  margin-left: 4px;
  opacity: 0.6;
  transition: opacity 0.15s;
}
.star-clear:hover {
  opacity: 1;
  color: var(--amber-light);
}

/* ── View mode ── */
.view-layout-split {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 20px;
  align-items: start;
  margin-bottom: 4px;
}
.view-photo-col {
  position: sticky;
  top: 0;
}
.view-photo {
  width: 100%;
  max-height: 300px;
  border-radius: 8px;
  object-fit: contain;
  display: block;
  border: 0.5px solid var(--border);
  background: var(--bg-card);
  cursor: zoom-in;
  transition: opacity 0.15s;
}
.view-photo:hover {
  opacity: 0.88;
}

@media (max-width: 540px) {
  .view-layout-split {
    grid-template-columns: 1fr;
  }
  .view-photo-col {
    position: static;
  }
  .view-photo {
    max-height: 260px;
    object-fit: contain;
  }
}

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  animation: lb-in 0.18s ease;
}
@keyframes lb-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.lightbox-inner {
  position: relative;
  max-width: 75vw;
  max-height: 75vh;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: default;
}
.lightbox-img {
  max-width: 75vw;
  max-height: 75vh;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  display: block;
}
.lightbox-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(30, 20, 10, 0.85);
  border: 0.5px solid rgba(255, 255, 255, 0.25);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  z-index: 2002;
  flex-shrink: 0;
}
.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.22);
}
.view-details-col {
  min-width: 0;
}
.view-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 16px;
}
.view-field {
  margin-bottom: 12px;
}
.view-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  color: var(--peat-light);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}
.view-value {
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.4;
}
.view-notes {
  font-style: italic;
  color: var(--peat-light);
  white-space: pre-wrap;
}
.view-section-lbl {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
  letter-spacing: 0.06em;
  margin: 12px 0 8px;
}
.view-slider-row {
  margin-bottom: 8px;
}
.view-bar-track {
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}
.view-bar-fill {
  height: 100%;
  background: var(--amber);
  border-radius: 2px;
  transition: width 0.3s ease;
}
.view-stars {
  display: flex;
  gap: 4px;
  padding: 2px 0;
}
.view-star {
  font-size: 1.2rem;
  color: var(--border-hi);
}
.view-star.filled {
  color: var(--amber-light);
}
.bg-removal-status {
  margin-top: 6px;
  font-size: 0.78rem;
  opacity: 0.6;
  font-style: italic;
  letter-spacing: 0.02em;
}

/* ── Catalogue search result items (used in scan match step) ── */
.cs-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 340px;
  overflow-y: auto;
  margin-bottom: 12px;
}
.cs-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.cs-item:hover { background: var(--bg-card); }
.cs-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 0.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
}
.cs-img { width: 100%; height: 100%; object-fit: contain; }
.cs-img-placeholder { font-size: 1.2rem; opacity: 0.4; }
.cs-info { flex: 1; min-width: 0; }
.cs-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.7;
}
.cs-dot { opacity: 0.4; }
.cs-sub {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.5;
  margin-top: 2px;
}
.cs-badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 6px;
  border-radius: 20px;
}
.cs-arrow {
  color: var(--text-secondary);
  opacity: 0.3;
  font-size: 1.2rem;
  flex-shrink: 0;
}
.cs-state {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  opacity: 0.6;
}
.cs-manual {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0 0;
  border-top: 0.5px solid var(--border);
  margin-top: 4px;
}
.cs-manual-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.6;
}
.cs-manual-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--amber-light);
  font-size: 0.8rem;
  padding: 6px 14px;
  cursor: pointer;
  transition: all 0.15s;
}
.cs-manual-btn:hover {
  background: var(--bg-card);
  border-color: var(--border-hi);
}

/* ── Scan match step ── */
.scan-match-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 0.5px solid var(--border);
}
.scan-match-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--amber-light);
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 4px;
  opacity: 0.8;
}
.scan-match-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text-primary);
}
.scan-match-sub {
  font-size: 0.8rem;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-top: 2px;
}
.scan-match-hint {
  font-size: 0.78rem;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-bottom: 8px;
}
.scan-results { margin-bottom: 8px; }

/* ── Catalogue locked card ── */
.catalogue-locked-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 4px;
}
.catalogue-locked-thumb {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 0.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
}
.catalogue-locked-img { width: 100%; height: 100%; object-fit: contain; }
.catalogue-locked-placeholder { font-size: 1.4rem; opacity: 0.4; }
.catalogue-locked-info { flex: 1; min-width: 0; }
.catalogue-locked-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.catalogue-locked-meta {
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.65;
  margin-top: 2px;
}
.catalogue-locked-sub {
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.5;
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.catalogue-locked-change {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 1rem;
  padding: 4px 8px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.catalogue-locked-change:hover { opacity: 1; }

/* ── Override badge ── */
.override-badge {
  display: inline-block;
  font-size: 0.58rem;
  font-family: 'JetBrains Mono', monospace;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(200, 130, 42, 0.15);
  color: var(--amber-light);
  margin-left: 6px;
  vertical-align: middle;
}
.reset-btn {
  background: none;
  border: none;
  color: var(--amber-light);
  cursor: pointer;
  font-size: 0.6rem;
  padding: 0;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.reset-btn:hover { opacity: 1; }

/* ── Price range badge ── */
.price-range-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(200, 130, 42, 0.1);
  border: 0.5px solid rgba(200, 130, 42, 0.35);
  border-radius: 20px;
  padding: 4px 10px 4px 10px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  font-family: inherit;
  text-decoration: none;
  /* Ensure tappable on mobile */
  -webkit-tap-highlight-color: transparent;
  min-height: 32px;
}
.price-range-btn:hover,
.price-range-btn:focus-visible {
  background: rgba(200, 130, 42, 0.18);
  border-color: var(--amber);
}
.price-range-btn:active {
  transform: scale(0.96);
}
.price-range-value {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--amber-light);
  letter-spacing: 0.01em;
}
.price-range-icon {
  font-size: 0.85rem;
  line-height: 1;
  opacity: 0.75;
}
</style>
