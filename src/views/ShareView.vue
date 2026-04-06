<template>
  <div v-if="loading" class="share-error">
    <div class="share-error-icon"><GlassWaterIcon :size="36" /></div>
    <div class="share-error-txt">{{ t.loading }}</div>
  </div>

  <div v-else-if="!whisky" class="share-error">
    <div class="share-error-icon"><GlassWaterIcon :size="36" /></div>
    <div class="share-error-txt">{{ t.dramNotFound }}</div>
    <RouterLink to="/" style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--amber-light);margin-top:0.5rem;">{{ t.backToJournal }}</RouterLink>
  </div>

  <div v-else>
    <!-- Brand header -->
    <div class="share-brand-bar">The <span>Dram</span> Journal</div>

    <div class="share-container">
      <!-- Title -->
      <div class="share-title-bar">
        <div class="share-whisky-name">{{ whisky.name }}</div>
        <div class="share-meta">
          <span class="cm-badge" :style="typeBadgeStyle[whisky.type] || typeBadgeStyle.other">{{ t.types[whisky.type] }}</span>
          <span v-if="whisky.distillery" class="share-distillery">{{ whisky.distillery }}</span>
          <span v-if="whisky.origin" class="share-distillery" style="opacity:0.5">· {{ whisky.origin }}</span>
        </div>
      </div>

      <!-- Three-column layout: photo | details | flavour profile -->
      <div class="share-three-col">
        <!-- Col 1: Photo -->
        <div v-if="whisky.photo_url" class="share-col-photo">
          <div class="share-photo-wrap">
            <img :src="whisky.photo_url" :alt="whisky.name" class="share-photo">
          </div>
        </div>

        <!-- Col 2: Details -->
        <div class="share-col-details">
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

        <!-- Col 3: Flavour profile -->
        <div class="share-col-flavour">
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

      <!-- Actions -->
      <div class="share-actions">
        <button v-if="currentUser" class="btn-t btn-primary" :disabled="importing" @click="doImport">
          {{ importing ? t.importing : t.addToMyWishlist }}
        </button>
        <RouterLink v-else to="/" class="btn-t btn-outline" style="text-decoration:none;">{{ t.signInToImport }}</RouterLink>
        <RouterLink to="/" class="btn-t btn-outline" style="text-decoration:none;">{{ t.backToJournalBtn }}</RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GlassWater as GlassWaterIcon } from 'lucide-vue-next'
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

// Prevent search engines from indexing shared dram pages
const noindexMeta = document.createElement('meta')
noindexMeta.name = 'robots'
noindexMeta.content = 'noindex, nofollow'
document.head.appendChild(noindexMeta)
onUnmounted(() => document.head.removeChild(noindexMeta))

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

<style scoped>
.share-brand-bar {
  padding: 14px 24px;
  border-bottom: 0.5px solid var(--border);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  color: var(--text-primary);
  margin-bottom: 0;
}
.share-brand-bar span { color: var(--amber-light); }

.share-container {
  width: 70%;
  max-width: 900px;
  margin: 40px auto;
  border: 0.5px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  background: var(--bg-modal);
}
.share-title-bar {
  padding: 20px 24px 16px;
  border-bottom: 0.5px solid var(--border);
}
.share-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.cm-badge {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 20px;
}
.share-distillery {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-secondary);
}
.share-whisky-name {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.share-three-col {
  display: grid;
  grid-template-columns: 160px 1fr 1fr;
  gap: 0;
  align-items: start;
}
.share-col-photo {
  padding: 20px 12px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  border-right: 0.5px solid var(--border);
}
.share-photo-wrap {
  background: var(--bg-input);
  border-radius: 10px;
  border: 0.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 2/3;
}
.share-photo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.share-col-details {
  padding: 20px 16px 20px 20px;
  border-right: 0.5px solid var(--border);
}
.share-col-flavour {
  padding: 20px 20px 20px 16px;
}
.share-actions {
  padding: 16px 20px;
  border-top: 0.5px solid var(--border);
  display: flex;
  gap: 8px;
}

@media (max-width: 700px) {
  .share-container {
    width: 100%;
    margin: 0;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
  }
  .share-three-col {
    grid-template-columns: 1fr;
  }
  .share-col-photo {
    border-right: none;
    border-bottom: 0.5px solid var(--border);
    padding: 16px;
  }
  .share-photo-wrap {
    aspect-ratio: unset;
    height: 200px;
  }
  .share-col-details {
    border-right: none;
    border-bottom: 0.5px solid var(--border);
    padding: 16px;
  }
  .share-col-flavour { padding: 16px; }
  .share-title-bar { padding: 16px; }
}
</style>