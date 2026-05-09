import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleGenerativeAI } from 'npm:@google/generative-ai@0.21.0'

const GEMINI_KEY     = Deno.env.get('GEMINI_KEY')
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
    const { action, model, imageB64, imageMime, prompt } = body

    if (!action || !prompt) {
      return json({ error: 'Missing required fields: action, prompt' }, 400)
    }

    const genAI = new GoogleGenerativeAI(GEMINI_KEY)

    const generationConfig = {
      temperature:     0.2,
      maxOutputTokens: 2048,
    }

    let resultText = ''

    if (action === 'generate-inline') {
      if (!imageB64 || !imageMime) {
        return json({ error: 'Missing imageB64 or imageMime' }, 400)
      }

      const binary = atob(imageB64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const modelInstance = genAI.getGenerativeModel({ model }, generationConfig)
      const result = await modelInstance.generateContent([
        { inlineData: { data: imageB64, mimeType: imageMime } },
        prompt,
      ])
      resultText = result.response.text() || ''

    } else {
      return json({ error: `Unknown action: ${action}` }, 400)
    }

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