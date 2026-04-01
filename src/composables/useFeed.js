import { ref } from 'vue'
import { sb } from '../lib/supabase.js'
import { myFollowing } from './useSubscriptions.js'
import { currentUser } from './useAuth.js'

export const feedItems    = ref([])
export const feedLoading  = ref(false)
export const displayNames = ref(new Map()) // userId → display name

export function useFeed() {

  async function loadFeed() {
    if (!currentUser.value) return

    const following = myFollowing.value
    if (following.length === 0) {
      feedItems.value = []
      return
    }

    feedLoading.value = true
    try {
      const followingIds = following.map(s => s.following_id)

      // Build display name map from subscription emails (available without an extra query)
      const nameMap = new Map()
      for (const s of following) {
        const email = s.following_email || ''
        const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
        nameMap.set(s.following_id, name || email.slice(0, 14))
      }
      displayNames.value = nameMap

      const { data, error } = await sb
        .from('activity_feed')
        .select('id, user_id, type, whisky_name, whisky_distillery, whisky_id, rating, notes, created_at')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      console.log('[feed] raw:', data?.length, 'error:', error)

      // Collapse all events for the same (user_id, whisky_name) into one card.
      const merged = new Map()
      for (const item of (data || [])) {
        const key = `${item.user_id}|${item.whisky_name}`
        if (!merged.has(key)) {
          merged.set(key, { ...item })
        } else {
          const existing = merged.get(key)
          if (!existing.rating    && item.rating)    existing.rating    = item.rating
          if (!existing.notes     && item.notes)     existing.notes     = item.notes
          if (!existing.whisky_id && item.whisky_id) existing.whisky_id = item.whisky_id
        }
      }
      const items = [...merged.values()].slice(0, 50)

      // Batch-fetch photos from catalogue directly by name+distillery.
      // (whiskies table is RLS-protected — we cannot read other users' rows.)
      const needPhoto = items.filter(i => i.whisky_name)
      const photoMap = new Map() // whisky_name → photo_url
      if (needPhoto.length > 0) {
        const names = [...new Set(needPhoto.map(i => i.whisky_name))]
        const { data: cData, error: cError } = await sb
          .from('catalogue')
          .select('name, photo_url, nose, palate')
          .in('name', names)
        console.log('[feed] catalogue:', cData?.length, 'error:', cError?.message)
        for (const c of (cData || [])) {
          photoMap.set(c.name, {
            photo_url: c.photo_url || null,
            nose:      c.nose      || null,
            palate:    c.palate    || null,
          })
        }
      }

      console.log('[feed] items after merge:', items.length)
      feedItems.value = items.map(item => {
        const cat = photoMap.get(item.whisky_name)
        return {
          ...item,
          photo_url: cat?.photo_url ?? null,
          nose:      cat?.nose      ?? null,
          palate:    cat?.palate    ?? null,
        }
      })
    } catch (err) {
      console.error('useFeed loadFeed error:', err?.message)
    } finally {
      feedLoading.value = false
    }
  }

  return { feedItems, feedLoading, displayNames, loadFeed }
}
