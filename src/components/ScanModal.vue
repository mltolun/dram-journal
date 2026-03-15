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
        <input ref="fileInput" type="file" accept="image/*" capture="environment"
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
        <div class="scan-loading-sub">Gemini is reading the label</div>
      </div>

      <!-- Step 4: result -->
      <div v-else-if="step === 'result'">
        <div class="scan-result-header">
          <span class="scan-tick">✓</span> Whisky identified
        </div>
        <div class="scan-fields">
          <div class="scan-field" v-for="(val, key) in displayResult" :key="key">
            <span class="scan-field-lbl">{{ FIELD_LABELS[key] }}</span>
            <span class="scan-field-val">{{ val }}</span>
          </div>
        </div>
        <div v-if="result.notes" class="scan-notes">{{ result.notes }}</div>
        <div class="scan-actions">
          <button class="btn-auth" @click="confirm">＋ Add to journal</button>
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
import { ATTRS, DEFAULTS } from '../lib/constants.js'

const emit = defineEmits(['close', 'identified'])

const FIELD_LABELS = {
  name: 'Name', distillery: 'Distillery', origin: 'Region',
  type: 'Style', age: 'Age / ABV',
}

const step       = ref('pick')
const dragging   = ref(false)
const previewSrc = ref(null)
const imageB64   = ref(null)
const imageMime  = ref('image/jpeg')
const result     = ref({})
const errorMsg   = ref('')
const fileInput  = ref(null)

const API_KEY = import.meta.env.VITE_GEMINI_KEY

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
  imageB64.value   = null
  result.value     = {}
  errorMsg.value   = ''
}

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
  imageMime.value = file.type || 'image/jpeg'
  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target.result
    previewSrc.value = dataUrl
    imageB64.value   = dataUrl.split(',')[1]
    step.value = 'preview'
  }
  reader.readAsDataURL(file)
}

const PROMPT = `You are a whisky expert. Analyse this bottle label image and extract all the information you can see.

Respond ONLY with a valid JSON object — no explanation, no markdown, no backticks. Use exactly these keys:
{
  "name": "full whisky name including age statement if on label",
  "distillery": "distillery name",
  "origin": "region and country e.g. Speyside, Scotland",
  "type": one of: "scotch" | "irish" | "bourbon" | "japanese" | "other",
  "age": "age statement or maturation info e.g. 12 Years Old / Sherry Cask",
  "abv": "ABV percentage e.g. 46%",
  "nose": "likely nose notes based on the whisky if you know it, otherwise empty string",
  "palate": "likely palate notes if you know it, otherwise empty string",
  "notes": "any other interesting details from the label",
  "dulzor": sweetness score 0-5 integer,
  "ahumado": smokiness score 0-5 integer,
  "cuerpo": body score 0-5 integer,
  "frutado": fruitiness score 0-5 integer,
  "especiado": spiciness score 0-5 integer
}

If you cannot read the label clearly or identify the whisky, set name to "Unknown" and fill what you can.`

async function analyse() {
  step.value = 'loading'
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: imageMime.value, data: imageB64.value } },
            { text: PROMPT }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      const msg = data.error?.message || 'API error'
      if (response.status === 400 || response.status === 403) {
        throw new Error('API key error. Please check your VITE_GEMINI_KEY.')
      }
      if (response.status === 429 || msg.includes('Quota') || msg.includes('quota')) {
        throw new Error('Gemini quota exceeded. Enable billing at console.cloud.google.com or try again later.')
      }
      throw new Error(msg)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Extract the first {...} block in case the model adds surrounding text
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Could not read the label. Try a clearer photo.')

    let parsed
    try {
      parsed = JSON.parse(match[0])
    } catch {
      // Sometimes the model truncates — try to salvage by closing open structure
      try {
        parsed = JSON.parse(match[0] + '"}')
      } catch {
        throw new Error('Could not parse label data. Try a clearer photo.')
      }
    }

    const abv = parsed.abv || ''
    const notesBase = parsed.notes || ''

    result.value = {
      name:       parsed.name       || '',
      distillery: parsed.distillery || '',
      origin:     parsed.origin     || '',
      type:       parsed.type       || 'scotch',
      age:        parsed.age        ? `${parsed.age}${abv ? ' · ' + abv : ''}` : abv,
      nose:       parsed.nose       || '',
      palate:     parsed.palate     || '',
      notes:      notesBase,
      dulzor:     parsed.dulzor     ?? DEFAULTS.dulzor,
      ahumado:    parsed.ahumado    ?? DEFAULTS.ahumado,
      cuerpo:     parsed.cuerpo     ?? DEFAULTS.cuerpo,
      frutado:    parsed.frutado    ?? DEFAULTS.frutado,
      especiado:  parsed.especiado  ?? DEFAULTS.especiado,
    }
    step.value = 'result'

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
  gap: 6px;
}
.scan-tick { font-size: 1rem; }

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
