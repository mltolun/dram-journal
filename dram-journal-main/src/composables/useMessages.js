import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from './useAuth.js'

export const inbox     = ref([])   // messages received
export const unreadCount = ref(0)

export function useMessages() {

  async function loadInbox() {
    if (!currentUser.value) return
    const { data, error } = await sb
      .from('direct_messages')
      .select('*')
      .eq('recipient_id', currentUser.value.id)
      .order('created_at', { ascending: false })

    if (error) { console.error('loadInbox failed:', error.message); return }
    inbox.value     = data || []
    unreadCount.value = inbox.value.filter(m => !m.read).length
  }

  async function sendMessage(recipientId, recipientEmail, whisky) {
    const { error } = await sb
      .from('direct_messages')
      .insert({
        sender_id:      currentUser.value.id,
        recipient_id:   recipientId,
        sender_email:   currentUser.value.email,
        recipient_email: recipientEmail,
        whisky_payload: whisky,
      })
    if (error) throw error

    // Queue a notification email for the daily cron
    await sb.from('pending_notifications').insert({
      type:       'direct_message',
      to_email:   recipientEmail,
      from_email: currentUser.value.email,
      meta:       JSON.stringify({
        whisky_name:  whisky.name,
        distillery:   whisky.distillery || '',
      }),
    })
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
    await sb
      .from('direct_messages')
      .update({ read: true })
      .in('id', unread)
    inbox.value.forEach(m => { m.read = true })
    unreadCount.value = 0
  }

  async function deleteMessage(messageId) {
    const { error } = await sb
      .from('direct_messages')
      .delete()
      .eq('id', messageId)
    if (error) { console.error('deleteMessage failed:', error.message); return }
    inbox.value = inbox.value.filter(m => m.id !== messageId)
    unreadCount.value = inbox.value.filter(m => !m.read).length
  }

  return { inbox, unreadCount, loadInbox, sendMessage, markRead, markAllRead, deleteMessage }
}
