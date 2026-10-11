import { describe, it, expect } from 'vitest'
import {
  SCORE_KEYS, extractJson, buildSearchQuery, filterSources, excerpt, buildExtractionPrompt,
  parseExtraction, decideUpdate, toCatalogueUpdate, toResearchedNoChange,
} from '../../scripts/lib/flavor.js'

const long = (s) => (s + ' ').repeat(Math.ceil(450 / (s.length + 1)))
const page = (url, text = long('Nose: peat smoke. Palate: sweet and salty.')) => ({ url, title: 'T ' + url, text })
const goodJson = (over = {}) => JSON.stringify({
  found: true, confidence: 0.9, nose: 'peat, iodine', palate: 'sweet, salt',
  scores: { dulzor: 2, ahumado: 5, cuerpo: 3, frutado: 1, especiado: 2 },
  sources_used: ['S1', 'S2'], reason: 'two sources agree', ...over,
})

describe('buildSearchQuery', () => {
  it('quotes the name and adds the distillery when the name lacks it', () => {
    expect(buildSearchQuery({ name: 'Haran 12 years', distillery: 'Haran' })).toBe('Haran 12 years whisky tasting notes nose palate')
    expect(buildSearchQuery({ name: 'Lagavulin 16', distillery: 'Lagavulin' })).toBe('Lagavulin 16 whisky tasting notes nose palate')
    expect(buildSearchQuery({ name: 'Old Pulteney 32 years' })).not.toContain('"')
    expect(buildSearchQuery({ name: 'Old Pulteney 12', distillery: 'Pulteney' })).toBe('Old Pulteney 12 whisky tasting notes nose palate')
  })
})

describe('filterSources', () => {
  it('drops non-http, thin and duplicate pages', () => {
    const out = filterSources([
      page('https://x.com/a'), { url: 'ftp://bad', text: long('x') }, { url: 'https://x.com/short', text: 'tiny' },
      page('https://x.com/a/'), page('https://x.com/b'),
    ])
    expect(out.map(s => s.url)).toEqual(['https://x.com/a', 'https://x.com/b'])
  })

  it('ranks tasting sites first and caps the count', () => {
    const out = filterSources([page('https://random.blog/1'), page('https://www.whiskyfun.com/2'), page('https://random.blog/3')], { max: 2 })
    expect(out[0].url).toContain('whiskyfun')
    expect(out).toHaveLength(2)
  })
})

describe('excerpt', () => {
  it('returns short text unchanged and centres long text on the tasting notes', () => {
    expect(excerpt('short')).toBe('short')
    const text = 'x'.repeat(2000) + ' Nose: smoke and vanilla. ' + 'y'.repeat(9000)
    const e = excerpt(text, 500)
    expect(e.length).toBeLessThanOrEqual(500)
    expect(e).toContain('Nose: smoke')
  })
})

describe('buildExtractionPrompt', () => {
  it('numbers sources so the model cites ids, and forbids prior knowledge', () => {
    const p = buildExtractionPrompt({ name: 'Haran 12', distillery: 'Haran', age: 12 }, [page('https://a.test/1'), page('https://b.test/2')])
    expect(p).toContain('[S1] https://a.test/1')
    expect(p).toContain('[S2] https://b.test/2')
    expect(p).toMatch(/Use ONLY the SOURCES/)
    expect(p).toMatch(/Do not use your own knowledge/)
  })
})

describe('extractJson', () => {
  it('finds the answer after reasoning that contains braces', () => {
    const raw = 'Thinking: the set {S1, S2} and {x} are relevant.\n{"found": true, "scores": {"dulzor": 3}}'
    expect(extractJson(raw)).toEqual({ found: true, scores: { dulzor: 3 } })
  })
  it('handles fenced JSON and text after the object', () => {
    expect(extractJson('```json\n{"found": false}\n```')).toEqual({ found: false })
    expect(extractJson('{"found": true} done.')).toEqual({ found: true })
  })
  it('throws when there is no JSON', () => {
    expect(() => extractJson('no braces here')).toThrow(/no JSON/)
  })
})

describe('parseExtraction', () => {
  const sources = [page('https://a.test/1'), page('https://b.test/2')]

  it('maps source ids back to our URLs and ignores invented ones', () => {
    const x = parseExtraction(goodJson({ sources_used: ['S2', 'S9', 'https://evil.test'] }), sources)
    expect(x.sources).toEqual([{ url: 'https://b.test/2', title: 'T https://b.test/2' }])
  })

  it('accepts fenced JSON and clamps out-of-range values', () => {
    const raw = '```json\n' + goodJson({ confidence: 4, scores: { dulzor: 9, ahumado: -2, cuerpo: '3.6', frutado: null, especiado: 'abc' } }) + '\n```'
    const x = parseExtraction(raw, sources)
    expect(x.confidence).toBe(1)
    expect(x.scores).toEqual({ dulzor: 5, ahumado: 0, cuerpo: 4, frutado: null, especiado: null })
  })

  it('throws when the model returns no JSON', () => {
    expect(() => parseExtraction('I cannot help', sources)).toThrow(/no JSON/)
  })
})

describe('decideUpdate', () => {
  const sources = [page('https://a.test/1')]
  const base = () => parseExtraction(goodJson({ sources_used: ['S1'] }), sources)

  it('applies a confident, sourced, complete profile', () => {
    expect(decideUpdate(base())).toEqual({ apply: true, why: 'ok' })
  })
  it('refuses when sources do not describe this expression', () => {
    expect(decideUpdate({ ...base(), found: false }).apply).toBe(false)
  })
  it('refuses without any cited source (no uncited overwrites)', () => {
    expect(decideUpdate({ ...base(), sources: [] }).apply).toBe(false)
  })
  it('refuses low confidence', () => {
    const d = decideUpdate({ ...base(), confidence: 0.4 }, { minConfidence: 0.6 })
    expect(d.apply).toBe(false)
    expect(d.why).toMatch(/below/)
  })
  it('refuses incomplete score sets', () => {
    const x = base(); x.scores.frutado = null
    expect(decideUpdate(x).why).toMatch(/frutado/)
  })
})

describe('toCatalogueUpdate', () => {
  const current = { nose: 'old nose', palate: null, dulzor: 1, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }
  it('writes every score with provenance and snapshots the previous profile', () => {
    const x = parseExtraction(goodJson({ sources_used: ['S1'] }), [page('https://a.test/1')])
    const u = toCatalogueUpdate(x, current, '2026-10-11T00:00:00.000Z')
    for (const k of SCORE_KEYS) expect(typeof u[k]).toBe('number')
    expect(u.ahumado).toBe(5)
    expect(u.flavor_method).toBe('web-research')
    expect(u.flavor_sources).toEqual([{ url: 'https://a.test/1', title: 'T https://a.test/1' }])
    expect(u.flavor_previous).toMatchObject({ at: '2026-10-11T00:00:00.000Z', ahumado: 1, nose: 'old nose' })
  })
  it('keeps the old nose if the new one is empty', () => {
    const x = parseExtraction(goodJson({ nose: '', sources_used: ['S1'] }), [page('https://a.test/1')])
    expect(toCatalogueUpdate(x, current, 'now').nose).toBe('old nose')
  })
  it('marks a no-change research pass without touching scores', () => {
    const r = toResearchedNoChange(null, 'now')
    expect(r).toEqual({ flavor_researched_at: 'now', flavor_confidence: null, flavor_sources: [] })
    expect(Object.keys(r)).not.toContain('ahumado')
  })
})
