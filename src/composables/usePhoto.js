import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { compressImage } from '../utils/compressImage.js'

export function usePhoto() {
  const pendingBlob  = ref(null)
  const previewUrl   = ref(null)
  const currentUrl   = ref(null)
  const compressedKb = ref(null)

  async function selectPhoto(file) {
    const { blob, dataUrl, kb } = await compressImage(file, 600, 0.78)
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
    currentUrl.value   = url || null
    previewUrl.value   = url || null
    pendingBlob.value  = null
    compressedKb.value = null
  }

  async function uploadPhoto(whiskyId) {
    if (!pendingBlob.value) return currentUrl.value

    const path = `${currentUser.value.id}/${whiskyId}.jpg`
    const { error } = await sb.storage.from('whisky-photos').upload(path, pendingBlob.value, {
      contentType:  'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    })
    if (error) { console.error(error); throw new Error('Photo upload failed: ' + error.message) }

    const { data: urlData } = sb.storage.from('whisky-photos').getPublicUrl(path)
    return urlData.publicUrl + '?t=' + Date.now()
  }

  async function deletePhoto(whiskyId, userId, photoUrl) {
    const ext  = photoUrl?.match(/\.(png|jpg|jpeg)(\?|$)/i)?.[1] ?? 'jpg'
    const path = `${userId || currentUser.value.id}/${whiskyId}.${ext}`
    await sb.storage.from('whisky-photos').remove([path])
  }

  return { pendingBlob, previewUrl, currentUrl, compressedKb, selectPhoto, clearPhoto, loadExisting, uploadPhoto, deletePhoto }
}