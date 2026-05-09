import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_KEY     = Deno.env.get('GEMINI_KEY')
const GEMINI_BASE    = 'https://generativelanguage.googleapis.com'
const RATE_LIMIT_CAP = 20 // max scans per user per day — mirrors frontend DAILY_CAP

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Authenticate the user via their Supabase JWT ──────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401)
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    // ── Rate limit: check scans today for this user ───────────────────────────
    const today = new Date().toISOString().split('T')[0]
    const { count } = await sb
      .from('scan_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today)

    if (count >= RATE_LIMIT_CAP) {
      return json({ error: 'Daily scan limit reached' }, 429)
    }

    // ── Parse request body ────────────────────────────────────────────────────
    const body = await req.json()
    const { action, model, imageB64, imageMime, fileUri, prompt } = body

    if (!action || !prompt) {
      return json({ error: 'Missing required fields: action, prompt' }, 400)
    }

    // generationConfig shared by both generate actions
    // role: "user" is required for Gemma instruct chat template
    const generationConfig = {
      temperature:     0.2,
      maxOutputTokens: 1024,
    }

    let resultText = ''

    if (action === 'generate-inline') {
      // Gemini Flash Lite — inline base64 image
      if (!imageB64 || !imageMime) return json({ error: 'Missing imageB64 or imageMime' }, 400)

      const res = await fetch(
        `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { inline_data: { mime_type: imageMime, data: imageB64 } },
                { text: prompt },
              ],
            }],
            generationConfig,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        console.error('gemini-proxy generate-inline error:', {
          model, status: res.status, detail: data.error ?? null,
        })
        return json({ error: data.error?.message || 'Gemini error' }, res.status)
      }
      resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!resultText) console.warn('gemini-proxy generate-inline: empty response', JSON.stringify(data))

    } else if (action === 'upload-file') {
      // Gemma — step 1: upload file, return URI to client (client sends it back for generate)
      if (!imageB64 || !imageMime) return json({ error: 'Missing imageB64 or imageMime' }, 400)

      // Reconstruct binary from base64
      const binary  = atob(imageB64)
      const bytes   = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const boundary = 'dj_boundary'
      const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=utf-8\r\n\r\n{"file": {"display_name": "scan"}}\r\n`
      const dataPart = `--${boundary}\r\nContent-Type: ${imageMime}\r\n\r\n`
      const ending   = `\r\n--${boundary}--`

      const metaBytes = new TextEncoder().encode(metaPart)
      const dataLabel = new TextEncoder().encode(dataPart)
      const endBytes  = new TextEncoder().encode(ending)
      const combined  = new Uint8Array(metaBytes.length + dataLabel.length + bytes.length + endBytes.length)
      combined.set(metaBytes, 0)
      combined.set(dataLabel, metaBytes.length)
      combined.set(bytes, metaBytes.length + dataLabel.length)
      combined.set(endBytes, metaBytes.length + dataLabel.length + bytes.length)

      const uploadRes = await fetch(
        `${GEMINI_BASE}/upload/v1beta/files?key=${GEMINI_KEY}`,
        {
          method:  'POST',
          headers: {
            'X-Goog-Upload-Protocol': 'multipart',
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: combined,
        }
      )
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) {
        console.error('gemini-proxy upload-file error:', {
          model, status: uploadRes.status, detail: uploadData.error ?? null,
        })
        return json({ error: uploadData.error?.message || 'Upload failed' }, uploadRes.status)
      }
      return json({ fileUri: uploadData.file?.uri })

    } else if (action === 'generate-file') {
      // Gemma — step 2: generate from uploaded file URI
      if (!fileUri || !imageMime) return json({ error: 'Missing fileUri or imageMime' }, 400)

      const res = await fetch(
        `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { file_data: { mime_type: imageMime, file_uri: fileUri } },
                { text: prompt },
              ],
            }],
            generationConfig,
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        console.error('gemini-proxy generate-file error:', {
          model, status: res.status, detail: data.error ?? null,
        })
        return json({ error: data.error?.message || 'Gemini error' }, res.status)
      }
      resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      if (!resultText) console.warn('gemini-proxy generate-file: empty response', JSON.stringify(data))

    } else {
      return json({ error: `Unknown action: ${action}` }, 400)
    }

    // ── Log the scan (only on successful generate, not upload step) ───────────
    if (action !== 'upload-file') {
      await sb.from('scan_log').insert({ user_id: user.id })
    }

    return json({ text: resultText })

  } catch (err) {
    console.error('gemini-proxy error:', err)
    return json({ error: err.message || 'Internal server error' }, 500)
  }
})

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}