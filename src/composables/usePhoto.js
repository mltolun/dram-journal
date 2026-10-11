import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { compressImage } from '../utils/compressImage.js'
import { randomId } from '../utils/randomId.js'

const BUCKET = 'whisky-photos'

/** Object path inside the bucket for one of our public URLs, else null. */
export function storagePathFromUrl(url) {
  const m = String(url || '').match(/\/storage\/v1\/object\/public\/whisky-photos\/([^?#]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function usePhoto() {
  const pendingBlob  = ref(null)
  const previewUrl   = ref(null)
  const currentUrl   = ref(null)
  const compressedKb = ref(null)
  let existingUrl     = null   // URL loaded from the DB (replaced on upload)

  async function selectPhoto(file) {
    const { blob, dataUrl, kb } = await compressImage(file, 600, 0.78, 'image/webp')
    pendingBlob.value  = blob
    previewUrl.value   = dataUrl
    compressedKb.value = kb
  }

  function clearPhoto() {
    pendingBlob.value  = null
    previewUrl.value   = null
    currentUrl.value   = null
    compressedKb.value = null
  }

  function loadExisting(url) {
    existingUrl        = url || null
    currentUrl.value   = url || null
    previewUrl.value   = url || null
    pendingBlob.value  = null
    compressedKb.value = null
  }

  async function uploadPhoto(whiskyId) {
    if (!pendingBlob.value) return currentUrl.value
    const ext  = pendingBlob.value.type === 'image/webp' ? 'webp' : 'jpg'
    // Random suffix: object URLs are public, so they must not be guessable
    // from the (timestamp-based) whisky id.
    const path = `${currentUser.value.id}/${whiskyId}-${randomId()}.${ext}`
    const { error } = await sb.storage.from(BUCKET).upload(path, pendingBlob.value, {
      contentType:  ext === 'webp' ? 'image/webp' : 'image/jpeg',
      cacheControl: '31536000',   // immutable: every upload gets a fresh path
      upsert: false,
    })
    if (error) { console.error(error); throw new Error('Photo upload failed: ' + error.message) }
    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(path)

    // Replace, don't accumulate: drop the previous object for this entry.
    const oldPath = storagePathFromUrl(existingUrl)
    if (oldPath && oldPath !== path) {
      const { error: rmErr } = (await sb.storage.from(BUCKET).remove([oldPath])) ?? {}
      if (rmErr) console.error('Old photo cleanup failed:', rmErr)
    }
    existingUrl = urlData.publicUrl
    return urlData.publicUrl
  }

  async function deletePhoto(whiskyId, userId, photoUrl) {
    // New uploads carry a random suffix, so derive the path from the URL;
    // fall back to the legacy "<user>/<id>.<ext>" layout.
    const ext  = photoUrl?.match(/\.(png|jpg|jpeg|webp)(\?|$)/i)?.[1] ?? 'jpg'
    const path = storagePathFromUrl(photoUrl) ?? `${userId || currentUser.value.id}/${whiskyId}.${ext}`
    const { error } = (await sb.storage.from(BUCKET).remove([path])) ?? {}
    if (error) console.error('Photo cleanup failed (storage object may be orphaned):', error)
  }

  return { pendingBlob, previewUrl, currentUrl, compressedKb, selectPhoto, clearPhoto, loadExisting, uploadPhoto, deletePhoto }
}
