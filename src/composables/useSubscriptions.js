import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const pendingRequests   = ref([])   // people who want to follow me
export const myFollowing       = ref([])   // people I follow (accepted)
export const myFollowers       = ref([])   // people who follow me (accepted)
export const subscriptionsLoaded = ref(false)

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

  // ── Send a follow request by email ───────────────────────────────────────
  // We look up the target user via a Supabase RPC (no direct auth.users access
  // from the client). Requires the helper function below to exist in Supabase.

  async function requestFollowByEmail(email) {
    const uid = currentUser.value?.id
    if (!uid) throw new Error('Not authenticated')
    if (email === currentUser.value?.email) throw new Error('You cannot follow yourself')

    // Call a Supabase RPC that returns the user_id for a given email
    // (requires the RPC defined in the companion migration)
    const { data: targetId, error: rpcError } = await sb
      .rpc('get_user_id_by_email', { p_email: email })

    if (rpcError || !targetId) throw new Error('No user found with that email address')

    const { error } = await sb
      .from('subscriptions')
      .insert({ follower_id: uid, following_id: targetId, status: 'pending' })

    if (error) {
      if (error.code === '23505') throw new Error('You already sent a request to this user')
      throw error
    }

    await loadSubscriptions()
  }

  // ── Accept a pending request ──────────────────────────────────────────────

  async function acceptRequest(subscriptionId) {
    const { error } = await sb
      .from('subscriptions')
      .update({ status: 'accepted' })
      .eq('id', subscriptionId)
      .eq('following_id', currentUser.value?.id)

    if (error) throw error
    await loadSubscriptions()
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

    await sb.from('activity_feed').insert({
      user_id:          uid,
      type,
      whisky_id:        whiskyId  ?? null,
      whisky_name:      whiskyName,
      whisky_distillery: distillery ?? null,
      rating:           rating     ?? null,
      notes:            notes      ?? null,
    })
    // Non-fatal — don't throw if this fails
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
