<template>
  <div v-if="loading" class="share-error">
    <div class="share-error-icon">✦</div>
    <div class="share-error-txt">Loading…</div>
  </div>

  <div v-else-if="!items.length" class="share-error">
    <div class="share-error-icon">✦</div>
    <div class="share-error-txt">This wishlist could not be found</div>
    <RouterLink to="/" style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--amber-light);margin-top:0.5rem;">← Back to The Dram Journal</RouterLink>
  </div>

  <div v-else>
    <div class="share-hero">
      <div class="share-brand">The <span>Dram</span> Journal</div>
      <div class="share-whisky-name" style="font-size:1.6rem;">✦ Wishlist</div>
      <div class="share-meta" style="margin-top:0.5rem;">
        <span style="font-family:'DM Mono',monospace;font-size:0.6rem;color:var(--peat-light);letter-spacing:0.1em;text-transform:uppercase;">
          {{ items.length }} {{ items.length === 1 ? 'bottle' : 'bottles' }}
          · shared {{ sharedDate }}
        </span>
      </div>
    </div>

    <div style="padding:1.5rem 2.5rem;">
      <div class="wl-grid">
        <div v-for="item in items" :key="item.id" class="wl-card">
          <img v-if="item.photo_url" class="wl-photo" :src="item.photo_url" :alt="item.name">
          <div class="wl-body">
            <span class="wcard-type" :class="`type-${item.type}`">{{ TYPE_LABELS[item.type] }}</span>
            <div class="wl-distillery">{{ item.distillery || '—' }}</div>
            <div class="wl-name">{{ item.name }}</div>
            <div v-if="item.age" class="wl-age">{{ item.age }}</div>
            <div v-if="item.notes" class="wl-notes">{{ item.notes }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="share-actions">
      <button v-if="currentUser" class="btn-t btn-primary" :disabled="importing" @click="doImportAll">
        {{ importing ? 'Importing…' : `✦ Add all ${items.length} to my Wishlist` }}
      </button>
      <RouterLink v-else to="/" class="btn-t btn-outline" style="text-decoration:none;">Sign in to import</RouterLink>
      <RouterLink to="/" class="btn-t btn-outline" style="text-decoration:none;">← Back to journal</RouterLink>
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
import { TYPE_LABELS } from '../lib/constants.js'

const route = useRoute()
const router = useRouter()
const { getSession } = useAuth()
const { insertWhisky } = useWhiskies()
const { toast } = useToast()

const items = ref([])
const loading = ref(true)
const importing = ref(false)
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

async function doImportAll() {
  if (!currentUser.value) return
  importing.value = true
  let added = 0
  try {
    for (const item of items.value) {
      const { id, user_id, created_at, ...fields } = item
      await insertWhisky({ id: Date.now() + added, ...fields, list: 'wishlist' })
      added++
    }
    toast(`✦ ${added} bottles added to your Wishlist!`)
    router.push({ path: '/', query: { list: 'wishlist' } })
  } catch (e) {
    toast('⚠ Import failed: ' + e.message)
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
  gap: 3px;
}
.wl-distillery {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  color: var(--peat-light);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-top: 4px;
}
.wl-name {
  font-family: 'Playfair Display', serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--cream);
}
.wl-age {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  color: var(--peat-light);
}
.wl-notes {
  font-family: 'DM Sans', sans-serif;
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

@media (max-width: 680px) {
  .wl-grid { grid-template-columns: 1fr; }
}
</style>
