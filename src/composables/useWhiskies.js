import { ref, computed } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'
import { useSubscriptions } from './useSubscriptions.js'

export const whiskies   = ref([])
export const syncStatus = ref('ok') // 'loading' | 'saving' | 'ok' | 'error'

export const journal  = computed(() => whiskies.value.filter(w => (w.list || 'journal') === 'journal'))
export const wishlist = computed(() => whiskies.value.filter(w => w.list === 'wishlist'))
export const trash    = computed(() => whiskies.value.filter(w => w.list === 'trash'))

const TRASH_TTL_DAYS = 5

export function daysUntilFlush(w) {
  if (!w.deleted_at) return TRASH_TTL_DAYS
  const deletedAt = new Date(w.deleted_at)
  if (isNaN(deletedAt.getTime())) return TRASH_TTL_DAYS
  const ms = TRASH_TTL_DAYS * 24 * 60 * 60 * 1000 - (Date.now() - deletedAt.getTime())
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

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
      abv:        w.abv        || c.abv,
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
      .order('created_at', { ascending: false })

    if (error) { setSync('error'); throw error }

    const all = (data || []).map(mergeWithCatalogue)

    // Hard-delete any trash items older than 5 days
    const expired = all.filter(w => w.list === 'trash' && w.deleted_at && daysUntilFlush(w) === 0)
    if (expired.length > 0) {
      await Promise.all(expired.map(w => sb.from('whiskies').delete().eq('id', w.id)))
    }

    whiskies.value = all.filter(w => !(w.list === 'trash' && w.deleted_at && daysUntilFlush(w) === 0))
    setSync('ok')
  }

  async function insertWhisky(fields) {
    setSync('saving')

    // Prevent duplicates — check by catalogue_id if present, else by name+distillery
    if (fields.catalogue_id) {
      const exists = whiskies.value.some(w => w.catalogue_id === fields.catalogue_id && w.list !== 'trash')
      if (exists) {
        setSync('ok')
        const existing = whiskies.value.find(w => w.catalogue_id === fields.catalogue_id)
        throw new Error(`"${existing.name}" is already in your ${existing.list === 'journal' ? 'journal' : 'wishlist'}.`)
      }
    } else {
      const name = (fields.name || '').toLowerCase().trim()
      const dist = (fields.distillery || '').toLowerCase().trim()
      const exists = whiskies.value.some(w =>
        w.list !== 'trash' &&
        (w.name || '').toLowerCase().trim() === name &&
        (w.distillery || '').toLowerCase().trim() === dist
      )
      if (exists) {
        setSync('ok')
        throw new Error(`"${fields.name}" is already in your collection.`)
      }
    }
    // eslint-disable-next-line no-unused-vars
    const { catalogue, abv, ...cleanFields } = fields
    const { data, error } = await sb.from('whiskies')
      .insert({ ...cleanFields, user_id: currentUser.value.id })
      .select(WHISKY_SELECT)
      .single()
    if (error) { setSync('error'); throw error }
    const merged = mergeWithCatalogue(data)
    whiskies.value.push(merged)
    setSync('ok')

    // Create an initial dram_log when adding to journal so history isn't empty
    const list = fields.list || 'journal'
    if (list === 'journal') {
      const tastedAt = fields.date
        ? `${fields.date}T12:00:00`
        : new Date().toISOString()
      await sb.from('dram_logs').insert({
        user_id:           currentUser.value.id,
        whisky_id:         data.id,
        whisky_name:       data.name,
        whisky_distillery: data.distillery ?? null,
        tasted_at:         tastedAt,
        rating:            data.rating ?? null,
        notes:             data.notes  ?? null,
      })
    }

    // Log activity for followers
    if (list === 'wishlist') {
      await logActivity({
        type:       'wishlist_add',
        whiskyId:   data.id,
        whiskyName: data.name,
        distillery: data.distillery,
        rating:     data.rating ?? null,
        notes:      data.notes  ?? null,
      })
    }
    if (list === 'journal') {
      // Log journal_add: whisky was added to the journal
      await logActivity({
        type:       'journal_add',
        whiskyId:   data.id,
        whiskyName: data.name,
        distillery: data.distillery,
        rating:     data.rating ?? null,
        notes:      data.notes  ?? null,
      })
      // Log dram_logged: first tasting (dram_log created above)
      await logActivity({
        type:       'dram_logged',
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
    const { catalogue, abv, ...cleanFields } = fields
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

  async function moveToTrash(id) {
    const now = new Date().toISOString()
    await updateWhisky(id, { list: 'trash', deleted_at: now })
  }

  async function restoreFromTrash(id) {
    await updateWhisky(id, { list: 'journal', deleted_at: null })
  }

  async function moveToJournal(id) {
    const result = await updateWhisky(id, { list: 'journal' })
    // Create a dram_log entry — moving to journal means it's being tasted
    const tastedAt = new Date().toISOString()
    await sb.from('dram_logs').insert({
      user_id:           currentUser.value.id,
      whisky_id:         result.id,
      whisky_name:       result.name,
      whisky_distillery: result.distillery ?? null,
      tasted_at:         tastedAt,
      rating:            result.rating ?? null,
      notes:             result.notes  ?? null,
    })
    // Log both: journal_add (added to journal) and dram_logged (first tasting)
    await logActivity({
      type:       'journal_add',
      whiskyId:   result.id,
      whiskyName: result.name,
      distillery: result.distillery,
      rating:     result.rating ?? null,
      notes:      result.notes  ?? null,
    })
    await logActivity({
      type:       'dram_logged',
      whiskyId:   result.id,
      whiskyName: result.name,
      distillery: result.distillery,
      rating:     result.rating ?? null,
      notes:      result.notes  ?? null,
    })
    return result
  }

  async function logDram({ whisky, tastedAt = new Date().toISOString(), rating = null, notes = null }) {
    setSync('saving')

    if (!whisky?.id) {
      setSync('ok')
      throw new Error('Missing whisky to log')
    }

    const payload = {
      user_id:           currentUser.value.id,
      whisky_id:         whisky.id,
      whisky_name:       whisky.name,
      whisky_distillery: whisky.distillery ?? null,
      tasted_at:         tastedAt,
      rating:            rating ?? null,
      notes:             notes ?? null,
    }

    const { data, error } = await sb.from('dram_logs')
      .insert(payload)
      .select('*')
      .single()

    if (error) { setSync('error'); throw error }

    await logActivity({
      type:       'dram_logged',
      whiskyId:   whisky.id,
      whiskyName: whisky.name,
      distillery: whisky.distillery,
      rating:     rating ?? null,
      notes:      notes  ?? null,
    })

    setSync('ok')
    return data
  }

  async function getDramLogs(whiskyId) {
    const { data, error } = await sb
      .from('dram_logs')
      .select('id, tasted_at, rating, notes, created_at')
      .eq('whisky_id', whiskyId)
      .eq('user_id', currentUser.value.id)
      .order('tasted_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  return { whiskies, journal, wishlist, trash, syncStatus, loadWhiskies, insertWhisky, updateWhisky, deleteWhisky, moveToTrash, restoreFromTrash, moveToJournal, logDram, getDramLogs }
}
