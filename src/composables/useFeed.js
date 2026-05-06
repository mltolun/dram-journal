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

    feedLoading.value = true
    try {
      const following = myFollowing.value

      // ── Social activity (from followed users) ──────────────────────────────
      let socialItems = []
      if (following.length > 0) {
        const followingIds = following.map(s => s.following_id)

       // Build display name map from subscription emails (available without an extra query)
       const nameMap = new Map()
       for (const s of following) {
         const email = s.following_email || ''
         const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim()
         nameMap.set(s.following_id, name || email.slice(0, 14))
       }
       displayNames.value = nameMap

       // ── Timeline: fetch tastings from dram_logs only ──────────────────────
       // The timeline shows actual tastings (dram_logs). Other activity types
       // (journal_add, rating, wishlist_add) are stored in activity_feed for
       // other features (recommendations, notifications) but NOT shown in timeline.
       const { data: dramData, error: dramError } = await sb
         .from('dram_logs')
         .select('id, user_id, whisky_id, whisky_name, whisky_distillery, rating, notes, tasted_at, created_at')
         .in('user_id', followingIds)
         .order('tasted_at', { ascending: false })
         .limit(200)

       if (dramError) throw dramError

       // Timeline items: only dram_logs, tagged as social
       socialItems = (dramData || []).map(item => ({
         ...item,
         source:    'social',
         type:      'dram_logged',
         created_at: item.tasted_at, // timeline ordered by tasting time
       })).slice(0, 50)

       console.log('[feed] timeline (dram_logs):', socialItems.length)

        // Batch-fetch photos from catalogue directly by name+distillery.
        // (whiskies table is RLS-protected — we cannot read other users' rows.)
        const needPhoto = socialItems.filter(i => i.whisky_name)
        const photoMap = new Map() // whisky_name → photo_url
        if (needPhoto.length > 0) {
          const names = [...new Set(needPhoto.map(i => i.whisky_name))]
          const { data: cData, error: cError } = await sb
            .from('catalogue')
            .select('name, photo_url, nose, palate, dulzor, ahumado, cuerpo, frutado, especiado')
            .in('name', names)
          console.log('[feed] catalogue:', cData?.length, 'error:', cError?.message)
          for (const c of (cData || [])) {
            photoMap.set(c.name, {
              photo_url: c.photo_url || null,
              nose:      c.nose      || null,
              palate:    c.palate    || null,
              dulzor:    c.dulzor    ?? null,
              ahumado:   c.ahumado   ?? null,
              cuerpo:    c.cuerpo    ?? null,
              frutado:   c.frutado   ?? null,
              especiado: c.especiado ?? null,
            })
          }
        }

        socialItems = socialItems.map(item => {
          const cat = photoMap.get(item.whisky_name)
          return {
            ...item,
            photo_url: cat?.photo_url ?? null,
            nose:      cat?.nose      ?? null,
            palate:    cat?.palate    ?? null,
            dulzor:    cat?.dulzor    ?? null,
            ahumado:   cat?.ahumado   ?? null,
            cuerpo:    cat?.cuerpo    ?? null,
            frutado:   cat?.frutado   ?? null,
            especiado: cat?.especiado ?? null,
          }
        })
      }

      // ── Editorial content (news, events, awards, announcements) ───────────
      const { data: editorialData, error: editorialError } = await sb
        .from('editorial_feed')
        .select('id, type, title, body, image_url, source_name, source_url, event_date, location, published_at')
        .order('published_at', { ascending: false })
        .limit(30)

      if (editorialError) console.warn('[feed] editorial error:', editorialError?.message)
      console.log('[feed] editorial:', editorialData?.length)

      const editorialItems = (editorialData || []).map(item => ({
        ...item,
        source: 'editorial',
        created_at: item.published_at,
      }))

      // ── Merge: social first, editorial interleaved every 3 social items ──
      // Sort each list by timestamp independently, then weave editorial in
      // so user activity always appears before news items of the same era.
      socialItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      editorialItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      const all = []
      let eIdx = 0
      const SOCIAL_PER_EDITORIAL = 3
      for (let i = 0; i < socialItems.length; i++) {
        all.push(socialItems[i])
        // After every N social items, inject one editorial item
        if ((i + 1) % SOCIAL_PER_EDITORIAL === 0 && eIdx < editorialItems.length) {
          all.push(editorialItems[eIdx++])
        }
      }
      // Append any remaining editorial items at the end
      while (eIdx < editorialItems.length) all.push(editorialItems[eIdx++])

      console.log('[feed] total items:', all.length)
      feedItems.value = all
    } catch (err) {
      console.error('useFeed loadFeed error:', err?.message)
    } finally {
      feedLoading.value = false
    }
  }

  return { feedItems, feedLoading, displayNames, loadFeed }
}
