import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { useWhiskies } from './useWhiskies.js'

const modelLoaded  = ref(false)
const modelLoading = ref(false)
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
    segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', { device: 'wasm' })
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

function sampleMaskBilinear(data, mw, mh, x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, mw - 1)
  const y1 = Math.min(y0 + 1, mh - 1)
  const fx = x - x0, fy = y - y0
  return (data[y0 * mw + x0] * (1 - fx) + data[y0 * mw + x1] * fx) * (1 - fy) +
         (data[y1 * mw + x0] * (1 - fx) + data[y1 * mw + x1] * fx) * fy
}

function gaussianBlurAlpha(alpha, w, h, radius) {
  const sigma  = radius / 2
  const size   = Math.ceil(radius) * 2 + 1
  const kernel = new Float32Array(size)
  let sum = 0
  for (let i = 0; i < size; i++) {
    const x = i - Math.floor(size / 2)
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma))
    sum += kernel[i]
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum
  const tmp  = new Float32Array(alpha.length)
  const half = Math.floor(size / 2)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let k = 0; k < size; k++) v += alpha[y * w + Math.min(Math.max(x + k - half, 0), w - 1)] * kernel[k]
      tmp[y * w + x] = v
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let k = 0; k < size; k++) v += tmp[Math.min(Math.max(y + k - half, 0), h - 1) * w + x] * kernel[k]
      alpha[y * w + x] = v
    }
}

/**
 * Erode alpha by `px` pixels using a circular kernel.
 */
function erodeAlpha(alpha, w, h, px) {
  const out = new Float32Array(alpha.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let minVal = alpha[y * w + x]
      for (let dy = -px; dy <= px; dy++) {
        for (let dx = -px; dx <= px; dx++) {
          if (dx * dx + dy * dy > px * px) continue
          minVal = Math.min(minVal, alpha[Math.min(Math.max(y + dy, 0), h - 1) * w + Math.min(Math.max(x + dx, 0), w - 1)])
        }
      }
      out[y * w + x] = minVal
    }
  }
  alpha.set(out)
}

/**
 * Sample the background colour from pixels just OUTSIDE the mask boundary
 * (alpha < 0.05 within a 6px band of the edge), not from the whole transparent region.
 * This avoids sampling the dark app UI as the background colour.
 */
function estimateBgColour(pixels, alpha, w, h) {
  // Build a dilated mask — pixels that are near the edge from outside
  const BAND = 6
  let rSum = 0, gSum = 0, bSum = 0, count = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (alpha[i] >= 0.05) continue // only look at transparent pixels
      // Check if any neighbour within BAND is opaque (inside the mask)
      let nearEdge = false
      outer: for (let dy = -BAND; dy <= BAND; dy++) {
        for (let dx = -BAND; dx <= BAND; dx++) {
          if (dx * dx + dy * dy > BAND * BAND) continue
          const ni = Math.min(Math.max(y + dy, 0), h - 1) * w + Math.min(Math.max(x + dx, 0), w - 1)
          if (alpha[ni] > 0.5) { nearEdge = true; break outer }
        }
      }
      if (nearEdge) {
        rSum += pixels[i * 4]; gSum += pixels[i * 4 + 1]; bSum += pixels[i * 4 + 2]
        count++
      }
    }
  }
  if (count === 0) return null
  return { r: rSum / count, g: gSum / count, b: bSum / count }
}

/**
 * Despill: remove background colour contamination from semi-transparent edge pixels.
 */
