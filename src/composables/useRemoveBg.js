import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { useWhiskies } from './useWhiskies.js'

// Shared — model is only loaded once for the lifetime of the app
const modelLoaded  = ref(false)
const modelLoading = ref(false)

// Set of whiskyIds currently being processed — used to show a subtle indicator
export const processingIds = ref(new Set())

let segmenter = null

async function loadModel() {
  if (segmenter) return segmenter
  if (modelLoading.value) {
    while (modelLoading.value) await new Promise(r => setTimeout(r, 100))
    return segmenter
  }

  modelLoading.value = true
  try {
    const { pipeline, env } = await import('@huggingface/transformers')
    env.backends.onnx.wasm.proxy = true

    segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
      device: 'webgpu', // auto-falls back to wasm
    })

    modelLoaded.value = true
    return segmenter
  } finally {
    modelLoading.value = false
  }
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function applyMask(dataUrl, mask) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload  = () => resolve(el)
    el.onerror = reject
    el.src = dataUrl
  })

  const canvas  = document.createElement('canvas')
  canvas.width  = img.width
  canvas.height = img.height
  const ctx     = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const pixels    = imageData.data
  const maskData  = mask.data

  for (let i = 0; i < maskData.length; i++) {
    pixels[i * 4 + 3] = maskData[i]
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
  })
}

/**
 * Fire-and-forget: run bg removal in the background after the record is saved.
 *
 * @param {string} whiskyId
 * @param {Blob|null} jpegBlob  - pass the blob if available (fresh upload),
 *                                or null to re-fetch from the stored photo_url (re-queue on startup)
 * @param {string|null} photoUrl - required when jpegBlob is null, used to fetch the image
 */
export function removeBgInBackground(whiskyId, jpegBlob, photoUrl = null) {
  const userId = currentUser.value?.id
  if (!userId) return

  // Avoid duplicate processing
  if (processingIds.value.has(whiskyId)) return

  processingIds.value = new Set([...processingIds.value, whiskyId])

  ;(async () => {
    try {
      const { updateWhisky } = useWhiskies()

      // If no blob provided, fetch the JPG from its public URL
      let sourceBlob = jpegBlob
      if (!sourceBlob) {
        if (!photoUrl) throw new Error('No blob or photoUrl provided')
        const res = await fetch(photoUrl)
        if (!res.ok) throw new Error(`Failed to fetch photo: ${res.statusText}`)
        sourceBlob = await res.blob()
      }

      const seg     = await loadModel()
      const dataUrl = await blobToDataUrl(sourceBlob)
      const results = await seg(dataUrl, { return_mask: true })
      const pngBlob = await applyMask(dataUrl, results[0].mask)

      // Upload PNG to storage
      const path = `${userId}/${whiskyId}.png`
      const { error: uploadError } = await sb.storage
        .from('whisky-photos')
        .upload(path, pngBlob, { contentType: 'image/png', cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      // Get new public URL
      const { data: urlData } = sb.storage.from('whisky-photos').getPublicUrl(path)
      const newUrl = urlData.publicUrl + '?t=' + Date.now()

      // Delete old JPG
      await sb.storage.from('whisky-photos').remove([`${userId}/${whiskyId}.jpg`])

      // Update DB + local reactive state — all components showing this whisky update instantly
      await updateWhisky(whiskyId, { photo_url: newUrl })

    } catch (err) {
      console.warn(`BG removal failed for ${whiskyId}:`, err)
    } finally {
      const next = new Set(processingIds.value)
      next.delete(whiskyId)
      processingIds.value = next
    }
  })()
}

export { modelLoaded, modelLoading }
