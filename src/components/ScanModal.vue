<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal scan-modal">

      <div class="modal-header">
        <div class="modal-title">{{ t.scanBottle }}</div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Step 1: pick image -->
      <div v-if="step === 'pick'">
        <div class="scan-drop" :class="{ 'scan-drop--hover': dragging }"
          @click="fileInput.click()"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="onDrop">
          <div class="scan-drop-icon">📷</div>
          <div class="scan-drop-label">{{ t.tapToPhoto }}</div>
          <div class="scan-drop-hint">{{ t.orDragDrop }}</div>
        </div>
        <div class="scan-quota">{{ t.scansRemaining(Math.max(0, DAILY_CAP - scansToday), DAILY_CAP) }}</div>
        <input ref="fileInput" type="file" accept="image/*"
          style="display:none" @change="onFileChange" />
      </div>

      <!-- Step 2: preview + confirm -->
      <div v-else-if="step === 'preview'">
        <img :src="previewSrc" class="scan-preview" />
        <div class="scan-actions">
          <button class="btn-auth" @click="analyse">{{ t.identifyWhisky }}</button>
          <button class="btn-cancel" @click="reset">{{ t.retake }}</button>
        </div>
      </div>

      <!-- Step 3: analysing -->
      <div v-else-if="step === 'loading'" class="scan-loading">
        <div class="scan-spinner"></div>
        <div class="scan-loading-text">{{ t.analysingBottle }}</div>
        <div class="scan-loading-sub">{{ t.isReading(MODEL_LABELS[ACTIVE_MODEL]) }}</div>
      </div>

      <!-- Step 4: result -->
      <div v-else-if="step === 'result'">

        <!-- Identified header -->
        <div class="scan-result-header">
          <span class="scan-tick">✓</span> {{ t.whiskyIdentified }}
          <span class="scan-model-badge">{{ MODEL_LABELS[ACTIVE_MODEL] }}</span>
        </div>

        <!-- Catalogue picked — show locked card -->
        <div v-if="cataloguePicked" class="scan-picked-card">
          <div class="scan-picked-thumb">
            <img v-if="cataloguePicked.photo_url" :src="cataloguePicked.photo_url" :alt="cataloguePicked.name" class="scan-picked-img">
            <div v-else class="scan-picked-placeholder">🥃</div>
          </div>
          <div class="scan-picked-info">
            <div class="scan-picked-name">{{ cataloguePicked.name }}</div>
            <div class="scan-picked-meta">{{ cataloguePicked.distillery }} · {{ cataloguePicked.country }}</div>
          </div>
          <button class="scan-picked-change" @click="cataloguePicked = null">↩</button>
        </div>

        <!-- Catalogue matches -->
        <template v-else>
          <div v-if="catalogue.searching.value" class="scan-cat-searching">{{ t.searching || 'Searching catalogue…' }}</div>
          <template v-else-if="catalogue.results.value.length">
            <div class="scan-cat-hint">{{ t.scanMatchHint || 'Select the matching bottle:' }}</div>
            <div class="scan-cat-list">
              <div
                v-for="item in catalogue.results.value"
                :key="item.id"
                class="cs-item"
                @click="cataloguePicked = item"
              >
                <div class="cs-thumb">
                  <img v-if="item.photo_url" :src="item.photo_url" :alt="item.name" class="cs-img">
                  <div v-else class="cs-img-placeholder">🥃</div>
                </div>
                <div class="cs-info">
                  <div class="cs-name">{{ item.name }}</div>
                  <div class="cs-meta">
                    <span v-if="item.distillery">{{ item.distillery }}</span>
                    <span v-if="item.country" class="cs-dot">·</span>
                    <span v-if="item.country">{{ item.country }}</span>
                    <span v-if="item.type" class="cs-badge" :class="`type-${item.type}`">{{ t.types?.[item.type] }}</span>
                  </div>
                  <div class="cs-sub" v-if="item.age || item.abv">
                    <span v-if="item.age">{{ item.age }}</span>
                    <span v-if="item.age && item.abv" class="cs-dot">·</span>
                    <span v-if="item.abv">{{ item.abv }}</span>
                  </div>
                </div>
                <span class="cs-arrow">›</span>
              </div>
            </div>
          </template>
          <div v-else class="scan-cat-none">{{ t.scanNoMatch || 'No catalogue match — will save with scanned data.' }}</div>
        </template>

        <!-- Actions -->
        <div class="scan-actions">
          <button class="btn-auth" :disabled="saving" @click="save">
            {{ saving ? t.saving : t.addToList(props.list) }}
          </button>
          <button class="btn-cancel" @click="reset">{{ t.scanAgain }}</button>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="step === 'error'" class="scan-error">
        <div class="scan-error-icon">⚠</div>
        <div class="scan-error-msg">{{ errorMsg }}</div>
        <button class="btn-cancel" style="margin-top:1rem" @click="reset">{{ t.tryAgain }}</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { DEFAULTS, ATTRS } from '../lib/constants.js'
