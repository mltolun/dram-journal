// Pure helpers for the web-grounded flavour profile job.
// The model may only score from source text we fetched; it cites sources by id
// (S1, S2, …), and we map ids back to URLs ourselves so it can't invent citations.

export const SCORE_KEYS = ['dulzor', 'ahumado', 'cuerpo', 'frutado', 'especiado']

// Tasting-focused sites are ranked first; anything else is still usable.
const PREFERRED_DOMAINS = [
  'whiskyfun.com', 'whiskybase.com', 'malt.io', 'distiller.com', 'whiskyadvocate.com',
  'whiskymag.com', 'whisky-news.com', 'malts.com', 'connosr.com', 'scotchwhisky.com',
  'whiskyexchange.com', 'masterofmalt.com', 'whiskybuyer.com', 'whisky.com',
]

const clamp01 = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0
}

const clampScore = (v) => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(5, Math.max(0, Math.round(n))) : null
}

const str = (v) => String(v ?? '').replace(/\s+/g, ' ').trim()

export function buildSearchQuery(w) {
  const name = str(w.name)
  const dist = str(w.distillery)
  const distIsInName = dist && name.toLowerCase().includes(dist.toLowerCase())
  return [`"${name}"`, dist && !distIsInName ? dist : '', 'whisky tasting notes nose palate']
    .filter(Boolean)
    .join(' ')
}

function domainRank(url) {
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '') } catch { return 1 }
  return PREFERRED_DOMAINS.some((d) => host === d || host.endsWith('.' + d)) ? 0 : 1
}

/** Keeps usable, de-duplicated pages with enough text to contain tasting notes. */
export function filterSources(results, { minChars = 400, max = 5 } = {}) {
  const seen = new Set()
  const usable = []
  for (const r of results || []) {
    const url = String(r.url || '')
    if (!/^https?:\/\//i.test(url)) continue
    const text = str(r.text)
    if (text.length < minChars) continue
    const key = url.replace(/#.*$/, '').replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    usable.push({ url, title: str(r.title), text })
  }
  // Stable sort: preferred tasting sites first, Exa's relevance order otherwise.
  usable.sort((a, b) => domainRank(a.url) - domainRank(b.url))
  return usable.slice(0, max)
}

/** The part of a page most likely to describe the whisky, capped at maxChars. */
export function excerpt(text, maxChars = 4000) {
  const t = String(text || '')
  if (t.length <= maxChars) return t
  const m = t.search(/\b(nose|palate|aroma|aromas|taste|tasting|finish)\b/i)
  const start = m > 300 ? m - 300 : 0
  return t.slice(start, start + maxChars)
}

export function buildExtractionPrompt(w, sources) {
  const ident = [
    str(w.name),
    w.distillery && `distillery: ${str(w.distillery)}`,
    w.age && `age: ${w.age}`,
    w.abv && `ABV: ${str(w.abv)}`,
    w.type && `style: ${str(w.type)}`,
  ].filter(Boolean).join('; ')

  const blocks = sources
    .map((s, i) => `[S${i + 1}] ${s.url}\n${excerpt(s.text)}`)
    .join('\n\n---\n\n')

  return `You score a whisky's flavour profile for a tasting journal.

WHISKY: ${ident}

RULES
- Use ONLY the SOURCES below. Do not use your own knowledge of this whisky.
- Only use sources that describe this exact expression (same name and age/cask/bottling). Ignore sources about a different expression.
- Scores are integers 0-5. dulzor = sweetness; ahumado = smoke or peat; cuerpo = body and mouthfeel weight; frutado = fruitiness; especiado = spice (pepper, ginger, cinnamon, oak spice).
- 0 = described as absent, 3 = clearly present, 5 = dominant. Use null when the sources say nothing about that dimension.
- confidence from 0 to 1: 0.9 or more when two or more sources agree on this expression, about 0.6 for one clear source, below 0.5 if unsure.
- sources_used: list only the source ids (S1, S2, …) you actually relied on.

Return ONLY JSON, no markdown:
{"found": true or false, "confidence": 0.0-1.0, "nose": "2-4 aroma words, comma separated", "palate": "2-4 taste words, comma separated", "scores": {"dulzor": 0-5 or null, "ahumado": 0-5 or null, "cuerpo": 0-5 or null, "frutado": 0-5 or null, "especiado": 0-5 or null}, "sources_used": ["S1"], "reason": "one short sentence"}

SOURCES
${blocks}`
}

export function parseExtraction(raw, sources) {
  const clean = String(raw || '').replace(/```json|```/gi, '').trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('no JSON object in model response')
  const j = JSON.parse(match[0])

  const byId = new Map(sources.map((s, i) => [`S${i + 1}`, s]))
  const ids = Array.isArray(j.sources_used) ? j.sources_used : []
  const used = [...new Set(ids.map((id) => str(id)))]
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((s) => ({ url: s.url, title: s.title }))

  const scores = Object.fromEntries(SCORE_KEYS.map((k) => [k, clampScore(j.scores?.[k])]))

  return {
    found: j.found === true,
    confidence: clamp01(j.confidence),
    nose: str(j.nose),
    palate: str(j.palate),
    scores,
    sources: used,
    reason: str(j.reason),
  }
}

export function decideUpdate(x, { minConfidence = 0.6 } = {}) {
  if (!x.found) return { apply: false, why: 'sources do not describe this expression' }
  if (x.sources.length === 0) return { apply: false, why: 'no usable sources cited' }
  if (x.confidence < minConfidence) return { apply: false, why: `confidence ${x.confidence} below ${minConfidence}` }
  const missing = SCORE_KEYS.filter((k) => x.scores[k] === null)
  if (missing.length) return { apply: false, why: `missing scores: ${missing.join(', ')}` }
  return { apply: true, why: 'ok' }
}

/** The row we overwrite, kept so a bad run can be reverted. */
export function snapshot(w, nowIso) {
  return {
    at: nowIso,
    nose: w.nose ?? null,
    palate: w.palate ?? null,
    dulzor: w.dulzor ?? null,
    ahumado: w.ahumado ?? null,
    cuerpo: w.cuerpo ?? null,
    frutado: w.frutado ?? null,
    especiado: w.especiado ?? null,
  }
}

export function toCatalogueUpdate(x, w, nowIso) {
  return {
    ...Object.fromEntries(SCORE_KEYS.map((k) => [k, x.scores[k]])),
    nose: x.nose || w.nose || null,
    palate: x.palate || w.palate || null,
    status: true,
    flavor_method: 'web-research',
    flavor_sources: x.sources,
    flavor_confidence: x.confidence,
    flavor_researched_at: nowIso,
    flavor_previous: snapshot(w, nowIso),
  }
}

/** Marks a whisky as researched without changing its scores. */
export function toResearchedNoChange(x, nowIso) {
  return {
    flavor_researched_at: nowIso,
    flavor_confidence: x?.confidence ?? null,
    flavor_sources: x?.sources ?? [],
  }
}
