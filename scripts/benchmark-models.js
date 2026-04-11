#!/usr/bin/env node
/**
 * Benchmark: Gemma 3 27B vs Gemma 4 31B vs Gemma 4 26B MoE
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

import 'dotenv/config'

// ── Load env ──────────────────────────────────────────────────────────────────
const API_KEY = process.env.GEMINI_KEY
if (!API_KEY) { console.error('GEMINI_KEY not set'); process.exit(1) }

// ── Models to benchmark ───────────────────────────────────────────────────────
const MODELS = [
  { id: 'gemma-3-27b-it',    label: 'Gemma 3 27B' },
  { id: 'gemma-4-31b-it',    label: 'Gemma 4 31B' },
  { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B MoE (4B active)' },
]

// ── Prompt (same content used in the scan feature, text-only) ─────────────────
const PROMPT = `You are a whisky expert. Briefly describe in 3 sentences the flavour profile of a typical 12-year-old Speyside single malt Scotch whisky. Be concise.`

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// ── Benchmark one model via streaming ─────────────────────────────────────────
async function benchmark(model) {
  const url = `${BASE_URL}/${model.id}:streamGenerateContent?alt=sse&key=${API_KEY}`

  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
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

  // Parse SSE stream
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() // keep incomplete last line

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
    label:       model.label,
    ttft:        ttft  != null ? ttft.toFixed(0)  : 'n/a',
    total:       total.toFixed(0),
    chars:       totalText.length,
    promptTokens: usageMeta?.promptTokenCount ?? '?',
    outputTokens: (() => {
      if (!usageMeta) return '?'
      const out = usageMeta.totalTokenCount - usageMeta.promptTokenCount
      return out > 0 ? out : 'n/a'
    })(),
    text:        totalText,
  }
}

// ── Run all benchmarks sequentially ──────────────────────────────────────────
async function run() {
  console.log(`\nBenchmarking ${MODELS.length} models against AI Studio...\n`)
  console.log(`Prompt: "${PROMPT}"\n`)
  console.log('─'.repeat(72))

  const results = []

  for (const model of MODELS) {
    process.stdout.write(`  ${model.label.padEnd(20)} ... `)
    try {
      const r = await benchmark(model)
      results.push(r)
      console.log(`TTFT ${r.ttft}ms  |  Total ${r.total}ms  |  ${r.outputTokens} tokens out`)
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      results.push({ label: model.label, error: err.message })
    }
  }

  console.log('\n' + '─'.repeat(72))
  console.log('\nSummary\n')

  const cols = ['label', 'ttft', 'total', 'promptTokens', 'outputTokens']
  const header = ['Model', 'TTFT (ms)', 'Total (ms)', 'Prompt tok', 'Output tok']
  const widths = [22, 10, 11, 11, 11]

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

  // Print sampled output for each successful model
  console.log('\n' + '─'.repeat(72))
  console.log('\nResponse samples\n')
  for (const r of results) {
    if (r.error) continue
    console.log(`[ ${r.label} ]`)
    console.log(r.text.trim())
    console.log()
  }
}

run().catch(err => { console.error(err); process.exit(1) })
