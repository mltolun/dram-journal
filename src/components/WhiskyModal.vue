<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" v-if="isViewMode">
          <span>{{ editing?.name }}</span>
        </div>
        <div class="modal-title" v-else-if="!editing">
          {{ list === 'wishlist' ? t.addToWishlist : t.addToJournal }}
        </div>
        <div class="modal-title" v-else>{{ t.edit }} <span>{{ editing.name }}</span></div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <!-- ── VIEW MODE ── -->
      <template v-if="isViewMode">

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
                <div class="view-label">{{ t.regionOrigin }}</div>
                <div class="view-value">{{ form.origin }}</div>
              </div>
            </div>

            <div class="view-grid-2">
              <div class="view-field" v-if="form.type">
                <div class="view-label">{{ t.style }}</div>
                <div class="view-value">{{ t.types[form.type] || form.type }}</div>
              </div>
              <div class="view-field" v-if="form.age">
                <div class="view-label">{{ t.ageMaturation }}</div>
                <div class="view-value">{{ form.age }}</div>
              </div>
            </div>

            <div class="view-grid-2">
              <div class="view-field" v-if="form.price">
                <div class="view-label">{{ t.price }}</div>
                <div class="view-value">{{ form.price }}</div>
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
              <span v-for="n in 5" :key="n" class="view-star" :class="{ filled: n <= form.rating }">★</span>
            </div>
          </div>
        </template>

        <div class="view-field" v-if="form.notes">
          <div class="view-label">{{ isJournal ? t.personalNotes : t.wishlistNotes }}</div>
          <div class="view-value view-notes">{{ form.notes }}</div>
        </div>

        <div class="modal-actions">
          <button class="btn-save" @click="switchToEdit">{{ t.editBtn }}</button>
          <button class="btn-cancel" @click="$emit('close')">{{ t.close }}</button>
        </div>

        <!-- Lightbox -->
        <Teleport to="body">
          <div v-if="lightboxOpen" class="lightbox" @click="lightboxOpen = false">
            <button class="lightbox-close" @click="lightboxOpen = false">✕</button>
            <img :src="form.photo_url" :alt="form.name" class="lightbox-img" @click.stop>
          </div>
        </Teleport>
      </template>

      <!-- ── ADD / EDIT MODE ── -->
      <template v-else>
        <div class="form-row">
          <label>{{ t.name }}</label>
          <input type="text" v-model="form.name" :placeholder="t.namePlaceholder">
        </div>

        <div v-if="isJournal" class="form-row">
          <label>{{ t.photo }}</label>
          <PhotoUpload
            :preview-src="previewUrl"
            :kb="compressedKb"
            @selected="onPhotoSelected"
            @remove="onPhotoRemove"
          />
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label>{{ t.distillery }}</label>
            <Autocomplete v-model="form.distillery" category="distillery" :placeholder="t.distilleryPlaceholder" />
          </div>
          <div class="form-row">
            <label>{{ t.regionOrigin }}</label>
            <Autocomplete v-model="form.origin" category="origin" :placeholder="t.regionPlaceholder" />
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
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
            <label>{{ t.ageMaturation }}</label>
            <input type="text" v-model="form.age" :placeholder="t.agePlaceholder">
          </div>
        </div>

        <div class="form-grid-2">
          <div class="form-row">
            <label>{{ t.price }}</label>
            <input type="text" v-model="form.price" :placeholder="t.pricePlaceholder">
          </div>
          <div v-if="isJournal" class="form-row">
            <label>{{ t.tastingDate }}</label>
            <input type="date" v-model="form.date">
          </div>
        </div>

        <!-- Tasting fields only for journal -->
        <template v-if="isJournal">
          <div class="form-section-lbl">{{ t.flavourProfile }}</div>
          <div v-for="a in ATTRS" :key="a" class="slider-row">
            <div class="slider-header">
              <span class="slider-lbl">{{ t.attrs[a] }}</span>
              <span class="slider-val">{{ form[a] }}</span>
            </div>
            <input type="range" min="0" max="5" step="1" v-model.number="form[a]">
          </div>
          <div class="form-row"><label>{{ t.nose }}</label><input type="text" v-model="form.nose" :placeholder="t.nosePlaceholder"></div>
          <div class="form-row"><label>{{ t.palate }}</label><input type="text" v-model="form.palate" :placeholder="t.palatePlaceholder"></div>
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
            >★</button>
            <span v-if="form.rating" class="star-clear" @click="form.rating = 0">✕</span>
          </div>
        </div>

        <div class="form-row">
          <label>{{ isJournal ? t.personalNotes : t.wishlistNotes }}</label>
          <textarea v-model="form.notes" :placeholder="isJournal ? t.notesPlaceholder : t.wishlistNotesPlaceholder"></textarea>
        </div>

        <div class="modal-actions">
          <button class="btn-save" :disabled="saving" @click="save">
            {{ saving ? t.saving : (editing ? t.saveChanges : (isJournal ? t.addToJournalBtn : t.addToWishlistBtn)) }}
          </button>
          <button class="btn-cancel" @click="$emit('close')">{{ t.cancel }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useWhiskies } from '../composables/useWhiskies.js'
