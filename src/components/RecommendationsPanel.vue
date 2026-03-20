<template>
  <div v-if="recommendations.length > 0" class="recs-section">
    <div class="recs-header">
      <div class="recs-title">✦ {{ t.recsTitle }}</div>
      <div class="recs-sub">{{ t.recsSub }}</div>
    </div>

    <div class="recs-grid">
      <div v-for="(rec, i) in recommendations" :key="i" class="rec-card">
        <div class="rec-card-top">
          <div>
            <span class="wcard-type" :class="`type-${rec.type}`">{{ t.types[rec.type] || rec.type }}</span>
            <div class="rec-distillery">{{ rec.distillery || '—' }}</div>
            <div class="rec-name">{{ rec.name }}</div>
            <div v-if="rec.age" class="rec-age">{{ rec.age }}</div>
            <div v-if="rec.price" class="rec-price">{{ rec.price }}</div>
          </div>
        </div>

        <div class="rec-bars">
          <div v-for="a in ATTRS" :key="a" class="bar-row-s">
            <div class="bar-lbl-s">{{ t.attrs[a] }}</div>
            <div class="bar-track-s">
              <div class="bar-fill-s" :style="{ width: (rec[a] || 0) * 20 + '%' }"></div>
            </div>
            <div class="bar-val-s">{{ rec[a] || 0 }}</div>
          </div>
        </div>

        <div v-if="rec.reason" class="rec-reason">{{ rec.reason }}</div>

        <div class="rec-actions">
          <button class="wcard-btn rec-btn-wishlist" @click="addToWishlist(rec)">
            {{ addedIds.has(i) ? '✓ ' + t.added : '✦ ' + t.addToWishlistBtn }}
          </button>
        </div>
      </div>
    </div>

    <div class="recs-footer">
      {{ t.recsGenerated }} {{ generatedDate }}
    </div>
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
    await insertWhisky({
      id:         Date.now(),
      name:       rec.name,
      distillery: rec.distillery || '',
      origin:     rec.origin     || '',
      type:       rec.type       || 'other',
      age:        rec.age        || '',
      price:      rec.price      || '',
      notes:      rec.reason     || '',
      list:       'wishlist',
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
  padding: 2rem 2.5rem 0;
  border-top: 0.5px solid var(--border);
}
.recs-header {
  margin-bottom: 1.2rem;
}
.recs-title {
  font-family: 'DM Mono', monospace;
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber);
  margin-bottom: 4px;
}
.recs-sub {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light);
  font-style: italic;
}
.recs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin-bottom: 1rem;
}
.rec-card {
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 14px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s;
}
.rec-card:hover {
  border-color: var(--border-hi);
}
.rec-card-top {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.rec-distillery {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: var(--peat-light);
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.rec-name {
  font-family: 'Playfair Display', serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--cream);
}
.rec-age {
  font-family: 'DM Mono', monospace;
  font-size: 0.56rem;
  color: var(--peat-light);
  margin-top: 2px;
}
.rec-price {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  color: var(--amber-light);
  margin-top: 2px;
}
.rec-reason {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.74rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.5;
}
.rec-actions {
  margin-top: auto;
}
.rec-btn-wishlist {
  width: 100%;
  padding: 6px 0;
}
.rec-btn-wishlist:hover {
  border-color: var(--amber);
  color: var(--amber-light);
}
.recs-footer {
  font-family: 'DM Mono', monospace;
  font-size: 0.55rem;
  letter-spacing: 0.08em;
  color: var(--peat-light);
  text-align: right;
  padding-bottom: 1.5rem;
}

@media (max-width: 600px) {
  .recs-section { padding: 1.5rem 1.2rem 0; }
  .recs-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 400px) {
  .recs-grid { grid-template-columns: 1fr; }
}
</style>
