import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const featureRequests   = ref([])    // all requests (admin view)
export const myFeatureRequests = ref([])    // current user's own requests
export const isAdminUser       = ref(false) // set after loadAdminStatus()

export function useFeatureRequests() {

  // Sync check used in template v-if. The flag is filled by loadAdminStatus()
  // from a server-side is_admin() RPC — no admin e-mail ships in the JS bundle.
  // Purely cosmetic: RLS on feature_requests is the real enforcer.
  function isAdmin() {
    return !!currentUser.value && isAdminUser.value
  }

  async function loadAdminStatus() {
    if (!currentUser.value) { isAdminUser.value = false; return false }
    const { data, error } = await sb.rpc('is_admin')
    isAdminUser.value = !error && data === true
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
      if (!data.user_email) {
        console.error('[FR notify] Aborting — user_email is missing from feature request row')
      } else {
        // Queue email notification via pending_notifications
        const { error: notifError } = await sb.from('pending_notifications').insert({
          type:       `feature_request_${patch.status}`,
          to_email:   data.user_email,
          from_email: currentUser.value.email,
          meta:       JSON.stringify({
            feature_title: data.title,
            admin_note:    patch.admin_note || '',
          }),
        })
        if (notifError) {
          console.error('[FR notify] pending_notifications insert failed:', notifError.message)
        }

        // Insert in-app inbox message for the user
        const { error: msgError } = await sb.from('direct_messages').insert({
          sender_id:       currentUser.value.id,
          recipient_id:    data.user_id,
          sender_email:    currentUser.value.email,
          recipient_email: data.user_email,
          whisky_payload:  {
            msg_type:      'feature_request',
            status:        patch.status,
            feature_title: data.title,
            admin_note:    patch.admin_note || null,
          },
        })
        if (msgError) {
          console.error('[FR notify] direct_messages insert failed:', msgError.message)
        }
      }
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
