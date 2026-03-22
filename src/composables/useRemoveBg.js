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
      device: 'wasm',
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

const MAX_PNG_PX = 600

/**
 * Bilinear interpolation of the Float32 mask at a fractional (x, y) position.
 */
function sampleMaskBilinear(data, mw, mh, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, mw - 1)
  const y1 = Math.min(y0 + 1, mh - 1)
  const fx = x - x0, fy = y - y0

  const v00 = data[y0 * mw + x0]
  const v10 = data[y0 * mw + x1]
  const v01 = data[y1 * mw + x0]
  const v11 = data[y1 * mw + x1]

  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) +
         (v01 * (1 - fx) + v11 * fx) * fy
}

/**
 * Apply a 1D Gaussian kernel to a Float32Array alpha channel (separable pass).
 * Operates in-place on `alpha` (length = w * h).
 */
function gaussianBlurAlpha(alpha, w, h, radius) {
  const sigma = radius / 2
  const size  = Math.ceil(radius) * 2 + 1
  const kernel = new Float32Array(size)
  let sum = 0
  for (let i = 0; i < size; i++) {
    const x = i - Math.floor(size / 2)
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
    sum += kernel[i]
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum

  const tmp = new Float32Array(alpha.length)
  const half = Math.floor(size / 2)

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let k = 0; k < size; k++) {
        const sx = Math.min(Math.max(x + k - half, 0), w - 1)
        v += alpha[y * w + sx] * kernel[k]
      }
      tmp[y * w + x] = v
    }
  }

  // Vertical pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let k = 0; k < size; k++) {
        const sy = Math.min(Math.max(y + k - half, 0), h - 1)
        v += tmp[sy * w + x] * kernel[k]
      }
      alpha[y * w + x] = v
    }
  }
}

async function applyMask(dataUrl, mask) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload  = () => resolve(el)
    el.onerror = reject
    el.src = dataUrl
  })

  let w = img.width, h = img.height
  if (w > MAX_PNG_PX || h > MAX_PNG_PX) {
    if (w > h) { h = Math.round(h * MAX_PNG_PX / w); w = MAX_PNG_PX }
    else       { w = Math.round(w * MAX_PNG_PX / h); h = MAX_PNG_PX }
  }

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const pixels    = imageData.data

  const mw = mask.width
  const mh = mask.height

  // Step 1 — bilinear-sample the mask into a float alpha buffer at output resolution
  const alpha = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const srcY = (y / (h - 1)) * (mh - 1)
    for (let x = 0; x < w; x++) {
      const srcX = (x / (w - 1)) * (mw - 1)
      alpha[y * w + x] = sampleMaskBilinear(mask.data, mw, mh, srcX, srcY)
    }
  }

  // Step 2 — light Gaussian blur on the alpha channel to soften hard edges (radius ~1.2px)
  gaussianBlurAlpha(alpha, w, h, 1.2)

  // Step 3 — write alpha into the image pixels
  for (let i = 0; i < w * h; i++) {
    pixels[i * 4 + 3] = Math.round(Math.min(Math.max(alpha[i], 0), 1) * 255)
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
  })
}

/**
 * Fire-and-forget: run bg removal in the background after the record is saved.
 */
export function removeBgInBackground(whiskyId, jpegBlob, photoUrl = null) {
  const userId = currentUser.value?.id
  if (!userId) return

  if (processingIds.value.has(whiskyId)) return
  processingIds.value = new Set([...processingIds.value, whiskyId])

  ;(async () => {
    try {
      const { updateWhisky } = useWhiskies()

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

      const path = `${userId}/${whiskyId}.png`
      const { error: uploadError } = await sb.storage
        .from('whisky-photos')
        .upload(path, pngBlob, { contentType: 'image/png', cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = sb.storage.from('whisky-photos').getPublicUrl(path)
      const newUrl = urlData.publicUrl + '?t=' + Date.now()

      await sb.storage.from('whisky-photos').remove([`${userId}/${whiskyId}.jpg`])
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