import { sb } from '../lib/supabase.js'
import { currentUser } from '../composables/useAuth.js'
import { compressImage } from '../utils/compressImage.js'
import { useI18n } from '../composables/useI18n.js'
import { useCatalogue, cleanSearchQuery } from '../composables/useCatalogue.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useToast } from '../composables/useToast.js'

const emit = defineEmits(['close', 'identified'])

const props = defineProps({ list: { type: String, default: 'journal' } })

const { t } = useI18n()
const { insertWhisky } = useWhiskies()
const { toast } = useToast()
const catalogue = useCatalogue()

const saving         = ref(false)
const cataloguePicked = ref(null)  // set when user picks from catalogue matches

const DAILY_CAP = 20

// ── Model selection ───────────────────────────────────────────────────────────
// Toggle between: 'gemma'  → Gemma 3 27B (file-upload path)
//                 'gemini' → Gemini 3.1 Flash Lite (inline b64 path)
const ACTIVE_MODEL = 'gemma' // 'gemma' | 'gemini'

const MODEL_LABELS = {
  gemma:  'Gemma 3 27B',
  gemini: 'Gemini 3.1 Flash Lite',
}

const step       = ref('pick')
const dragging   = ref(false)
const previewSrc = ref(null)
const imageFile  = ref(null)   // kept for Gemma upload
const imageB64   = ref(null)   // kept for Gemini inline
const imageMime  = ref('image/jpeg')
const result     = ref({})
const errorMsg   = ref('')
const fileInput  = ref(null)
const scansToday = ref(0)

const EDGE_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gemini-proxy`

// ── Quota tracking ────────────────────────────────────────────────────────────

async function fetchScansToday() {
  const today = new Date().toISOString().split('T')[0]
  const { count } = await sb
    .from('scan_log')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.value.id)
    .gte('created_at', today)
  scansToday.value = count ?? 0
}

async function incrementScans() {
  await sb.from('scan_log').insert({ user_id: currentUser.value.id })
  scansToday.value += 1
}

fetchScansToday()

// ── Display ───────────────────────────────────────────────────────────────────

const displayResult = computed(() => {
  const r = result.value
  const out = {}
  if (r.name)       out.name       = r.name
  if (r.distillery) out.distillery = r.distillery
  if (r.origin)     out.origin     = r.origin
  if (r.type)       out.type       = r.type
  if (r.age)        out.age        = r.age
  return out
})

function reset() {
  step.value       = 'pick'
  previewSrc.value = null
  imageFile.value  = null
  imageB64.value   = null
  result.value     = {}
  errorMsg.value   = ''
}

// ── File loading ──────────────────────────────────────────────────────────────

function onDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) loadFile(file)
}

function onFileChange(e) {
  const file = e.target.files[0]
  if (file) loadFile(file)
  e.target.value = ''
}

function loadFile(file) {
  imageMime.value = 'image/jpeg' // always JPEG after compression
  const reader = new FileReader()
  reader.onload = (ev) => { previewSrc.value = ev.target.result }
  reader.readAsDataURL(file)

  // Compress to max 1024px / 0.82 quality before sending to AI
  // This significantly reduces token usage while keeping labels readable
  compressImage(file, 1024, 0.82).then(({ blob, dataUrl, kb }) => {
    imageFile.value = new File([blob], 'scan.jpg', { type: 'image/jpeg' })
    imageB64.value  = dataUrl.split(',')[1]
    console.debug(`[scan] compressed to ${kb}KB`)
  })

  step.value = 'preview'
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const PROMPT = `You are a whisky expert. Analyse this bottle label image and extract all the information you can see.

