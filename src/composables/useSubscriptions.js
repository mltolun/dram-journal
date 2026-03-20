import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const pendingRequests     = ref([])   // people who want to follow me
export const myFollowing         = ref([])   // people I follow (accepted)
export const myFollowers         = ref([])   // people who follow me (accepted)
export const subscriptionsLoaded = ref(false)

// ── Queue a notification row (non-fatal — never blocks the UI action) ─────────

async function queueNotification(type, toEmail, fromEmail) {
  try {
    await sb.from('pending_notifications').insert({ type, to_email: toEmail, from_email: fromEmail })
  } catch (err) {
    console.warn('queueNotification failed:', err?.message)
  }
}

export function useSubscriptions() {

  // ── Load all subscription rows for current user ──────────────────────────

  async function loadSubscriptions() {
    if (!currentUser.value) return
    const uid = currentUser.value.id

    const { data, error } = await sb
      .from('subscriptions')
      .select('*')
      .or(`follower_id.eq.${uid},following_id.eq.${uid}`)

    if (error) throw error

    pendingRequests.value = data.filter(
      r => r.following_id === uid && r.status === 'pending'
    )
    myFollowing.value = data.filter(
      r => r.follower_id === uid && r.status === 'accepted'
    )
    myFollowers.value = data.filter(
      r => r.following_id === uid && r.status === 'accepted'
    )
    subscriptionsLoaded.value = true
  }

  // ── Send a follow request ─────────────────────────────────────────────────

  async function requestFollowByEmail(email) {
    const uid = currentUser.value?.id
    if (!uid) throw new Error('Not authenticated')

    const normalized = email.trim().toLowerCase()

    if (normalized === currentUser.value?.email?.toLowerCase()) throw new Error('You cannot follow yourself')

    const { data: targetId, error: rpcError } = await sb
      .rpc('get_user_id_by_email', { p_email: normalized })

    if (rpcError || !targetId) throw new Error('No user found with that email address')

    const { error } = await sb
      .from('subscriptions')
      .insert({
        follower_id:     uid,
        following_id:    targetId,
        status:          'pending',
        follower_email:  currentUser.value.email?.toLowerCase(),
        following_email: normalized,
      })

    if (error) {
      if (error.code === '23505') throw new Error('You already sent a request to this user')
      throw error
    }

    await loadSubscriptions()

    // Queue notification — daily Action will send the email
    queueNotification('follow_request', normalized, currentUser.value.email)
  }

  // ── Accept a pending request ──────────────────────────────────────────────
  // requesterEmail passed in from SubscriptionsPanel which already has it

  async function acceptRequest(subscriptionId, requesterEmail) {
    const { error } = await sb
      .from('subscriptions')
      .update({ status: 'accepted' })
      .eq('id', subscriptionId)
      .eq('following_id', currentUser.value?.id)

    if (error) throw error
    await loadSubscriptions()

    // Queue notification — daily Action will send the email
    if (requesterEmail) {
      queueNotification('follow_accepted', requesterEmail, currentUser.value.email)
    }
  }

  // ── Decline / remove a subscription ──────────────────────────────────────

  async function removeSubscription(subscriptionId) {
    const { error } = await sb
      .from('subscriptions')
      .delete()
      .eq('id', subscriptionId)

    if (error) throw error
    await loadSubscriptions()
  }

  // ── Log a user activity event ─────────────────────────────────────────────

  async function logActivity({ type, whiskyId, whiskyName, distillery, rating, notes }) {
    const uid = currentUser.value?.id
    if (!uid) return

    // whisky_id is a uuid column — only pass it if it looks like a real UUID,
    // not a Date.now() timestamp fallback from WhiskyModal
    const isUuid = typeof whiskyId === 'string' && /^[0-9a-f-]{36}$/.test(whiskyId)

    const { error } = await sb.from('activity_feed').insert({
      user_id:           uid,
      type,
      whisky_id:         isUuid ? whiskyId : null,
      whisky_name:       whiskyName,
      whisky_distillery: distillery ?? null,
      rating:            rating     ?? null,
      notes:             notes      ?? null,
    })

    if (error) console.error('activity_feed insert failed:', error.message)
  }

  return {
    pendingRequests,
    myFollowing,
    myFollowers,
    subscriptionsLoaded,
    loadSubscriptions,
    requestFollowByEmail,
    acceptRequest,
    removeSubscription,
    logActivity,
  }
}
