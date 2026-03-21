import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { compressImage } from '../utils/compressImage.js'
import { removeBackground } from '../utils/removeBackground.js'

// If bg removal produces a result smaller than this fraction of the original,
// the model likely over-clipped the product — silently use the original instead.
const MIN_RESULT_RATIO = 0.15

export function usePhoto() {
  const pendingBlob   = ref(null)
  const previewUrl    = ref(null)
  const currentUrl    = ref(null)
  const compressedKb  = ref(null)
  const removingBg    = ref(false)

  async function selectPhoto(file) {
    removingBg.value = true
    try {
      const bgRemovedBlob = await removeBackground(file)

      // Sanity check: if the result is suspiciously small the model over-clipped.
      const ratio = bgRemovedBlob.size / file.size
      if (ratio < MIN_RESULT_RATIO) {
        console.warn(`[usePhoto] BG removal result is only ${(ratio * 100).toFixed(1)}% of original — falling back.`)
        throw new Error('Result too small, likely over-clipped')
      }

      // Store as PNG to preserve the transparent background.
      const { blob, dataUrl, kb } = await compressImage(bgRemovedBlob, 600, 0.78, 'image/png')
      pendingBlob.value  = blob
      previewUrl.value   = dataUrl
      compressedKb.value = kb
    } catch (err) {
      console.error('[usePhoto] Background removal failed, falling back to original:', err)
      // Fall back to JPEG compression of the original — no background removal.
      const { blob, dataUrl, kb } = await compressImage(file, 600, 0.78, 'image/jpeg')
      pendingBlob.value  = blob
      previewUrl.value   = dataUrl
      compressedKb.value = kb
    } finally {
      removingBg.value = false
    }
  }

  function clearPhoto() {
    pendingBlob.value  = null
    previewUrl.value   = null
    currentUrl.value   = null
    compressedKb.value = null
  }

  function loadExisting(url) {
    currentUrl.value  = url || null
    previewUrl.value  = url || null
    pendingBlob.value = null
    compressedKb.value = null
  }

  async function uploadPhoto(whiskyId) {
    if (!pendingBlob.value) return currentUrl.value

    // Use .png extension and content type when the stored blob is a PNG
    // (i.e. background was successfully removed), otherwise .jpg.
    const isPng = pendingBlob.value.type === 'image/png'
    const ext   = isPng ? 'png' : 'jpg'
    const path  = `${currentUser.value.id}/${whiskyId}.${ext}`

    const { data, error } = await sb.storage.from('whisky-photos').upload(path, pendingBlob.value, {
      contentType: pendingBlob.value.type,
      cacheControl: '3600',
      upsert: true,
    })
    if (error) { console.error(error); throw new Error('Photo upload failed: ' + error.message) }

    const { data: urlData } = sb.storage.from('whisky-photos').getPublicUrl(path)
    return urlData.publicUrl + '?t=' + Date.now()
  }

  async function deletePhoto(whiskyId, userId) {
    // Try both extensions since existing photos may be .jpg or .png
    const uid = userId || currentUser.value.id
    await Promise.allSettled([
      sb.storage.from('whisky-photos').remove([`${uid}/${whiskyId}.png`]),
      sb.storage.from('whisky-photos').remove([`${uid}/${whiskyId}.jpg`]),
    ])
  }

  return { pendingBlob, previewUrl, currentUrl, compressedKb, removingBg, selectPhoto, clearPhoto, loadExisting, uploadPhoto, deletePhoto }
}