function despillEdges(pixels, alpha, w, h) {
  const bg = estimateBgColour(pixels, alpha, w, h)
  if (!bg) return
  for (let i = 0; i < w * h; i++) {
    const a = alpha[i]
    if (a <= 0.05 || a >= 0.95) continue
    pixels[i * 4]     = Math.min(255, Math.max(0, Math.round((pixels[i * 4]     - bg.r * (1 - a)) / a)))
    pixels[i * 4 + 1] = Math.min(255, Math.max(0, Math.round((pixels[i * 4 + 1] - bg.g * (1 - a)) / a)))
    pixels[i * 4 + 2] = Math.min(255, Math.max(0, Math.round((pixels[i * 4 + 2] - bg.b * (1 - a)) / a)))
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
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)

  const imageData = ctx.getImageData(0, 0, w, h)
  const pixels    = imageData.data
  const mw = mask.width, mh = mask.height

  // 1 — bilinear-sample mask into float alpha buffer at output resolution
  const alpha = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const srcY = (y / (h - 1)) * (mh - 1)
    for (let x = 0; x < w; x++) {
      alpha[y * w + x] = sampleMaskBilinear(mask.data, mw, mh, (x / (w - 1)) * (mw - 1), srcY)
    }
  }

  // 2 — despill BEFORE erosion so we sample the original background pixels while they're still present
  despillEdges(pixels, alpha, w, h)

  // 3 — adaptive erosion: stronger where edge pixels are bright (halo-prone), lighter elsewhere
  //     Pass 1: light erosion (1px) on all edges
  erodeAlpha(alpha, w, h, 1)
  //     Pass 2: extra 2px erosion only on pixels whose colour brightness suggests bg contamination
  const brightAlpha = new Float32Array(alpha)
  for (let i = 0; i < w * h; i++) {
    const a = alpha[i]
    if (a < 0.05 || a > 0.95) continue
    const brightness = (pixels[i * 4] * 0.299 + pixels[i * 4 + 1] * 0.587 + pixels[i * 4 + 2] * 0.114) / 255
    if (brightness > 0.75) brightAlpha[i] = 0 // treat very bright edge pixels as background
  }
  // Blend: use the aggressive mask where brightness suggests contamination
  for (let i = 0; i < w * h; i++) alpha[i] = Math.min(alpha[i], brightAlpha[i])

  // 4 — Gaussian blur to smooth the eroded edge
  gaussianBlurAlpha(alpha, w, h, 1.5)

  // 5 — write alpha
  for (let i = 0; i < w * h; i++) {
    pixels[i * 4 + 3] = Math.round(Math.min(Math.max(alpha[i], 0), 1) * 255)
  }
  ctx.putImageData(imageData, 0, 0)

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png')
  })
}

// Queue of pending jobs — processed one at a time to keep memory pressure low
const bgQueue = []
let bgRunning = false

async function drainQueue() {
  if (bgRunning) return
  bgRunning = true
  while (bgQueue.length > 0) {
    const job = bgQueue.shift()
    await runBgRemoval(job)
    // Yield between jobs so the browser can GC before the next model run
    await new Promise(r => setTimeout(r, 500))
  }
  bgRunning = false
}

async function runBgRemoval({ whiskyId, userId, sourceBlob }) {
  try {
    const { updateWhisky } = useWhiskies()

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
}

export function removeBgInBackground(whiskyId, sourceBlob, photoUrl = null) {
  const userId = currentUser.value?.id
  if (!userId) return
  if (processingIds.value.has(whiskyId)) return
  processingIds.value = new Set([...processingIds.value, whiskyId])

  // Resolve the blob first (fetch if needed), then enqueue
  ;(async () => {
    try {
      let blob = sourceBlob
      if (!blob) {
        if (!photoUrl) throw new Error('No blob or photoUrl provided')
        const res = await fetch(photoUrl)
        if (!res.ok) throw new Error(`Failed to fetch photo: ${res.statusText}`)
        blob = await res.blob()
      }

      bgQueue.push({ whiskyId, userId, sourceBlob: blob })

      // Wait for the browser to be idle before starting, to avoid competing
      // with page rendering and triggering the low-memory reload
      const start = () => drainQueue()
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(start, { timeout: 10000 })
      } else {
        setTimeout(start, 2000)
      }
    } catch (err) {
      console.warn(`BG removal enqueue failed for ${whiskyId}:`, err)
      const next = new Set(processingIds.value)
      next.delete(whiskyId)
      processingIds.value = next
    }
  })()
}

export { modelLoaded, modelLoading }