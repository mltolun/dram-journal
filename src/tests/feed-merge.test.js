import { describe, it, expect } from 'vitest'
import { buildSocialItems, FEED_ACTIVITY_TYPES } from '../lib/feedMerge.js'

const log = (id, user, name, tasted) => ({ id, user_id: user, whisky_id: 1, whisky_name: name, whisky_distillery: 'D', rating: 4, notes: null, tasted_at: tasted, created_at: tasted })
const act = (id, user, type, name, at) => ({ id, user_id: user, whisky_id: 2, type, whisky_name: name, whisky_distillery: 'D', rating: type === 'rating' ? 5 : null, notes: null, created_at: at })

describe('buildSocialItems', () => {
  it('shows followed users tastings from dram_logs', () => {
    const items = buildSocialItems({ dramLogs: [log('a', 'u1', 'Laphroaig 10', '2026-10-10T10:00:00Z')] })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ source: 'social', type: 'dram_logged', whisky_name: 'Laphroaig 10' })
  })

  it('adds followed users ratings and wishlist additions from activity_feed', () => {
    const items = buildSocialItems({
      dramLogs: [],
      activity: [act('r1', 'u1', 'rating', 'Haran', '2026-10-09T09:00:00Z'), act('w1', 'u1', 'wishlist_add', 'Benromach', '2026-10-08T09:00:00Z')],
    })
    expect(items.map(i => i.type)).toEqual(['rating', 'wishlist_add'])
    expect(items[0].rating).toBe(5)
  })

  it('does not duplicate entries: journal_add and dram_logged activity rows are skipped', () => {
    const items = buildSocialItems({
      dramLogs: [log('a', 'u1', 'Ardbeg', '2026-10-10T10:00:00Z')],
      activity: [act('j1', 'u1', 'journal_add', 'Ardbeg', '2026-10-10T10:00:00Z'), act('d1', 'u1', 'dram_logged', 'Ardbeg', '2026-10-10T10:00:00Z')],
    })
    expect(items).toHaveLength(1)
    expect(FEED_ACTIVITY_TYPES).not.toContain('journal_add')
  })

  it('orders everything newest first and applies the limit', () => {
    const dramLogs = Array.from({ length: 30 }, (_, i) => log('d' + i, 'u1', 'W' + i, new Date(Date.UTC(2026, 0, 1 + i)).toISOString()))
    const activity = Array.from({ length: 30 }, (_, i) => act('a' + i, 'u1', 'rating', 'R' + i, new Date(Date.UTC(2026, 1, 1 + i)).toISOString()))
    const items = buildSocialItems({ dramLogs, activity, limit: 50 })
    expect(items).toHaveLength(50)
    for (let i = 1; i < items.length; i++) {
      expect(new Date(items[i - 1].created_at) >= new Date(items[i].created_at)).toBe(true)
    }
  })

  it('handles empty input', () => {
    expect(buildSocialItems()).toEqual([])
  })
})