IMPORTANT: For "nose" and "palate", you MUST use your whisky knowledge to fill these in based on the distillery, age, type and region — even if they are not written on the label. For example, an Islay Scotch will have smoky/peaty notes, a Speyside will have fruity/floral notes, a Bourbon will have vanilla/caramel notes. Never leave nose or palate empty.

Respond ONLY with a valid JSON object — no explanation, no markdown, no backticks. Use exactly these keys:
{
  "name": "full whisky name including age statement if on label",
  "distillery": "distillery name",
  "origin": "region and country e.g. Speyside, Scotland",
  "type": one of: "scotch" | "irish" | "bourbon" | "japanese" | "other",
  "age": "age statement or maturation info e.g. 12 Years Old / Sherry Cask",
  "abv": "ABV percentage e.g. 46%",
  "nose": "2-4 tasting notes for the nose based on your whisky knowledge e.g. Vanilla, honey, light oak",
  "palate": "2-4 tasting notes for the palate based on your whisky knowledge e.g. Sweet malt, dried fruit, warm spice",
  "notes": "any other interesting details from the label",
  "dulzor": sweetness score 0-5 integer,
  "ahumado": smokiness score 0-5 integer,
  "cuerpo": body score 0-5 integer,
  "frutado": fruitiness score 0-5 integer,
  "especiado": spiciness score 0-5 integer
}

If you cannot read the label clearly or identify the whisky, set name to "Unknown" and fill what you can.`

// ── API calls ─────────────────────────────────────────────────────────────────

async function edgeCall(body) {
  const { data: { session } } = await sb.auth.getSession()
  const res = await fetch(EDGE_FN_URL, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) handleApiError(res.status, { error: { message: data.error } })
  return data
}

async function callGemma() {
  // Step 1: upload file via Edge Function
  const binary = await imageFile.value.arrayBuffer()
  // Avoid spread operator on large arrays — blows the call stack on mobile
  const bytes  = new Uint8Array(binary)
  let b64str   = ''
  const chunk  = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    b64str += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const b64 = btoa(b64str)

  const { fileUri } = await edgeCall({
    action: 'upload-file', model: 'gemma-3-27b-it',
    imageB64: b64, imageMime: imageMime.value, prompt: PROMPT,
  })
  if (!fileUri) throw new Error('Upload did not return a file URI')

  // Step 2: generate from uploaded file
  const { text } = await edgeCall({
    action: 'generate-file', model: 'gemma-3-27b-it',
    fileUri, imageMime: imageMime.value, prompt: PROMPT,
  })
  return text || ''
}

async function callGeminiFlashLite() {
  const { text } = await edgeCall({
    action: 'generate-inline', model: 'gemini-3.1-flash-lite-preview',
    imageB64: imageB64.value, imageMime: imageMime.value, prompt: PROMPT,
  })
  return text || ''
}
function handleApiError(status, data) {
  const msg = data.error?.message || 'API error'
  if (status === 400 || status === 403) throw new Error('API configuration error. Please contact support.')
  if (status === 429 || msg.includes('quota') || msg.includes('Quota'))
    throw new Error('Quota exceeded. Enable billing at console.cloud.google.com or try again later.')
  throw new Error(msg)
}

// Build a multipart/related body for the file upload
async function buildMultipartBody(file) {
  const meta = JSON.stringify({ file: { display_name: 'bottle' } })
  const boundary = 'dj_boundary'
  const enc = new TextEncoder()
  const fileBytes = await file.arrayBuffer()

  const parts = [
    enc.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${meta}\r\n`),
    enc.encode(`--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`),
    new Uint8Array(fileBytes),
    enc.encode(`\r\n--${boundary}--`),
  ]

  const total = parts.reduce((n, p) => n + p.byteLength, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const p of parts) { merged.set(p, offset); offset += p.byteLength }
  return merged
}

// ── Parse & build result ──────────────────────────────────────────────────────

