// Request validation + CORS helpers for the gemini-proxy edge function.
// Pure (no Deno APIs) so they can be unit-tested with vitest.

export const ALLOWED_MODELS = new Set([
  'gemma-4-26b-a4b-it',
  'gemini-3.1-flash-lite-preview',
])

export const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

// The client compresses to ~1024px JPEG (<300 KB). 2.8M base64 chars ≈ 2 MB.
export const MAX_IMAGE_B64_CHARS = 2_800_000

export const DAILY_SCAN_CAP = 20

// The prompt lives server-side so callers can't use the function as a general
// purpose Gemini endpoint.
export const SCAN_PROMPT = `Extract whisky info from the bottle image. Respond ONLY with valid JSON, no other text.

Required JSON fields:
{"name":"","distillery":"","origin":"","type":"","age":"","abv":"","nose":"","palate":"","notes":"","dulzor":0,"ahumado":0,"cuerpo":0,"frutado":0,"especiado":0}

Rules:
- type: scotch/irish/bourbon/japanese/other
- dulzor/ahumado/cuerpo/frutado/especiado: integers 0-5
- If unreadable: name="Unknown"
- Start with { end with } - nothing else.`

export interface ScanRequest {
  model: string
  imageB64: string
  imageMime: string
}

export function validateScanRequest(body: unknown): { ok: true; value: ScanRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request body' }
  const { model, imageB64, imageMime } = body as Record<string, unknown>

  if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) return { ok: false, error: 'Unsupported model' }
  if (typeof imageMime !== 'string' || !ALLOWED_MIME.has(imageMime)) return { ok: false, error: 'Unsupported image type' }
  if (typeof imageB64 !== 'string' || imageB64.length === 0) return { ok: false, error: 'Missing imageB64' }
  if (imageB64.length > MAX_IMAGE_B64_CHARS) return { ok: false, error: 'Image too large' }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imageB64)) return { ok: false, error: 'Invalid image encoding' }

  return { ok: true, value: { model, imageB64, imageMime } }
}

const DEFAULT_ORIGINS = [
  'https://dramjournal.online',
  'https://www.dramjournal.online',
  'http://localhost:5173',
  'http://localhost:4173',
]

export function allowedOrigins(envValue?: string | null): string[] {
  const extra = (envValue || '').split(',').map((s) => s.trim()).filter(Boolean)
  return extra.length ? extra : DEFAULT_ORIGINS
}

export function corsHeadersFor(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}
