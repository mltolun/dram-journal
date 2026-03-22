import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { compressImage } from '../utils/compressImage.js'
import { removeBgInBackground } from './useRemoveBg.js'

export function usePhoto() {
  const pendingBlob    = ref(null)
  const pendingRawFile = ref(null)  // original file — passed to bg removal at full res
  const previewUrl     = ref(null)
  const currentUrl     = ref(null)
  const compressedKb   = ref(null)

  async function selectPhoto(file) {
    // Compress for preview and quick JPEG upload — but keep the raw file for bg removal
    const { blob, dataUrl, kb } = await compressImage(file, 1024, 0.85)
    pendingBlob.value    = blob
    pendingRawFile.value = file   // original, untouched
    previewUrl.value     = dataUrl
    compressedKb.value   = kb
  }

  function clearPhoto() {
    pendingBlob.value    = null
    pendingRawFile.value = null
    previewUrl.value     = null
    currentUrl.value     = null
    compressedKb.value   = null
  }

  function loadExisting(url) {
    currentUrl.value     = url || null
    previewUrl.value     = url || null
    pendingBlob.value    = null
    pendingRawFile.value = null
    compressedKb.value   = null
  }

  async function uploadPhoto(whiskyId) {
    if (!pendingBlob.value) return currentUrl.value

    // Upload compressed JPEG immediately — fast placeholder while bg removal runs
    const path = `${currentUser.value.id}/${whiskyId}.jpg`
    const { error } = await sb.storage.from('whisky-photos').upload(path, pendingBlob.value, {
      contentType:  'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    })
    if (error) { console.error(error); throw new Error('Photo upload failed: ' + error.message) }

    const { data: urlData } = sb.storage.from('whisky-photos').getPublicUrl(path)
    const jpegUrl = urlData.publicUrl + '?t=' + Date.now()

    // Pass the original raw file to bg removal — better mask quality at full resolution
    removeBgInBackground(whiskyId, pendingRawFile.value ?? pendingBlob.value)

    return jpegUrl
  }

  async function deletePhoto(whiskyId, userId, photoUrl) {
    const ext  = photoUrl?.match(/\\.(png|jpg|jpeg)(\\?|$)/i)?.[1] ?? 'jpg'
    const path = `${userId || currentUser.value.id}/${whiskyId}.${ext}`
    await sb.storage.from('whisky-photos').remove([path])
  }

  return { pendingBlob, previewUrl, currentUrl, compressedKb, selectPhoto, clearPhoto, loadExisting, uploadPhoto, deletePhoto }
}