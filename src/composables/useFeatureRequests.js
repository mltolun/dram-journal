import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const featureRequests = ref([])        // all requests (admin view)
export const myFeatureRequests = ref([])       // current user's requests

// Admin emails — add yours here or drive from env/supabase metadata
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)

export function useFeatureRequests() {

  function isAdmin() {
    return ADMIN_EMAILS.includes(currentUser.value?.email)
  }

  // ── User: submit a new feature request ──────────────────────────────────────

  async function submitRequest({ title, description, impact }) {
    const { data, error } = await sb
      .from('feature_requests')
      .insert({
        user_id:     currentUser.value.id,
        user_email:  currentUser.value.email,
        title:       title.trim(),
        description: description.trim(),
        impact:      impact.trim(),
        status:      'open',
      })
      .select()
      .single()

    if (error) throw error
    myFeatureRequests.value.unshift(data)
    return data
  }

  // ── User: load own requests ──────────────────────────────────────────────────

  async function loadMyRequests() {
    if (!currentUser.value) return
    const { data, error } = await sb
      .from('feature_requests')
      .select('*')
      .eq('user_id', currentUser.value.id)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadMyRequests:', error.message); return }
    myFeatureRequests.value = data || []
  }

  // ── Admin: load all requests ─────────────────────────────────────────────────

  async function loadAllRequests() {
    if (!isAdmin()) return
    const { data, error } = await sb
      .from('feature_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) { console.error('loadAllRequests:', error.message); return }
    featureRequests.value = data || []
  }

  // ── Admin: update a request (status, priority, due_date, admin_note) ─────────

  async function updateRequest(id, patch) {
    const { data, error } = await sb
      .from('feature_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Patch local admin list
    const idx = featureRequests.value.findIndex(r => r.id === id)
    if (idx !== -1) featureRequests.value[idx] = data

    // If admin closes the request, notify the requester via pending_notifications
    if (patch.status === 'done') {
      await sb.from('pending_notifications').insert({
        type:       'feature_request_done',
        to_email:   data.user_email,
        from_email: currentUser.value.email,
        meta:       JSON.stringify({
          feature_title: data.title,
          admin_note:    patch.admin_note || '',
        }),
      }).maybeSingle()  // fire-and-forget; ignore insert errors
    }

    return data
  }

  // ── Admin: delete a request ──────────────────────────────────────────────────

  async function deleteRequest(id) {
    const { error } = await sb
      .from('feature_requests')
      .delete()
      .eq('id', id)

    if (error) throw error
    featureRequests.value = featureRequests.value.filter(r => r.id !== id)
  }

  return {
    isAdmin,
    featureRequests,
    myFeatureRequests,
    submitRequest,
    loadMyRequests,
    loadAllRequests,
    updateRequest,
    deleteRequest,
  }
}
