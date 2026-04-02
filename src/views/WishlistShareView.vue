<template>
  <div v-if="loading" class="share-error">
    <div class="share-error-icon"><SparklesIcon :size="36" /></div>
    <div class="share-error-txt">{{ t.loading }}</div>
  </div>

  <div v-else-if="!items.length" class="share-error">
    <div class="share-error-icon"><SparklesIcon :size="36" /></div>
    <div class="share-error-txt">{{ t.wishlistNotFound }}</div>
    <RouterLink to="/" style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--amber-light);margin-top:0.5rem;">{{ t.backToJournal }}</RouterLink>
  </div>

  <div v-else>
    <div class="share-hero">
      <div class="share-brand">The <span>Dram</span> Journal</div>
      <div class="share-whisky-name" style="font-size:1.6rem;"><SparklesIcon :size="18" style="display:inline;vertical-align:middle;margin-right:6px;" />{{ t.wishlist }}</div>
      <div class="share-meta" style="margin-top:0.5rem;">
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.6rem;color:var(--peat-light);letter-spacing:0.1em;text-transform:uppercase;">
          {{ items.length }} {{ items.length === 1 ? t.bottle : t.bottles }}
          · {{ t.shared }} {{ sharedDate }}
        </span>
      </div>
    </div>

    <div style="padding:1.5rem 2.5rem;">
      <div class="wl-grid">
        <div v-for="item in items" :key="item.id" class="wl-card">
          <img v-if="item.photo_url" class="wl-photo" :src="item.photo_url" :alt="item.name">
          <div class="wl-body">
            <span class="wcard-type" :class="`type-${item.type}`">{{ t.types[item.type] }}</span>
            <div class="wl-distillery">{{ item.distillery || '—' }}</div>
            <div class="wl-name">{{ item.name }}</div>
            <div v-if="item.age" class="wl-age">{{ item.age }}</div>
            <div v-if="item.notes" class="wl-notes">{{ item.notes }}</div>
          </div>
          <div v-if="currentUser" class="wl-card-action">
            <button
              class="wcard-btn"
              :disabled="importedIds.has(item.id)"
              @click="doImportOne(item)"
            >
              {{ importedIds.has(item.id) ? t.added : t.addToMyWishlistOne }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="share-actions">
      <button v-if="currentUser" class="btn-t btn-primary" :disabled="importing" @click="doImportAll">
        {{ importing ? t.importing : t.addAllTo(items.length) }}
      </button>
      <RouterLink v-else to="/" class="btn-t btn-outline" style="text-decoration:none;">{{ t.signInToImport }}</RouterLink>
      <RouterLink to="/" class="btn-t btn-outline" style="text-decoration:none;">{{ t.backToJournalBtn }}</RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Sparkles as SparklesIcon, GlassWater as GlassWaterIcon } from 'lucide-vue-next'
import { sb } from '../lib/supabase.js'
import { currentUser, useAuth } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'

const route = useRoute()
const router = useRouter()
const { getSession } = useAuth()
const { insertWhisky } = useWhiskies()
const { toast } = useToast()
const { t } = useI18n()

const items = ref([])
const loading = ref(true)
const importing = ref(false)
const importedIds = ref(new Set())
const sharedAt = ref(null)

const sharedDate = computed(() => {
  if (!sharedAt.value) return ''
  return new Date(sharedAt.value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
})

onMounted(async () => {
  await getSession()
  const { data, error } = await sb
    .from('shared_wishlists')
    .select('payload')
    .eq('share_id', route.params.id)
    .single()
  if (!error && data?.payload) {
    items.value = data.payload.items ?? []
    sharedAt.value = data.payload.shared_at ?? null
  }
  loading.value = false
})

async function doImportOne(item) {
  if (!currentUser.value) return
  const { id, user_id, created_at, ...fields } = item
  try {
    await insertWhisky({ id: Date.now(), ...fields, list: 'wishlist' })
    importedIds.value = new Set([...importedIds.value, item.id])
    toast(t.value.addedToWishlist(item.name))
  } catch (e) {
    toast(t.value.importFailed + e.message)
  }
}

async function doImportAll() {
  if (!currentUser.value) return
  importing.value = true
  let added = 0
  try {
    for (const item of items.value) {
      if (importedIds.value.has(item.id)) continue
      const { id, user_id, created_at, ...fields } = item
      await insertWhisky({ id: Date.now() + added, ...fields, list: 'wishlist' })
      importedIds.value = new Set([...importedIds.value, item.id])
      added++
    }
    toast(t.value.addedAllToWishlist(added))
    router.push({ path: '/', query: { list: 'wishlist' } })
  } catch (e) {
    toast(t.value.importFailed + e.message)
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
.wl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}
.wl-card {
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.wl-photo {
  width: 100%;
  height: 140px;
  object-fit: cover;
  display: block;
  border-bottom: 0.5px solid var(--border);
}
.wl-body {
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  flex: 1;
}
.wl-distillery {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.56rem;
  color: var(--peat-light);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 4px;
}
.wl-name {
  font-family: 'Inter', sans-serif; font-weight: 600; letter-spacing: -0.01em;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--cream);
}
.wl-age {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.56rem;
  color: var(--peat-light);
}
.wl-notes {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.5;
  margin-top: 4px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.wl-card-action {
  padding: 0 1rem 0.8rem;
}
.wl-card-action .wcard-btn {
  width: 100%;
  padding: 6px 0;
}
.wcard-btn:disabled {
  border-color: #1D9E75;
  color: #6ecb9a;
  cursor: default;
  opacity: 0.8;
}

@media (max-width: 680px) {
  .wl-grid { grid-template-columns: 1fr; }
}
</style>
