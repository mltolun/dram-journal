#!/usr/bin/env node
/**
 * Benchmark: Gemma 3 27B vs Gemma 4 31B vs Gemma 4 26B MoE
 *
 * Two rounds per model:
 *   1. Text-only  — short flavour-profile question
 *   2. Vision     — identify a whisky bottle from an image (inline base64)
 *
 * Hits the Google AI Studio (generativelanguage) endpoint directly,
 * using the same GEMINI_KEY the gemini-proxy Edge Function uses.
 *
 * Usage:
 *   node scripts/benchmark-models.js
 *
 * Metrics reported per model:
 *   - TTFT  : time to first token (streaming)
 *   - Total : total elapsed time to finish
 *   - Tokens: usageMetadata from the response (if available)
 */

// ── Load env ──────────────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_KEY
if (!API_KEY) { console.error('GEMINI_KEY not set'); process.exit(1) }

// ── Models to benchmark ───────────────────────────────────────────────────────
const MODELS = [
  { id: 'gemma-3-27b-it',     label: 'Gemma 3 27B' },
  { id: 'gemma-4-31b-it',     label: 'Gemma 4 31B' },
  { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B MoE (4B active)' },
]

// ── Prompts ───────────────────────────────────────────────────────────────────
const TEXT_PROMPT = `You are a whisky expert. Briefly describe in 3 sentences the flavour profile of a typical 12-year-old Speyside single malt Scotch whisky. Be concise.`

// Same structured prompt used in ScanModal.vue
const VISION_PROMPT = `You are a whisky data extraction API. Your only job is to return a JSON object.

DO NOT write any explanation, prose, markdown, bullet points, tables, or code fences.
DO NOT start your response with any word, sentence, or character other than {
Your entire response must be a single JSON object that begins with { and ends with }

Extract information from the bottle label image and return this exact JSON structure, with all string values filled in:

{"name":"full whisky name","distillery":"distillery name","origin":"region and country e.g. Speyside, Scotland","type":"scotch","age":"age statement e.g. 12 Years Old","abv":"e.g. 46%","nose":"2-4 aroma descriptors based on your whisky knowledge","palate":"2-4 taste descriptors based on your whisky knowledge","notes":"any other label details","dulzor":2,"ahumado":1,"cuerpo":3,"frutado":2,"especiado":2}

Rules:
- type must be one of: scotch, irish, bourbon, japanese, other
- nose and palate MUST be filled using your whisky knowledge even if not on the label
- dulzor=sweetness, ahumado=smokiness, cuerpo=body, frutado=fruitiness, especiado=spiciness — all integers 0-5
- If the label is unreadable set name to "Unknown" and estimate the rest
- Return only the JSON object. Nothing else. First character: { Last character: }`

// Sample whisky bottle image — Glenfiddich 12 on Wikimedia Commons (public domain)
const SAMPLE_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Glenfiddich12.jpg/220px-Glenfiddich12.jpg'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// ── Fetch sample image as base64 ─────────────────────────────────────────────
async function fetchImageB64(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch sample image: HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let b64 = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    b64 += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { b64: btoa(b64), mime: res.headers.get('content-type') || 'image/jpeg' }
}

// ── Core streaming call ───────────────────────────────────────────────────────
async function streamCall(modelId, parts) {
  const url = `${BASE_URL}/${modelId}:streamGenerateContent?alt=sse&key=${API_KEY}`
  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
  })

  const start = performance.now()
  let ttft = null
  let totalText = ''
  let usageMeta = null

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`HTTP ${res.status}: ${err.slice(0, 300)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6).trim()
      if (raw === '[DONE]') continue
      let chunk
      try { chunk = JSON.parse(raw) } catch { continue }

      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text && ttft === null) ttft = performance.now() - start
      totalText += text

      if (chunk.usageMetadata) usageMeta = chunk.usageMetadata
    }
  }

  const total = performance.now() - start

  return {
    ttft:         ttft != null ? ttft.toFixed(0) : 'n/a',
    total:        total.toFixed(0),
    promptTokens: usageMeta?.promptTokenCount ?? '?',
    outputTokens: (() => {
      if (!usageMeta) return '?'
      const out = usageMeta.totalTokenCount - usageMeta.promptTokenCount
      return out > 0 ? out : 'n/a'
    })(),
    text: totalText,
  }
}

// ── Benchmark helpers ─────────────────────────────────────────────────────────
async function benchmarkText(model) {
  const r = await streamCall(model.id, [{ text: TEXT_PROMPT }])
  return { label: model.label, ...r }
}

async function benchmarkVision(model, imageB64, imageMime) {
  const parts = [
    { inline_data: { mime_type: imageMime, data: imageB64 } },
    { text: VISION_PROMPT },
  ]
  const r = await streamCall(model.id, parts)

  // Check if the response contains valid JSON
  const match = r.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim().match(/\{[\s\S]*\}/)
  let jsonOk = false
  let parsedName = ''
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      jsonOk = true
      parsedName = parsed.name || ''
    } catch { /* invalid JSON */ }
  }

  return { label: model.label, ...r, jsonOk, parsedName }
}

// ── Table printer ─────────────────────────────────────────────────────────────
function printTable(results, extraCols = []) {
  const cols   = ['label', 'ttft', 'total', 'promptTokens', 'outputTokens', ...extraCols.map(c => c.key)]
  const header = ['Model', 'TTFT (ms)', 'Total (ms)', 'Prompt tok', 'Output tok', ...extraCols.map(c => c.label)]
  const widths = [28, 10, 11, 11, 11, ...extraCols.map(c => c.width)]

  console.log(header.map((h, i) => h.padEnd(widths[i])).join('  '))
  console.log(widths.map(w => '─'.repeat(w)).join('  '))

  for (const r of results) {
    if (r.error) {
      console.log(`${r.label.padEnd(widths[0])}  ERROR: ${r.error}`)
    } else {
      const row = cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i]))
      console.log(row.join('  '))
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  // ── Section 1: Text benchmark ─────────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`)
  console.log('  TEXT BENCHMARK')
  console.log(`${'═'.repeat(72)}\n`)
  console.log(`Prompt: "${TEXT_PROMPT}"\n`)
  console.log('─'.repeat(72))

  const textResults = []
  for (const model of MODELS) {
    process.stdout.write(`  ${model.label.padEnd(26)} ... `)
    try {
      const r = await benchmarkText(model)
      textResults.push(r)
      console.log(`TTFT ${r.ttft}ms  |  Total ${r.total}ms  |  ${r.outputTokens} tokens out`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      textResults.push({ label: model.label, error: err.message })
    }
  }

  console.log('\n' + '─'.repeat(72))
  console.log('\nText Summary\n')
  printTable(textResults)

  console.log('\n' + '─'.repeat(72))
  console.log('\nText Response samples\n')
  for (const r of textResults) {
    if (r.error) continue
    console.log(`[ ${r.label} ]`)
    console.log(r.text.trim())
    console.log()
  }

  // ── Section 2: Vision benchmark ───────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`)
  console.log('  VISION BENCHMARK  (whisky bottle image recognition)')
  console.log(`${'═'.repeat(72)}\n`)
  console.log(`Sample image: ${SAMPLE_IMAGE_URL}\n`)

  let imageB64, imageMime
  try {
    process.stdout.write('Fetching sample image ... ')
    ;({ b64: imageB64, mime: imageMime } = await fetchImageB64(SAMPLE_IMAGE_URL))
    console.log(`OK (${Math.round(imageB64.length * 0.75 / 1024)}KB)\n`)
  } catch (err) {
    console.log(`FAILED: ${err.message}`)
    console.log('Skipping vision benchmark.')
    return
  }

  console.log('─'.repeat(72))

  const visionResults = []
  for (const model of MODELS) {
    process.stdout.write(`  ${model.label.padEnd(26)} ... `)
    try {
      const r = await benchmarkVision(model, imageB64, imageMime)
      visionResults.push(r)
      const jsonStatus = r.jsonOk ? `JSON OK (${r.parsedName || 'no name'})` : 'JSON INVALID'
      console.log(`TTFT ${r.ttft}ms  |  Total ${r.total}ms  |  ${jsonStatus}`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      visionResults.push({ label: model.label, error: err.message })
    }
  }

  console.log('\n' + '─'.repeat(72))
  console.log('\nVision Summary\n')
  printTable(visionResults, [
    { key: 'jsonOk',     label: 'JSON OK',   width: 8 },
    { key: 'parsedName', label: 'Name',      width: 24 },
  ])

  console.log('\n' + '─'.repeat(72))
  console.log('\nVision Response samples\n')
  for (const r of visionResults) {
    if (r.error) continue
    console.log(`[ ${r.label} ]`)
    console.log(r.text.trim().slice(0, 500))
    console.log()
  }
}

run().catch(err => { console.error(err); process.exit(1) })
