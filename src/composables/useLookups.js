import { ref } from 'vue'
import { sb } from '../lib/supabase.js'

export const lookups = ref({ distillery: [], origin: [] })

export function useLookups() {
  async function loadLookups() {
    const { data, error } = await sb.from('lookup_options').select('category,value').order('value')
    if (error) { console.warn('lookup_options:', error.message); return }
    lookups.value.distillery = data.filter(r => r.category === 'distillery').map(r => r.value)
    lookups.value.origin     = data.filter(r => r.category === 'origin').map(r => r.value)
  }

  async function addLookup(category, value) {
    const { error } = await sb.from('lookup_options').insert({ category, value })
    if (error && !error.message.includes('duplicate')) throw error
    if (!lookups.value[category].includes(value)) {
      lookups.value[category].push(value)
      lookups.value[category].sort((a, b) => a.localeCompare(b))
    }
  }

  return { lookups, loadLookups, addLookup }
}