function parseModelText(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not read the label. Try a clearer photo.')
  try { return JSON.parse(match[0]) } catch {
    try { return JSON.parse(match[0] + '"}') } catch {
      throw new Error('Could not parse label data. Try a clearer photo.')
    }
  }
}

// ── Main analyse ──────────────────────────────────────────────────────────────

async function analyse() {
  if (!imageB64.value || !imageFile.value) {
    errorMsg.value = t.value.imageProcessing
    step.value = 'error'
    return
  }
  if (scansToday.value >= DAILY_CAP) {
    errorMsg.value = t.value.dailyLimitReached(DAILY_CAP)
    step.value = 'error'
    return
  }

  step.value = 'loading'
  try {
    const text = ACTIVE_MODEL === 'gemma' ? await callGemma() : await callGeminiFlashLite()
    const parsed = parseModelText(text)

    const abv = parsed.abv || ''
    result.value = {
      name:       parsed.name       || '',
      distillery: parsed.distillery || '',
      origin:     parsed.origin     || '',
      type:       parsed.type       || 'scotch',
      age:        parsed.age        ? `${parsed.age}${abv ? ' · ' + abv : ''}` : abv,
      nose:       parsed.nose       || '',
      palate:     parsed.palate     || '',
      notes:      parsed.notes      || '',
      dulzor:     parsed.dulzor     ?? DEFAULTS.dulzor,
      ahumado:    parsed.ahumado    ?? DEFAULTS.ahumado,
      cuerpo:     parsed.cuerpo     ?? DEFAULTS.cuerpo,
      frutado:    parsed.frutado    ?? DEFAULTS.frutado,
      especiado:  parsed.especiado  ?? DEFAULTS.especiado,
    }
    step.value = 'result'
    await incrementScans()

    // Auto-search catalogue with cleaned name
    cataloguePicked.value = null
    const q = cleanSearchQuery(result.value.name || '')
    if (q.length >= 2) {
      await catalogue.search(q)
    }

  } catch (e) {
    errorMsg.value = e.message || 'Could not identify the bottle. Try a clearer photo.'
    step.value = 'error'
  }
}

