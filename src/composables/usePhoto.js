import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { compressImage } from '../utils/compressImage.js'
import { removeBackground } from '../utils/removeBackground.js'

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
      const { blob, dataUrl, kb } = await compressImage(bgRemovedBlob, 600, 0.78)
      pendingBlob.value  = blob
      previewUrl.value   = dataUrl
      compressedKb.value = kb
    } catch (err) {
      console.error('[usePhoto] Background removal failed, falling back to original:', err)
      const { blob, dataUrl, kb } = await compressImage(file, 600, 0.78)
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
    const path = `${currentUser.value.id}/${whiskyId}.jpg`

    const { data, error } = await sb.storage.from('whisky-photos').upload(path, pendingBlob.value, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    })
    if (error) { console.error(error); throw new Error('Photo upload failed: ' + error.message) }

    const { data: urlData } = sb.storage.from('whisky-photos').getPublicUrl(path)
    return urlData.publicUrl + '?t=' + Date.now()
  }

  async function deletePhoto(whiskyId, userId) {
    const path = `${userId || currentUser.value.id}/${whiskyId}.jpg`
    await sb.storage.from('whisky-photos').remove([path])
  }

  return { pendingBlob, previewUrl, currentUrl, compressedKb, removingBg, selectPhoto, clearPhoto, loadExisting, uploadPhoto, deletePhoto }
}
