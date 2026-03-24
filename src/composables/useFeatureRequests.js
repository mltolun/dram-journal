import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const featureRequests   = ref([])    // all requests (admin view)
export const myFeatureRequests = ref([])    // current user's own requests
export const isAdminUser       = ref(false) // set after loadAdminStatus()

// Case-insensitive list from env var (optional — RLS is the real enforcer)
const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

export function useFeatureRequests() {

  // Sync check used in template v-if — case-insensitive, falls back to
  // the reactive isAdminUser flag if no env var is configured.
  function isAdmin() {
    const email = currentUser.value?.email?.toLowerCase()
    if (!email) return false
    if (ADMIN_EMAILS.length > 0) return ADMIN_EMAILS.includes(email)
    return isAdminUser.value
  }

  // Async probe — does a lightweight HEAD query. If RLS allows it → admin.
  // Called by AdminFeaturePanel on mount so the panel self-validates
  // without depending on the env var being set correctly.
  async function loadAdminStatus() {
    const { error } = await sb
      .from('feature_requests')
      .select('id', { count: 'exact', head: true })

    isAdminUser.value = !error
    return isAdminUser.value
  }

  // ── User: submit ─────────────────────────────────────────────────────────────

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

  // ── Admin: load all requests (no isAdmin() guard — RLS enforces it) ──────────

  async function loadAllRequests() {
    const { data, error } = await sb
      .from('feature_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) { console.error('loadAllRequests:', error.message); return }
    featureRequests.value = data || []
  }

  // ── Admin: update ────────────────────────────────────────────────────────────

  async function updateRequest(id, patch) {
    const { data, error } = await sb
      .from('feature_requests')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const idx = featureRequests.value.findIndex(r => r.id === id)
    if (idx !== -1) featureRequests.value[idx] = data

    const notifiableStatuses = ['accepted', 'in_progress', 'done', 'declined']
    if (patch.status && notifiableStatuses.includes(patch.status)) {
      const { error: notifError } = await sb.from('pending_notifications').insert({
        type:       `feature_request_${patch.status}`,
        to_email:   data.user_email,
        from_email: currentUser.value.email,
        meta:       JSON.stringify({
          feature_title: data.title,
          admin_note:    patch.admin_note || '',
        }),
      })
      if (notifError) console.error('pending_notifications insert failed:', notifError.message)
    }

    return data
  }

  // ── Admin: delete ────────────────────────────────────────────────────────────

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
    isAdminUser,
    loadAdminStatus,
    featureRequests,
    myFeatureRequests,
    submitRequest,
    loadMyRequests,
    loadAllRequests,
    updateRequest,
    deleteRequest,
  }
}