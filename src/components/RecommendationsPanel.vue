<template>
  <div v-if="recsLoading" class="recs-loading" role="status">{{ t.loading }}</div>
  <div v-else-if="recsError" class="recs-error" role="alert">
    {{ t.recsLoadFailed }}
    <button class="recs-retry" type="button" @click="load">{{ t.tryAgain }}</button>
  </div>
  <div v-else-if="recommendations.length > 0" class="recs-section">

    <div class="recs-header">
      <div class="recs-title"><SparklesIcon :size="13" style="display:inline;vertical-align:middle;margin-right:5px;" />{{ t.recsTitle }}</div>
      <div class="recs-sub">{{ t.recsSub }}</div>
    </div>

    <div class="recs-grid">
      <div v-for="(rec, i) in recommendations" :key="i" class="wcard rec-card">

        <img v-if="rec.photo_url" :src="rec.photo_url" :alt="rec.name" class="wcard-photo">

        <div class="wcard-body">
          <div class="wcard-meta-row">
            <span class="wcard-type" :class="`type-${rec.type}`">{{ t.types[rec.type] || rec.type }}</span>
          </div>
          <div class="wcard-distillery">{{ rec.distillery || '—' }}</div>
          <div class="wcard-name">{{ rec.name }}</div>
          <div v-if="rec.age" class="wcard-age">{{ rec.age }}</div>
          <div v-if="rec.price" class="rec-price">{{ rec.price }}</div>

          <div class="wcard-bars">
            <div v-for="a in ATTRS" :key="a" class="bar-row-s">
              <div class="bar-lbl-s">{{ t.attrs[a] }}</div>
              <div class="bar-track-s">
                <div class="bar-fill-s" :style="{ width: (rec[a] || 0) * 20 + '%' }"></div>
              </div>
              <div class="bar-val-s">{{ rec[a] || 0 }}</div>
            </div>
          </div>

          <div v-if="rec.reason" class="rec-reason">{{ rec.reason }}</div>
        </div>

        <div class="wcard-actions">
          <button class="wcard-btn" @click="addToWishlist(rec, i)" :disabled="addedIds.has(i) || addingIds.has(i)" :aria-busy="addingIds.has(i)">
            <CheckIcon v-if="addedIds.has(i)" :size="11" aria-hidden="true" /><HeartIcon v-else :size="11" aria-hidden="true" /> {{ addedIds.has(i) ? t.added : (addingIds.has(i) ? t.adding : t.addToWishlistBtn) }}
          </button>
        </div>

      </div>
    </div>

    <div class="recs-footer">{{ t.recsGenerated }} {{ generatedDate }}</div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { ATTRS, DEFAULTS } from '../lib/constants.js'
import { Heart as HeartIcon, Check as CheckIcon, Sparkles as SparklesIcon } from 'lucide-vue-next'

const { insertWhisky } = useWhiskies()
const { toast } = useToast()
const { t } = useI18n()

const recommendations = ref([])
const generatedAt     = ref(null)
const addedIds        = ref(new Set())
const addingIds       = ref(new Set())
const recsLoading     = ref(true)
const recsError       = ref(false)

const generatedDate = computed(() => {
  if (!generatedAt.value) return ''
  return new Date(generatedAt.value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
})

async function load() {
  recsLoading.value = true
  recsError.value = false
  try {
    if (!currentUser.value) return
    const { data, error } = await sb
      .from('recommendations')
      .select('payload, generated_at')
      .eq('user_id', currentUser.value.id)
      .maybeSingle()

    if (error) throw error
    if (data) {
      recommendations.value = data.payload ?? []
      generatedAt.value     = data.generated_at
    }
  } catch (e) {
    console.error('recommendations load failed:', e)
    recsError.value = true
  } finally {
    recsLoading.value = false
  }
}

onMounted(load)

async function addToWishlist(rec, index) {
  if (addingIds.value.has(index) || addedIds.value.has(index)) return
  addingIds.value = new Set([...addingIds.value, index])
  try {
    // Use catalogue_id + photo_url already enriched by the generate script.
    // Only fall back to a live lookup when the payload is missing them (e.g.
    // recommendations generated before the enrichment step was added).
    let catalogueId = rec.catalogue_id ?? null
    let photoUrl    = rec.photo_url    ?? null

    if (!catalogueId) {
      const { data } = await sb
        .from('catalogue')
        .select('id, photo_url')
        .ilike('name', rec.name.trim())
        .eq('distillery', rec.distillery || '')
        .maybeSingle()
      catalogueId = data?.id        ?? null
      photoUrl    = data?.photo_url ?? null
    }

    await insertWhisky({
      id:           Date.now(),
      name:         rec.name,
      distillery:   rec.distillery || '',
      origin:       rec.origin     || '',
      type:         rec.type       || 'other',
      age:          rec.age        || '',
      price:        rec.price      || '',
      notes:        rec.reason     || '',
      photo_url:    photoUrl,
      catalogue_id: catalogueId,
      list:         'wishlist',
      ...Object.fromEntries(ATTRS.map(a => [a, rec[a] ?? DEFAULTS[a]])),
    })
    addedIds.value = new Set([...addedIds.value, index])
    toast(t.value.whiskyAdded(rec.name))
  } catch (e) {
    console.error('add recommendation to wishlist failed:', e)
    toast('⚠ ' + t.value.actionFailed)
  } finally {
    addingIds.value = new Set([...addingIds.value].filter(i => i !== index))
  }
}
</script>

<style scoped>
.recs-section {
  padding: 0;
}
.recs-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.recs-header {
  margin-bottom: 1rem;
}
.recs-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber);
  margin-bottom: 4px;
}
.recs-sub {
  font-family: 'Inter', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light);
  font-style: italic;
}
.rec-card {
  background: rgba(200, 130, 42, 0.07) !important;
  border-color: var(--border-hi) !important;
}
.rec-card:hover {
  background: rgba(200, 130, 42, 0.12) !important;
  border-color: var(--amber) !important;
}
.rec-price {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.58rem;
  color: var(--amber-light);
  margin-top: 2px;
}
.rec-reason {
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.recs-loading, .recs-error {
  font-size: 0.75rem;
  color: var(--peat-light);
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.recs-error { color: var(--danger); }
.recs-retry {
  background: none;
  border: 0.5px solid var(--border-hi);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.75rem;
  padding: 6px 14px;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
}
.recs-retry:hover { border-color: var(--amber); color: var(--amber-light); }
.recs-footer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: var(--peat-light);
  text-align: right;
  padding: 0.5rem 0;
}

</style>