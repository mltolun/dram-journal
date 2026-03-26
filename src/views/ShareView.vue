<template>
  <div v-if="loading" class="share-error">
    <div class="share-error-icon">🥃</div>
    <div class="share-error-txt">{{ t.loading }}</div>
  </div>

  <div v-else-if="!whisky" class="share-error">
    <div class="share-error-icon">🥃</div>
    <div class="share-error-txt">{{ t.dramNotFound }}</div>
    <RouterLink to="/" style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--amber-light);margin-top:0.5rem;">{{ t.backToJournal }}</RouterLink>
  </div>

  <div v-else>
    <div class="share-hero">
      <div class="share-brand">The <span>Dram</span> Journal</div>
      <div v-if="whisky.photo_url" style="background:var(--bg-input);border-radius:10px;border:0.5px solid var(--border);margin-bottom:1.2rem;display:flex;align-items:center;justify-content:center;max-height:280px;overflow:hidden;">
        <img :src="whisky.photo_url" :alt="whisky.name"
          style="max-height:280px;max-width:100%;object-fit:contain;display:block;">
      </div>
      <div class="share-whisky-name">{{ whisky.name }}</div>
      <div class="share-meta">
        <span class="cm-badge" :style="typeBadgeStyle[whisky.type] || typeBadgeStyle.other">{{ t.types[whisky.type] }}</span>
        <span v-if="whisky.distillery" class="share-distillery">{{ whisky.distillery }}</span>
        <span v-if="whisky.origin" class="share-distillery" style="opacity:0.5">· {{ whisky.origin }}</span>
      </div>
    </div>

    <div class="share-body">
      <div>
        <div class="share-section-lbl">{{ t.details }}</div>
        <template v-for="d in details" :key="d.label">
          <div class="share-detail-row">
            <span class="share-detail-lbl">{{ d.label }}</span>
            <span class="share-detail-val">{{ d.val }}</span>
          </div>
        </template>
        <template v-if="whisky.notes">
          <div class="share-section-lbl" style="margin-top:1.2rem">{{ t.notes }}</div>
          <div class="share-notes-box">{{ whisky.notes }}</div>
        </template>
      </div>
      <div>
        <div class="share-section-lbl">{{ t.flavourProfileSection }}</div>
        <div class="share-bars">
          <div v-for="a in ATTRS" :key="a" class="share-bar-row">
            <div class="share-bar-lbl">{{ t.attrs[a] }}</div>
            <div class="share-track"><div class="share-fill" :style="{ width: (whisky[a] || 0) * 20 + '%' }"></div></div>
            <div class="share-val">{{ whisky[a] || 0 }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="share-actions">
      <button v-if="currentUser" class="btn-t btn-primary" :disabled="importing" @click="doImport">
        {{ importing ? t.importing : t.addToMyWishlist }}
      </button>
      <RouterLink v-else to="/" class="btn-t btn-outline" style="text-decoration:none;">{{ t.signInToImport }}</RouterLink>
      <RouterLink to="/" class="btn-t btn-outline" style="text-decoration:none;">{{ t.backToJournalBtn }}</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sb } from '../lib/supabase.js'
import { currentUser, useAuth } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { ATTRS, TYPE_BADGE_STYLE } from '../lib/constants.js'

const route = useRoute()
const router = useRouter()
const { getSession } = useAuth()
const { insertWhisky } = useWhiskies()
const { toast } = useToast()
const { t } = useI18n()

const typeBadgeStyle = TYPE_BADGE_STYLE
const whisky  = ref(null)
const loading = ref(true)
const importing = ref(false)

const details = computed(() => [
  { label: t.value.shareDetailLabels.distillery, val: whisky.value?.distillery },
  { label: t.value.shareDetailLabels.origin,     val: whisky.value?.origin },
  { label: t.value.shareDetailLabels.style,      val: t.value.types[whisky.value?.type] },
  { label: t.value.shareDetailLabels.age,        val: whisky.value?.age },
  { label: t.value.shareDetailLabels.price,      val: whisky.value?.price },
  { label: t.value.shareDetailLabels.date,       val: whisky.value?.date },
  { label: t.value.shareDetailLabels.nose,       val: whisky.value?.nose },
  { label: t.value.shareDetailLabels.palate,     val: whisky.value?.palate },
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
    await insertWhisky({ id: Date.now(), ...fields, list: 'wishlist' })
    toast(t.value.addedToWishlist(whisky.value.name))
    router.push({ path: '/', query: { list: 'wishlist' } })
  } catch (e) {
    toast(t.value.importFailed + e.message)
  } finally {
    importing.value = false
  }
}
</script>
