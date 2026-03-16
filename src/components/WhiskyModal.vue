<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title" v-if="!editing">
          Add to <span>{{ list === 'wishlist' ? 'Wishlist' : 'Journal' }}</span>
        </div>
        <div class="modal-title" v-else>Edit <span>{{ editing.name }}</span></div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="form-row">
        <label>Name</label>
        <input type="text" v-model="form.name" placeholder="Arran 10 Years Old">
      </div>

      <div v-if="isJournal" class="form-row">
        <label>Photo</label>
        <PhotoUpload
          :preview-src="previewUrl"
          :kb="compressedKb"
          @selected="onPhotoSelected"
          @remove="onPhotoRemove"
        />
      </div>

      <div class="form-grid-2">
        <div class="form-row">
          <label>Distillery</label>
          <Autocomplete v-model="form.distillery" category="distillery" placeholder="Arran" />
        </div>
        <div class="form-row">
          <label>Region / Origin</label>
          <Autocomplete v-model="form.origin" category="origin" placeholder="Isle of Arran, Scotland" />
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-row">
          <label>Style</label>
          <select v-model="form.type">
            <option value="scotch">Scotch</option>
            <option value="irish">Irish</option>
            <option value="bourbon">Bourbon</option>
            <option value="japanese">Japanese</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div class="form-row">
          <label>Age / Maturation</label>
          <input type="text" v-model="form.age" placeholder="10 years / Bourbon cask">
        </div>
      </div>

      <div class="form-grid-2">
        <div class="form-row">
          <label>Price</label>
          <input type="text" v-model="form.price" placeholder="£35–45">
        </div>
        <div v-if="isJournal" class="form-row">
          <label>Tasting date</label>
          <input type="date" v-model="form.date">
        </div>
      </div>

      <!-- Tasting fields only for journal -->
      <template v-if="isJournal">
        <div class="form-section-lbl">— Flavour profile (0–5)</div>
        <div v-for="a in ATTRS" :key="a" class="slider-row">
          <div class="slider-header">
            <span class="slider-lbl">{{ ATTR_LABELS[a] }}</span>
            <span class="slider-val">{{ form[a] }}</span>
          </div>
          <input type="range" min="0" max="5" step="1" v-model.number="form[a]">
        </div>
        <div class="form-row"><label>Nose</label><input type="text" v-model="form.nose" placeholder="Vanilla, green apple…"></div>
        <div class="form-row"><label>Palate</label><input type="text" v-model="form.palate" placeholder="Sweet malt, warm spice…"></div>
      </template>

      <div v-if="isJournal" class="form-row">
        <label>Rating</label>
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
        <label>{{ isJournal ? 'Personal notes' : 'Notes / Why I want this' }}</label>
        <textarea v-model="form.notes" :placeholder="isJournal ? 'My impressions…' : 'Recommended by…, Seen at…'"></textarea>
      </div>

      <div class="modal-actions">
        <button class="btn-save" :disabled="saving" @click="save">
          {{ saving ? 'Saving…' : (editing ? '✓ Save changes' : (isJournal ? '＋ Add to Journal' : '✦ Add to Wishlist')) }}
        </button>
        <button class="btn-cancel" @click="$emit('close')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useWhiskies } from '../composables/useWhiskies.js'
import { usePhoto } from '../composables/usePhoto.js'
import { useToast } from '../composables/useToast.js'
import { ATTRS, ATTR_LABELS, DEFAULTS } from '../lib/constants.js'
import Autocomplete from './Autocomplete.vue'
import PhotoUpload  from './PhotoUpload.vue'

const props = defineProps({ editing: Object, prefill: Object, list: { type: String, default: 'journal' } })
const emit  = defineEmits(['saved', 'close'])

const { insertWhisky, updateWhisky } = useWhiskies()
const { pendingBlob, previewUrl, compressedKb, clearPhoto, loadExisting, uploadPhoto } = usePhoto()
const { toast } = useToast()

const saving = ref(false)
const isJournal = computed(() => (props.editing?.list || props.list) === 'journal')

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
  if (!form.name.trim()) { toast('Name is required'); return }
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
</style>
