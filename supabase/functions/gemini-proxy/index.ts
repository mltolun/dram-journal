import { createClient } from 'npm:@supabase/supabase-js@2'

const GEMINI_KEY     = Deno.env.get('GEMINI_KEY')
const GEMINI_BASE    = 'https://generativelanguage.googleapis.com'
const RATE_LIMIT_CAP = 20

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
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

    const today = new Date().toISOString().split('T')[0]
    const { count } = await sb
      .from('scan_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', today)

    if (count >= RATE_LIMIT_CAP) {
      return json({ error: 'Daily scan limit reached' }, 429)
    }

    const body = await req.json()
    const { model, imageB64, imageMime, prompt } = body

    if (!model || !prompt) {
      return json({ error: 'Missing required fields: model, prompt' }, 400)
    }

    if (!imageB64 || !imageMime) {
      return json({ error: 'Missing imageB64 or imageMime' }, 400)
    }

    const url = `${GEMINI_BASE}/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: imageMime, data: imageB64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', { status: response.status, data })
      return json({ error: data.error?.message || 'Gemini API error' }, response.status)
    }

    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

    await sb.from('scan_log').insert({ user_id: user.id })

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