import { usePhoto } from '../composables/usePhoto.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { ATTRS, DEFAULTS, TYPE_LABELS } from '../lib/constants.js'
import Autocomplete from './Autocomplete.vue'
import PhotoUpload  from './PhotoUpload.vue'

const props = defineProps({
  editing: Object,
  prefill: Object,
  list: { type: String, default: 'journal' },
  viewMode: { type: Boolean, default: false },
})
const emit  = defineEmits(['saved', 'close'])

const { insertWhisky, updateWhisky } = useWhiskies()
const { pendingBlob, previewUrl, compressedKb, clearPhoto, loadExisting, uploadPhoto } = usePhoto()
const { toast } = useToast()
const { t } = useI18n()

const saving = ref(false)
const inViewMode = ref(props.viewMode)
const lightboxOpen = ref(false)

const isViewMode = computed(() => inViewMode.value)
const isJournal = computed(() => (props.editing?.list || props.list) === 'journal')

function switchToEdit() {
  inViewMode.value = false
}

const form = reactive({
  name: '', distillery: '', origin: '', type: 'scotch', age: '',
  price: '', date: new Date().toISOString().split('T')[0],
  nose: '', palate: '', notes: '', rating: 0,
  ...Object.fromEntries(ATTRS.map(a => [a, DEFAULTS[a]])),
})

onMounted(() => {
  if (props.editing) {
    Object.assign(form, props.editing)
    loadExisting(props.editing.photo_url || null)
  } else {
    clearPhoto()
    if (props.prefill) {
      Object.assign(form, props.prefill)
    }
  }
})

function onPhotoSelected({ blob, dataUrl, kb }) {
  pendingBlob.value  = blob
  previewUrl.value   = dataUrl
  compressedKb.value = kb
}

function onPhotoRemove() {
  clearPhoto()
}

async function save() {
  if (!form.name.trim()) { toast(t.value.nameRequired); return }
  saving.value = true
  try {
    const recordId = props.editing?.id || Date.now()
    let photo_url = null
    try {
      photo_url = await uploadPhoto(recordId)
    } catch (e) {
      toast(e.message)
      saving.value = false
      return
    }
    const fields = {
      ...form,
      photo_url: photo_url || null,
      list: props.editing?.list || props.list,
    }
    if (props.editing) {
      await updateWhisky(props.editing.id, fields)
    } else {
      await insertWhisky({ id: recordId, ...fields })
    }
    emit('saved', fields)
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
  font-family: 'DM Mono', monospace;
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
.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 10px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
  cursor: default;
}
.lightbox-close {
  position: fixed;
  top: 20px;
  right: 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 0.5px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 36px;
  height: 36px;
  color: #fff;
  font-size: 0.85rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  z-index: 2001;
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
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  color: var(--peat-light);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 3px;
}
.view-value {
  font-size: 0.9rem;
  color: var(--ink);
  line-height: 1.4;
}
.view-notes {
  font-style: italic;
  color: var(--peat-light);
  white-space: pre-wrap;
}
.view-section-lbl {
  font-family: 'DM Mono', monospace;
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
</style>
