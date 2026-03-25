<template>
  <div v-if="recommendations.length > 0" class="recs-section">

    <div class="recs-header">
      <div class="recs-title">✦ {{ t.recsTitle }}</div>
      <div class="recs-sub">{{ t.recsSub }}</div>
    </div>

    <div class="whisky-grid">
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
          <button class="wcard-btn" @click="addToWishlist(rec, i)" :disabled="addedIds.has(i)">
            <CheckIcon v-if="addedIds.has(i)" :size="11" /><HeartIcon v-else :size="11" /> {{ addedIds.has(i) ? t.added : t.addToWishlistBtn }}
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
import { Heart as HeartIcon, Check as CheckIcon } from 'lucide-vue-next'

const { insertWhisky } = useWhiskies()
const { toast } = useToast()
const { t } = useI18n()

const recommendations = ref([])
const generatedAt     = ref(null)
const addedIds        = ref(new Set())

const generatedDate = computed(() => {
  if (!generatedAt.value) return ''
  return new Date(generatedAt.value).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric'
  })
})

onMounted(async () => {
  if (!currentUser.value) return
  const { data, error } = await sb
    .from('recommendations')
    .select('payload, generated_at')
    .eq('user_id', currentUser.value.id)
    .maybeSingle()

  if (!error && data) {
    recommendations.value = data.payload ?? []
    generatedAt.value     = data.generated_at
  }
})

async function addToWishlist(rec, index) {
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
    toast('✦ ' + rec.name + ' ' + t.value.addedToWishlist(rec.name).replace(rec.name, '').trim())
  } catch (e) {
    toast('⚠ ' + e.message)
  }
}
</script>

<style scoped>
.recs-section {
  padding: 1.8rem 2.5rem 0;
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
  font-size: 0.74rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.5;
}
.recs-footer {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: var(--peat-light);
  text-align: right;
  padding: 0.5rem 0;
}
@media (max-width: 600px) {
  .recs-section { padding: 1.2rem 1.2rem 0; }
}
</style>
