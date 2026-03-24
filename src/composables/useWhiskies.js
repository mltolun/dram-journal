import { ref, computed } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { useSubscriptions } from './useSubscriptions.js'

export const whiskies = ref([])
export const syncStatus = ref('ok') // 'loading' | 'saving' | 'ok' | 'error'

export const journal   = computed(() => whiskies.value.filter(w => (w.list || 'journal') === 'journal'))
export const wishlist  = computed(() => whiskies.value.filter(w => w.list === 'wishlist'))

export function useWhiskies() {
  const { logActivity } = useSubscriptions()

  function setSync(s) { syncStatus.value = s }

  const WHISKY_SELECT = `
    *,
    catalogue:catalogue_id (
      name, distillery, country, region, type, age, abv,
      price_band, photo_url, nose, palate,
      dulzor, ahumado, cuerpo, frutado, especiado
    )
  `

  function mergeWithCatalogue(w) {
    if (!w.catalogue) return w
    const c = w.catalogue
    return {
      ...w,
      name:       w.name       || c.name,
      distillery: w.distillery || c.distillery,
      origin:     w.origin     || c.country,
      region:     w.region     || c.region,
      type:       w.type       || c.type,
      age:        w.age        || c.age,
      price:      w.price      || c.price_band,
      photo_url:  w.photo_url  || c.photo_url,
      nose:       w.nose       || c.nose,
      palate:     w.palate     || c.palate,
      dulzor:     w.dulzor     ?? c.dulzor,
      ahumado:    w.ahumado    ?? c.ahumado,
      cuerpo:     w.cuerpo     ?? c.cuerpo,
      frutado:    w.frutado    ?? c.frutado,
      especiado:  w.especiado  ?? c.especiado,
    }
  }

  async function loadWhiskies() {
    setSync('loading')
    const { data, error } = await sb
      .from('whiskies')
      .select(WHISKY_SELECT)
      .order('created_at', { ascending: true })

    if (error) { setSync('error'); throw error }
    whiskies.value = (data || []).map(mergeWithCatalogue)
    setSync('ok')
  }

  async function insertWhisky(fields) {
    setSync('saving')

    // Prevent duplicates — check by catalogue_id if present, else by name+distillery
    if (fields.catalogue_id) {
      const exists = whiskies.value.some(w => w.catalogue_id === fields.catalogue_id)
      if (exists) {
        setSync('ok')
        const existing = whiskies.value.find(w => w.catalogue_id === fields.catalogue_id)
        throw new Error(`"${existing.name}" is already in your ${existing.list === 'journal' ? 'journal' : 'wishlist'}.`)
      }
    } else {
      const name = (fields.name || '').toLowerCase().trim()
      const dist = (fields.distillery || '').toLowerCase().trim()
      const exists = whiskies.value.some(w =>
        (w.name || '').toLowerCase().trim() === name &&
        (w.distillery || '').toLowerCase().trim() === dist
      )
      if (exists) {
        setSync('ok')
        throw new Error(`"${fields.name}" is already in your collection.`)
      }
    }
    // eslint-disable-next-line no-unused-vars
    const { catalogue, ...cleanFields } = fields
    const { data, error } = await sb.from('whiskies')
      .insert({ ...cleanFields, user_id: currentUser.value.id })
      .select(WHISKY_SELECT)
      .single()
    if (error) { setSync('error'); throw error }
    const merged = mergeWithCatalogue(data)
    whiskies.value.push(merged)
    setSync('ok')

    // Log activity for followers — only journal entries (not wishlist)
    if ((fields.list || 'journal') === 'journal') {
      await logActivity({
        type:       'journal_add',
        whiskyId:   data.id,
        whiskyName: data.name,
        distillery: data.distillery,
        rating:     data.rating ?? null,
        notes:      data.notes  ?? null,
      })
    }

    return data
  }

  async function updateWhisky(id, fields) {
    setSync('saving')
    // eslint-disable-next-line no-unused-vars
    const { catalogue, ...cleanFields } = fields
    const { data, error } = await sb.from('whiskies').update(cleanFields).eq('id', id).select(WHISKY_SELECT).single()
    if (error) { setSync('error'); throw error }
    const merged = mergeWithCatalogue(data)
    const idx = whiskies.value.findIndex(w => w.id === id)
    if (idx >= 0) whiskies.value[idx] = { ...whiskies.value[idx], ...merged }
    setSync('ok')

    // Log activity when a rating is explicitly set/changed
    if (fields.rating != null) {
      await logActivity({
        type:       'rating',
        whiskyId:   data.id,
        whiskyName: data.name,
        distillery: data.distillery,
        rating:     data.rating,
        notes:      data.notes ?? null,
      })
    }

    return data
  }

  async function deleteWhisky(id) {
    setSync('saving')
    const { error } = await sb.from('whiskies').delete().eq('id', id)
    if (error) { setSync('error'); throw error }
    whiskies.value = whiskies.value.filter(w => w.id !== id)
    setSync('ok')
  }

  async function moveToJournal(id) {
    const result = await updateWhisky(id, { list: 'journal' })
    // Log as a journal_add — the whisky is now in the journal for the first time
    await logActivity({
      type:       'journal_add',
      whiskyId:   result.id,
      whiskyName: result.name,
      distillery: result.distillery,
      rating:     result.rating ?? null,
      notes:      result.notes  ?? null,
    })
    return result
  }

  async function finishBottle(id) {
    const w = whiskies.value.find(w => w.id === id)
    if (!w) return
    const newCount = (w.bottle_count || 0) + 1
    const today = new Date().toISOString().split('T')[0]
    return updateWhisky(id, { bottle_count: newCount, last_finished: today })
  }

  return { whiskies, journal, wishlist, syncStatus, loadWhiskies, insertWhisky, updateWhisky, deleteWhisky, moveToJournal, finishBottle }
}