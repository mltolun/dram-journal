import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const whiskies = ref([])
export const syncStatus = ref('ok') // 'loading' | 'saving' | 'ok' | 'error'

export function useWhiskies() {
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
    return data
  }

  async function updateWhisky(id, fields) {
    setSync('saving')
    const { data, error } = await sb.from('whiskies').update(fields).eq('id', id).select().single()
    if (error) { setSync('error'); throw error }
    const idx = whiskies.value.findIndex(w => w.id === id)
    if (idx >= 0) whiskies.value[idx] = { ...whiskies.value[idx], ...data }
    setSync('ok')
    return data
  }

  async function deleteWhisky(id) {
    setSync('saving')
    const { error } = await sb.from('whiskies').delete().eq('id', id)
    if (error) { setSync('error'); throw error }
    whiskies.value = whiskies.value.filter(w => w.id !== id)
    setSync('ok')
  }

  return { whiskies, syncStatus, loadWhiskies, insertWhisky, updateWhisky, deleteWhisky }
}
