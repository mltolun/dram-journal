<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal scan-modal">

      <div class="modal-header">
        <div class="modal-title">Scan <span>bottle</span></div>
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
          <div class="scan-drop-label">Tap to take / choose photo</div>
          <div class="scan-drop-hint">or drag & drop</div>
        </div>
        <div class="scan-quota">{{ DAILY_CAP - scansToday }} of {{ DAILY_CAP }} scans remaining today</div>
        <input ref="fileInput" type="file" accept="image/*"
          style="display:none" @change="onFileChange" />
      </div>

      <!-- Step 2: preview + confirm -->
      <div v-else-if="step === 'preview'">
        <img :src="previewSrc" class="scan-preview" />
        <div class="scan-actions">
          <button class="btn-auth" @click="analyse">🔍 Identify whisky</button>
          <button class="btn-cancel" @click="reset">Retake</button>
        </div>
      </div>

      <!-- Step 3: analysing -->
      <div v-else-if="step === 'loading'" class="scan-loading">
        <div class="scan-spinner"></div>
        <div class="scan-loading-text">Analysing bottle…</div>
        <div class="scan-loading-sub">{{ USE_GEMMA ? 'Gemma 3 27B' : 'Gemini Flash Lite' }} is reading the label</div>
      </div>

      <!-- Step 4: result -->
      <div v-else-if="step === 'result'">
        <div class="scan-result-header">
          <span class="scan-tick">✓</span> Whisky identified
          <span class="scan-model-badge">{{ USE_GEMMA ? 'Gemma 3' : 'Gemini' }}</span>
        </div>
        <div class="scan-fields">
          <div class="scan-field" v-for="(val, key) in displayResult" :key="key">
            <span class="scan-field-lbl">{{ FIELD_LABELS[key] }}</span>
            <span class="scan-field-val">{{ val }}</span>
          </div>
        </div>
        <div v-if="result.notes" class="scan-notes">{{ result.notes }}</div>
        <div class="scan-actions">
          <button class="btn-auth" @click="confirm">＋ Add to {{ props.list === 'wishlist' ? 'Wishlist' : 'Journal' }}</button>
          <button class="btn-cancel" @click="reset">Scan again</button>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="step === 'error'" class="scan-error">
        <div class="scan-error-icon">⚠</div>
        <div class="scan-error-msg">{{ errorMsg }}</div>
        <button class="btn-cancel" style="margin-top:1rem" @click="reset">Try again</button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { DEFAULTS } from '../lib/constants.js'
import { sb } from '../lib/supabase.js'
import { currentUser } from '../composables/useAuth.js'
import { compressImage } from '../utils/compressImage.js'

const emit = defineEmits(['close', 'identified'])

const props = defineProps({ list: { type: String, default: 'journal' } })

const DAILY_CAP = 10

const FIELD_LABELS = {
  name: 'Name', distillery: 'Distillery', origin: 'Region',
  type: 'Style', age: 'Age / ABV',
}

// ── Model selection ───────────────────────────────────────────────────────────
// Set to true to use Gemma 3 27B, false to use Gemini 2.5 Flash Lite
const USE_GEMMA = true

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

const API_KEY = import.meta.env.VITE_GEMINI_KEY

// ── Quota tracking ────────────────────────────────────────────────────────────

async function fetchScansToday() {
  const today = new Date().toISOString().split('T')[0]
  const { data } = await sb
    .from('scan_usage')
    .select('count')
    .eq('user_id', currentUser.value.id)
    .eq('date', today)
    .single()
  scansToday.value = data?.count ?? 0
}

async function incrementScans() {
  const today = new Date().toISOString().split('T')[0]
  await sb.from('scan_usage').upsert({
    user_id: currentUser.value.id,
    date: today,
    count: scansToday.value + 1,
  }, { onConflict: 'user_id,date' })
  scansToday.value++
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

async function callGemma() {
  // Step 1: upload file
  const uploadRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${API_KEY}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'multipart',
        'Content-Type': 'multipart/related; boundary=dj_boundary',
      },
      body: await buildMultipartBody(imageFile.value),
    }
  )
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    throw new Error(err.error?.message || 'File upload failed')
  }
  const uploadData = await uploadRes.json()
  const fileUri = uploadData.file?.uri
  if (!fileUri) throw new Error('Upload did not return a file URI')

  // Step 2: generate
  const genRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { file_data: { mime_type: imageMime.value, file_uri: fileUri } },
            { text: PROMPT },
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    }
  )
  const genData = await genRes.json()
  if (!genRes.ok) handleApiError(genRes.status, genData)
  return genData.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callGeminiFlashLite() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: imageMime.value, data: imageB64.value } },
            { text: PROMPT },
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) handleApiError(res.status, data)
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function handleApiError(status, data) {
  const msg = data.error?.message || 'API error'
  if (status === 400 || status === 403) throw new Error('API key error. Please check your VITE_GEMINI_KEY.')
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
    errorMsg.value = 'Image still processing, please wait a moment.'
    step.value = 'error'
    return
  }
  if (scansToday.value >= DAILY_CAP) {
    errorMsg.value = `Daily scan limit of ${DAILY_CAP} reached. Try again tomorrow.`
    step.value = 'error'
    return
  }

  step.value = 'loading'
  try {
    const text = USE_GEMMA ? await callGemma() : await callGeminiFlashLite()
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

  } catch (e) {
    errorMsg.value = e.message || 'Could not identify the bottle. Try a clearer photo.'
    step.value = 'error'
  }
}

function confirm() {
  emit('identified', { ...result.value })
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
</style>
