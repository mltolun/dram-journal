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

  async function loadWhiskies() {
    setSync('loading')
    const { data, error } = await sb.from('whiskies').select('*').order('created_at', { ascending: true })
    if (error) { setSync('error'); throw error }
    whiskies.value = data
    setSync('ok')
  }

  async function insertWhisky(fields) {
    setSync('saving')
    const { data, error } = await sb.from('whiskies')
      .insert({ ...fields, user_id: currentUser.value.id })
      .select().single()
    if (error) { setSync('error'); throw error }
    whiskies.value.push(data)
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
    const { data, error } = await sb.from('whiskies').update(fields).eq('id', id).select().single()
    if (error) { setSync('error'); throw error }
    const idx = whiskies.value.findIndex(w => w.id === id)
    if (idx >= 0) whiskies.value[idx] = { ...whiskies.value[idx], ...data }
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
    return updateWhisky(id, { list: 'journal' })
  }

  return { whiskies, journal, wishlist, syncStatus, loadWhiskies, insertWhisky, updateWhisky, deleteWhisky, moveToJournal }
}
