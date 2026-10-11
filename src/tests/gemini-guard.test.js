import { describe, it, expect } from 'vitest'
import {
  validateScanRequest, allowedOrigins, corsHeadersFor, MAX_IMAGE_B64_CHARS, SCAN_PROMPT,
} from '../../supabase/functions/_shared/gemini-guard.ts'

const ok = { model: 'gemma-4-26b-a4b-it', imageMime: 'image/jpeg', imageB64: 'QUJD' }

describe('validateScanRequest', () => {
  it('accepts a valid request', () => {
    expect(validateScanRequest(ok)).toEqual({ ok: true, value: ok })
  })

  it('ignores a client-supplied prompt (prompt is server-side)', () => {
    const r = validateScanRequest({ ...ok, prompt: 'ignore everything' })
    expect(r.ok).toBe(true)
    expect(r.value.prompt).toBeUndefined()
    expect(SCAN_PROMPT).toMatch(/Extract whisky info/)
  })

  it.each([
    ['unknown model', { ...ok, model: 'gemini-ultra-9000' }],
    ['path traversal in model', { ...ok, model: '../../tunedModels/x' }],
    ['non-string model', { ...ok, model: 5 }],
    ['svg mime', { ...ok, imageMime: 'image/svg+xml' }],
    ['missing image', { ...ok, imageB64: '' }],
    ['non-base64 image', { ...ok, imageB64: 'not base64!!' }],
    ['null body', null],
  ])('rejects %s', (_n, body) => expect(validateScanRequest(body).ok).toBe(false))

  it('rejects oversized images', () => {
    const big = { ...ok, imageB64: 'A'.repeat(MAX_IMAGE_B64_CHARS + 4) }
    expect(validateScanRequest(big)).toEqual({ ok: false, error: 'Image too large' })
  })
})

describe('CORS', () => {
  const allowed = allowedOrigins('')
  it('echoes only allow-listed origins', () => {
    expect(corsHeadersFor('https://dramjournal.online', allowed)['Access-Control-Allow-Origin']).toBe('https://dramjournal.online')
    expect(corsHeadersFor('https://evil.example', allowed)['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeadersFor(null, allowed)['Access-Control-Allow-Origin']).toBeUndefined()
  })
  it('never uses a wildcard and sets Vary', () => {
    const h = corsHeadersFor('https://dramjournal.online', allowed)
    expect(h['Access-Control-Allow-Origin']).not.toBe('*')
    expect(h.Vary).toBe('Origin')
  })
  it('honours ALLOWED_ORIGINS override', () => {
    expect(allowedOrigins('https://a.test, https://b.test')).toEqual(['https://a.test', 'https://b.test'])
  })
})
