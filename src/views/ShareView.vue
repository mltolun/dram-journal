<template>
  <div v-if="loading" class="share-error">
    <div class="share-error-icon">🥃</div>
    <div class="share-error-txt">Loading…</div>
  </div>

  <div v-else-if="!whisky" class="share-error">
    <div class="share-error-icon">🥃</div>
    <div class="share-error-txt">This dram could not be found</div>
    <RouterLink to="/" style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--amber-light);margin-top:0.5rem;">← Back to The Dram Journal</RouterLink>
  </div>

  <div v-else>
    <div class="share-hero">
      <div class="share-brand">The <span>Dram</span> Journal</div>
      <img v-if="whisky.photo_url" :src="whisky.photo_url" :alt="whisky.name"
        style="width:100%;max-height:260px;object-fit:cover;border-radius:10px;margin-bottom:1.2rem;border:0.5px solid var(--border)">
      <div class="share-whisky-name">{{ whisky.name }}</div>
      <div class="share-meta">
        <span class="cm-badge" :style="typeBadgeStyle[whisky.type] || typeBadgeStyle.other">{{ TYPE_LABELS[whisky.type] }}</span>
        <span v-if="whisky.distillery" class="share-distillery">{{ whisky.distillery }}</span>
        <span v-if="whisky.origin" class="share-distillery" style="opacity:0.5">· {{ whisky.origin }}</span>
      </div>
    </div>

    <div class="share-body">
      <div>
        <div class="share-section-lbl">— Details</div>
        <template v-for="d in details" :key="d.label">
          <div class="share-detail-row">
            <span class="share-detail-lbl">{{ d.label }}</span>
            <span class="share-detail-val">{{ d.val }}</span>
          </div>
        </template>
        <template v-if="whisky.notes">
          <div class="share-section-lbl" style="margin-top:1.2rem">— Notes</div>
          <div class="share-notes-box">{{ whisky.notes }}</div>
        </template>
      </div>
      <div>
        <div class="share-section-lbl">— Flavour profile</div>
        <div class="share-bars">
          <div v-for="a in ATTRS" :key="a" class="share-bar-row">
            <div class="share-bar-lbl">{{ ATTR_LABELS[a] }}</div>
            <div class="share-track"><div class="share-fill" :style="{ width: (whisky[a] || 0) * 20 + '%' }"></div></div>
            <div class="share-val">{{ whisky[a] || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="share-actions">
      <button v-if="currentUser" class="btn-t btn-primary" :disabled="importing" @click="doImport">
        {{ importing ? 'Importing…' : '＋ Import to my journal' }}
      </button>
      <RouterLink v-else to="/" class="btn-t btn-outline" style="text-decoration:none;">Sign in to import</RouterLink>
      <RouterLink to="/" class="btn-t btn-outline" style="text-decoration:none;">← Back to journal</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { sb } from '../lib/supabase.js'
import { currentUser, useAuth } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useToast } from '../composables/useToast.js'
import { ATTRS, ATTR_LABELS, TYPE_LABELS, TYPE_BADGE_STYLE } from '../lib/constants.js'

const route = useRoute()
const { getSession } = useAuth()
const { insertWhisky } = useWhiskies()
const { toast } = useToast()

const typeBadgeStyle = TYPE_BADGE_STYLE
const whisky  = ref(null)
const loading = ref(true)
const importing = ref(false)

const details = computed(() => [
  { label: 'Distillery',      val: whisky.value?.distillery },
  { label: 'Region / Origin', val: whisky.value?.origin },
  { label: 'Style',           val: TYPE_LABELS[whisky.value?.type] },
  { label: 'Age / Maturation',val: whisky.value?.age },
  { label: 'Price',           val: whisky.value?.price },
  { label: 'Tasting date',    val: whisky.value?.date },
  { label: 'Nose',            val: whisky.value?.nose },
  { label: 'Palate',          val: whisky.value?.palate },
].filter(d => d.val))

onMounted(async () => {
  await getSession()
  const { data, error } = await sb
    .from('shared_whiskies')
    .select('payload')
    .eq('share_id', route.params.id)
    .single()
  if (!error && data) whisky.value = data.payload
  loading.value = false
})

async function doImport() {
  if (!currentUser.value) return
  importing.value = true
  const { id, user_id, created_at, ...fields } = whisky.value
  try {
    await insertWhisky({ id: Date.now(), ...fields })
    toast('✓ ' + whisky.value.name + ' imported!')
  } catch (e) {
    toast('⚠ Import failed: ' + e.message)
  } finally {
    importing.value = false
  }
}
</script>