async function save() {
  saving.value = true
  try {
    const id = Date.now()
    const picked = cataloguePicked.value

    await insertWhisky({
      id,
      name:         picked?.name        || result.value.name        || '',
      distillery:   picked?.distillery  || result.value.distillery  || '',
      origin:       picked?.country     || result.value.origin      || '',
      region:       picked?.region      || '',
      type:         picked?.type        || result.value.type        || 'other',
      age:          picked?.age         || result.value.age         || '',
      price:        picked?.price_band  || '',
      photo_url:    picked?.photo_url   || null,
      catalogue_id: picked?.id          || null,
      nose:         picked?.nose        || result.value.nose        || '',
      palate:       picked?.palate      || result.value.palate      || '',
      notes:        '',
      rating:       0,
      date:         new Date().toISOString().split('T')[0],
      list:         props.list,
      ...Object.fromEntries(ATTRS.map(a => [a, picked?.[a] ?? result.value[a] ?? DEFAULTS[a]])),
    })

    emit('close')
    toast('✦ ' + (picked?.name || result.value.name) + ' added')
  } catch (e) {
    toast('⚠ ' + e.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.scan-modal { max-width: 420px; }

.scan-drop {
  border: 1.5px dashed var(--border-hi);
  border-radius: 12px;
  padding: 3rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-card);
}
.scan-drop:hover, .scan-drop--hover {
  border-color: var(--amber);
  background: rgba(200,130,42,0.06);
}
.scan-drop-icon  { font-size: 2.8rem; margin-bottom: 0.75rem; }
.scan-drop-label { font-family: 'DM Sans', sans-serif; font-size: 0.95rem; color: var(--text-primary); margin-bottom: 0.3rem; }
.scan-drop-hint  { font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.1em; color: var(--peat-light); text-transform: uppercase; }

.scan-quota {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--peat-light);
  text-align: center;
  margin-top: 0.75rem;
}

.scan-preview {
  width: 100%;
  max-height: 260px;
  object-fit: cover;
  border-radius: 10px;
  border: 0.5px solid var(--border);
  display: block;
  margin-bottom: 1rem;
}

.scan-actions {
  display: flex;
  gap: 10px;
  margin-top: 0.5rem;
}
.scan-actions .btn-auth { flex: 1; margin-top: 0; }

.scan-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 1rem;
  gap: 1rem;
}
.scan-spinner {
  width: 40px; height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.scan-loading-text { font-family: 'Playfair Display', serif; font-size: 1.1rem; }
.scan-loading-sub  { font-family: 'DM Mono', monospace; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; color: var(--peat-light); }

.scan-result-header {
  font-family: 'DM Mono', monospace;
  font-size: 0.65rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: #1D9E75;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}
.scan-tick { font-size: 1rem; }
.scan-model-badge {
  margin-left: auto;
  font-size: 0.52rem;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(200,130,42,0.12);
  color: var(--amber-light);
  letter-spacing: 0.08em;
  border: 0.5px solid var(--border);
}

.scan-fields {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}
.scan-field {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 8px 14px;
  border-bottom: 0.5px solid var(--border);
  gap: 1rem;
}
.scan-field:last-child { border-bottom: none; }
.scan-field-lbl {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--peat-light);
  flex-shrink: 0;
}
.scan-field-val {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.85rem;
  color: var(--text-primary);
  text-align: right;
}

.scan-notes {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.78rem;
  color: var(--peat-light);
  font-style: italic;
  line-height: 1.6;
  margin-bottom: 1rem;
  padding: 10px 14px;
  background: var(--bg-card);
  border-radius: 8px;
  border: 0.5px solid var(--border);
}

.scan-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2.5rem 1rem;
  gap: 0.75rem;
}
.scan-error-icon { font-size: 2rem; opacity: 0.4; }
.scan-error-msg  { font-family: 'DM Mono', monospace; font-size: 0.65rem; letter-spacing: 0.08em; color: var(--peat-light); text-align: center; line-height: 1.6; }
/* ── Catalogue match styles ── */
.scan-cat-hint {
  font-size: 0.75rem;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-bottom: 8px;
}
.scan-cat-none {
  font-size: 0.78rem;
  color: var(--text-secondary);
  opacity: 0.5;
  text-align: center;
  padding: 12px 0;
  font-style: italic;
}
.scan-cat-searching {
  font-size: 0.78rem;
  color: var(--text-secondary);
  opacity: 0.5;
  text-align: center;
  padding: 12px 0;
}
.scan-cat-list {
  max-height: 220px;
  overflow-y: auto;
  margin-bottom: 12px;
}

/* Picked card */
.scan-picked-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-card);
  border: 0.5px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 12px;
}
.scan-picked-thumb {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 0.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
}
.scan-picked-img { width: 100%; height: 100%; object-fit: contain; }
.scan-picked-placeholder { font-size: 1.2rem; opacity: 0.4; }
.scan-picked-info { flex: 1; min-width: 0; }
.scan-picked-name {
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.scan-picked-meta {
  font-size: 0.72rem;
  color: var(--text-secondary);
  opacity: 0.6;
  margin-top: 2px;
}
.scan-picked-change {
  background: none;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 1rem;
  padding: 4px 8px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.15s;
}
.scan-picked-change:hover { opacity: 1; }

/* cs-* item styles for catalogue list */
.cs-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 6px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.cs-item:hover { background: var(--bg-card); }
.cs-thumb {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  border: 0.5px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-input);
}
.cs-img { width: 100%; height: 100%; object-fit: contain; }
.cs-img-placeholder { font-size: 1rem; opacity: 0.4; }
.cs-info { flex: 1; min-width: 0; }
.cs-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cs-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  font-size: 0.7rem;
  color: var(--text-secondary);
  opacity: 0.65;
}
.cs-dot { opacity: 0.4; }
.cs-sub { font-size: 0.68rem; color: var(--text-secondary); opacity: 0.5; margin-top: 1px; }
.cs-badge {
  font-family: 'DM Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 1px 5px;
  border-radius: 20px;
}
.cs-arrow { color: var(--text-secondary); opacity: 0.25; font-size: 1.1rem; flex-shrink: 0; }

</style>