import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const inbox        = ref([])   // messages received
export const sent         = ref([])   // messages sent
export const unreadCount  = ref(0)
export const messagesError = ref(false)

export function useMessages() {

  async function loadInbox() {
    if (!currentUser.value) return
    messagesError.value = false
    const { data, error } = await sb
      .from('direct_messages')
      .select('*')
      .eq('recipient_id', currentUser.value.id)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadInbox failed:', error.message); messagesError.value = true; return }
    inbox.value       = data || []
    unreadCount.value = inbox.value.filter(m => !m.read).length
  }

  async function loadSent() {
    if (!currentUser.value) return
    messagesError.value = false
    const { data, error } = await sb
      .from('direct_messages')
      .select('*')
      .eq('sender_id', currentUser.value.id)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadSent failed:', error.message); messagesError.value = true; return }
    sent.value = data || []
  }

  async function sendMessage(recipientId, recipientEmail, whisky, message = '') {
    const payload = message.trim()
      ? { ...whisky, _message: message.trim() }
      : whisky

    const { error } = await sb
      .from('direct_messages')
      .insert({
        sender_id:       currentUser.value.id,
        recipient_id:    recipientId,
        sender_email:    currentUser.value.email,
        recipient_email: recipientEmail,
        whisky_payload:  payload,
      })
    if (error) throw error

    // Queue a notification email for the daily cron (best-effort)
    const { error: notifErr } = await sb.from('pending_notifications').insert({
      type:       'direct_message',
      to_email:   recipientEmail,
      from_email: currentUser.value.email,
      meta:       JSON.stringify({
        whisky_name: whisky.name,
        distillery:  whisky.distillery || '',
        message:     message.trim() || '',
      }),
    })
    if (notifErr) console.warn('direct_message notification queue failed:', notifErr.message)
  }

  async function markRead(messageId) {
    const { error } = await sb
      .from('direct_messages')
      .update({ read: true })
      .eq('id', messageId)
      .eq('recipient_id', currentUser.value.id)
    if (error) { console.error('markRead failed:', error.message); return }
    const msg = inbox.value.find(m => m.id === messageId)
    if (msg) { msg.read = true }
    unreadCount.value = inbox.value.filter(m => !m.read).length
  }

  async function markAllRead() {
    const unread = inbox.value.filter(m => !m.read).map(m => m.id)
    if (!unread.length) return
    const { error } = await sb
      .from('direct_messages')
      .update({ read: true })
      .in('id', unread)
    if (error) { console.error('markAllRead failed:', error.message); throw error }
    inbox.value.forEach(m => { m.read = true })
    unreadCount.value = 0
  }

  async function deleteMessage(messageId) {
    const { error } = await sb
      .from('direct_messages')
      .delete()
      .eq('id', messageId)
      .eq('recipient_id', currentUser.value.id)
    if (error) { console.error('deleteMessage failed:', error.message); throw error }
    inbox.value       = inbox.value.filter(m => m.id !== messageId)
    unreadCount.value = inbox.value.filter(m => !m.read).length
  }

  async function deleteSentMessage(messageId) {
    const { error } = await sb
      .from('direct_messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', currentUser.value.id)
    if (error) { console.error('deleteSentMessage failed:', error.message); throw error }
    sent.value = sent.value.filter(m => m.id !== messageId)
  }

  return { inbox, sent, unreadCount, messagesError, loadInbox, loadSent, sendMessage, markRead, markAllRead, deleteMessage, deleteSentMessage }
}