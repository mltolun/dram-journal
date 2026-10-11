import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  DAILY_SCAN_CAP,
  SCAN_PROMPT,
  allowedOrigins,
  corsHeadersFor,
  validateScanRequest,
} from '../_shared/gemini-guard.ts'

const GEMINI_KEY  = Deno.env.get('GEMINI_KEY')
const GEMINI_BASE = 'https://generativelanguage.googleapis.com'
const ORIGINS     = allowedOrigins(Deno.env.get('ALLOWED_ORIGINS'))

Deno.serve(async (req) => {
  const cors = corsHeadersFor(req.headers.get('Origin'), ORIGINS)
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401)

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return json({ error: 'Unauthorized' }, 401)

    const parsed = validateScanRequest(await req.json().catch(() => null))
    if (!parsed.ok) return json({ error: parsed.error }, 400)
    const { model, imageB64, imageMime } = parsed.value

    // Reserve a quota slot BEFORE calling the model so concurrent requests
    // can't all slip under the cap, then count (fail closed on any error).
    // Failed upstream calls still consume a slot — the daily cap is a cost
    // guard, not a billing meter.
    const { error: insertErr } = await sb.from('scan_log').insert({ user_id: user.id })
    if (insertErr) return json({ error: 'Could not reserve scan quota' }, 503)

    const today = new Date().toISOString().split('T')[0]
    const { count, error: countErr } = await sb
      .from('scan_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today)

    if (countErr || count === null) return json({ error: 'Could not verify scan quota' }, 503)
    if (count > DAILY_SCAN_CAP) return json({ error: 'Daily scan limit reached' }, 429)

    const response = await fetch(
      `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
        // Bound the upstream call so a stalled request can't hold the worker open.
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: imageMime, data: imageB64 } },
              { text: SCAN_PROMPT },
            ],
          }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
        }),
      },
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', { status: response.status, data })
      // Don't forward upstream error text to the client.
      return json({ error: 'Model request failed' }, response.status === 429 ? 429 : 502)
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return json({ text: resultText })

  } catch (err) {
    console.error('gemini-proxy error:', err)
    return json({ error: 'Internal server error' }, 500)
  }
})

