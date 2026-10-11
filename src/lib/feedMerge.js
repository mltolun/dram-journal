// Builds the social half of the Feed from two sources:
//   • dram_logs   — tastings (one row per dram), the main timeline
//   • activity_feed rows of type 'rating' and 'wishlist_add' from followed users
//
// journal_add and dram_logged activity rows are NOT shown: every journal add also
// creates a dram_log, so showing both would duplicate each entry.

export const FEED_ACTIVITY_TYPES = ['rating', 'wishlist_add']

export const FEED_LIMIT = 50

export function dramLogToFeedItem(log) {
  return {
    ...log,
    source:     'social',
    type:       'dram_logged',
    created_at: log.tasted_at, // timeline is ordered by when it was tasted
  }
}

export function activityToFeedItem(row) {
  return {
    id:                row.id,
    user_id:           row.user_id,
    whisky_id:         row.whisky_id ?? null,
    whisky_name:       row.whisky_name,
    whisky_distillery: row.whisky_distillery ?? null,
    rating:            row.rating ?? null,
    notes:             row.notes ?? null,
    tasted_at:         row.created_at,
    created_at:        row.created_at,
    type:              row.type,
    source:            'social',
  }
}

export function buildSocialItems({ dramLogs = [], activity = [], limit = FEED_LIMIT } = {}) {
  const items = [
    ...dramLogs.map(dramLogToFeedItem),
    ...activity
      .filter(row => FEED_ACTIVITY_TYPES.includes(row.type))
      .map(activityToFeedItem),
  ]
  items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return items.slice(0, limit)
}
