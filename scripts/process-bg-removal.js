import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN
const BUCKET              = 'whisky-photos'
const BATCH_SIZE          = 10 // process max 10 photos per run

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Replicate: poll until done ────────────────────────────────────────────────

async function pollResult(url) {
  while (true) {
    const res  = await fetch(url, {
      headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
    })
    const data = await res.json()

    if (data.status === 'succeeded') return data.output
    if (data.status === 'failed')    throw new Error(`Replicate failed: ${data.error}`)

    await new Promise(r => setTimeout(r, 2000))
  }
}

// ── Replicate: remove background ─────────────────────────────────────────────

async function removeBg(imageUrl) {
  const res = await fetch('https://api.replicate.com/v1/models/lucataco/remove-bg/predictions', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: { image: imageUrl } }),
  })

  if (!res.ok) throw new Error(`Replicate error: ${res.statusText}`)

  const prediction = await res.json()
  return await pollResult(prediction.urls.get)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Fetch whiskies that still have a JPG photo (not yet converted to PNG)
  const { data: whiskies, error } = await sb
    .from('whiskies')
    .select('id, user_id, photo_url')
    .not('photo_url', 'is', null)
    .like('photo_url', '%.jpg%')
    .limit(BATCH_SIZE)

  if (error) throw new Error(`Supabase query failed: ${error.message}`)
  if (!whiskies.length) { console.log('No photos to process.'); return }

  console.log(`Processing ${whiskies.length} photo(s)...`)

  for (const whisky of whiskies) {
    try {
      console.log(`  → ${whisky.id} (${whisky.photo_url})`)

      // 1. Call Replicate — pass the public JPG url directly
      const pngUrl = await removeBg(whisky.photo_url)

      // 2. Download the resulting PNG
      const pngRes  = await fetch(pngUrl)
      if (!pngRes.ok) throw new Error('Failed to download PNG from Replicate')
      const pngBuffer = Buffer.from(await pngRes.arrayBuffer())

      // 3. Upload PNG to Supabase Storage
      const newPath = `${whisky.user_id}/${whisky.id}.png`
      const { error: uploadError } = await sb.storage
        .from(BUCKET)
        .upload(newPath, pngBuffer, {
          contentType: 'image/png',
          cacheControl: '3600',
          upsert: true,
        })
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`)

      // 4. Get new public URL
      const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(newPath)
      const newPublicUrl = urlData.publicUrl

      // 5. Update DB with new PNG url
      const { error: updateError } = await sb
        .from('whiskies')
        .update({ photo_url: newPublicUrl })
        .eq('id', whisky.id)
      if (updateError) throw new Error(`DB update failed: ${updateError.message}`)

      // 6. Delete old JPG from storage
      const oldPath = `${whisky.user_id}/${whisky.id}.jpg`
      await sb.storage.from(BUCKET).remove([oldPath])

      console.log(`  ✓ Done: ${newPublicUrl}`)
    } catch (err) {
      // Log and continue — don't let one failure abort the whole batch
      console.error(`  ✗ Failed for ${whisky.id}: ${err.message}`)
    }
  }

  console.log('Batch complete.')
}

main().catch(err => { console.error(err); process.exit(1) })
