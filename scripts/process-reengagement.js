/**
 * process-reengagement.js
 *
 * Daily GitHub Actions script.
 * Calculates weekly streaks for every user and sends smart re-engagement emails.
 *
 * Techniques used:
 *   - RFM segmentation: at_risk (7–14d), lapsed (15–30d), churned (30+d)
 *   - Loss-aversion streak warnings (Thu–Sun, when the week is almost over)
 *   - Badge proximity nudges (within 3 entries of next unearned badge)
 *   - Personalized send-day (derived from historical logging day-of-week)
 *   - Frequency cap: max 1 re-engagement email per 7 days per user
 *   - Sunset policy: stop after 3 un-actioned emails for churned users
 *
 * Required environment variables:
 *   SUPABASE_URL         — project URL
 *   SUPABASE_SERVICE_KEY — service role key (bypasses RLS)
 *   RESEND_API_KEY       — Resend API key
 *   EMAIL_FROM           — verified sender address
 *   SEND_EMAILS          — set to 'false' for a dry run (optional, default true)
 */

import { createClient } from '@supabase/supabase-js'
import { sendReengagementEmail } from './send-reengagement-email.js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const SEND_EMAILS          = process.env.SEND_EMAILS !== 'false'

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// ── ISO week helpers ──────────────────────────────────────────────────────────

/**
 * Returns the ISO 8601 week string for a given date, e.g. "2026-W13".
 * Uses the "nearest Thursday" algorithm so year boundaries are handled correctly.
 */
function isoWeek(date) {
  const d = new Date(date)
  const day = d.getUTCDay() || 7           // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - day)  // shift to Thursday of same ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/** Returns the ISO week string for the week immediately before `weekStr`. */
function prevIsoWeek(weekStr) {
  const [year, wStr] = weekStr.split('-W')
  // Find Monday of the given week, then subtract 7 days
  const jan4    = new Date(Date.UTC(parseInt(year), 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const monday  = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1) + (parseInt(wStr) - 1) * 7 - 7)
  return isoWeek(monday)
}

/**
 * Calculates the current consecutive-week streak from an array of ISO date strings.
 * A streak is alive if the user logged something this week OR last week.
 */
function calcStreak(entryDates, today) {
  if (!entryDates.length) return 0
  const thisWeek = isoWeek(today)
  const lastWeek = prevIsoWeek(thisWeek)

  // Deduplicate and sort weeks newest-first
  const weeks = [...new Set(entryDates.map(d => isoWeek(new Date(d))))].sort().reverse()

  // Streak is dead if the user hasn't logged this week or last week
  if (weeks[0] !== thisWeek && weeks[0] !== lastWeek) return 0

  let streak   = 0
  let expected = weeks[0]
  for (const week of weeks) {
    if (week !== expected) break
    streak++
    expected = prevIsoWeek(expected)
  }
  return streak
}

// ── Badge proximity ───────────────────────────────────────────────────────────

const BADGE_CHECKS = [
  { id: 'first_dram',       name: 'First Dram',           icon: 'glass-water', target: 1,   rem: s => Math.max(0, 1   - s.total)      },
  { id: 'tenner',           name: 'The Tenner',           icon: 'hash', target: 10,  rem: s => Math.max(0, 10  - s.total)      },
  { id: 'century',          name: 'Century Club',         icon: 'check-circle', target: 100, rem: s => Math.max(0, 100 - s.total)      },
  { id: 'globe_trotter',    name: 'Globe Trotter',        icon: 'globe', target: 5,   rem: s => Math.max(0, 5   - s.countries)  },
  { id: 'peat_freak',       name: 'Peat Freak',           icon: 'flame', target: 10,  rem: s => Math.max(0, 10  - s.peaty)      },
  { id: 'the_critic',       name: 'The Critic',           icon: 'star', target: 50,  rem: s => Math.max(0, 50  - s.rated)      },
  { id: 'flavor_arch',      name: 'Flavor Archaeologist', icon: 'flask-conical', target: 20,  rem: s => Math.max(0, 20  - s.fullFlavor) },
  { id: 'social_butterfly', name: 'Social Butterfly',     icon: 'users', target: 5,   rem: s => Math.max(0, 5   - s.followers)  },
]

/**
 * Returns the closest unearned badge the user is within 3 entries of, or null.
 */
function closestBadge(stats, earnedIds) {
  return BADGE_CHECKS
    .filter(b => !earnedIds.has(b.id))
    .map(b => { const r = b.rem(stats); return r > 0 && r <= 3 ? { ...b, rem: r } : null })
    .filter(Boolean)
    .sort((a, b) => a.rem - b.rem)[0] ?? null
}

// ── Preferred day of week ─────────────────────────────────────────────────────

/**
 * Returns the UTC day-of-week (0=Sun…6=Sat) the user most commonly logs on,
 * or null if there's no strong signal (fewer than 3 entries on any single day).
 */
function calcPreferredDow(entryDates) {
  const counts = Array(7).fill(0)
  for (const d of entryDates) counts[new Date(d).getUTCDay()]++
  const max = Math.max(...counts)
  if (max < 3) return null
  return counts.indexOf(max)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[reengagement] Processing...')

  const today    = new Date()
  const todayDow = today.getUTCDay()                          // 0=Sun … 6=Sat
  const thisWeek = isoWeek(today)
  const isLateWeek = [0, 4, 5, 6].includes(todayDow)         // Thu/Fri/Sat/Sun — streak warning window

  // ── Load all data in parallel ─────────────────────────────────────────────

  const [
    { data: allEntries,    error: e1 },
    { data: allBadges,     error: e2 },
    { data: allSubs,       error: e3 },
    { data: allStreakRecs,  error: e4 },
    { data: recentAct,     error: e5 },
  ] = await Promise.all([
    sb.from('whiskies')
      .select('user_id, created_at, origin, ahumado, rating, dulzor, cuerpo, frutado, especiado')
      .eq('list', 'journal')
      .is('deleted_at', null),
    sb.from('user_badges')
      .select('user_id, badge_id'),
    sb.from('subscriptions')
      .select('follower_id, following_id')
      .eq('status', 'accepted'),
    sb.from('user_streaks')
      .select('*'),
    sb.from('activity_feed')
      .select('user_id, type, whisky_name, whisky_distillery, rating, created_at')
      .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString()),
  ])

  if (e1) throw new Error(`entries: ${e1.message}`)
  if (e2) throw new Error(`badges: ${e2.message}`)
  if (e3) throw new Error(`subs: ${e3.message}`)
  if (e4) throw new Error(`streaks: ${e4.message}`)
  if (e5) throw new Error(`activity: ${e5.message}`)

  // ── Index lookups ─────────────────────────────────────────────────────────

  // user_id → Set<badge_id>
  const badgesByUser = {}
  for (const b of allBadges ?? []) {
    ;(badgesByUser[b.user_id] ??= new Set()).add(b.badge_id)
  }

  // follower counts and "who does this user follow" map
  const followerCountByUser = {}
  const followingByUser     = {}
  for (const s of allSubs ?? []) {
    followerCountByUser[s.following_id] = (followerCountByUser[s.following_id] ?? 0) + 1
    ;(followingByUser[s.follower_id] ??= []).push(s.following_id)
  }

  // user_id → existing streak record
  const streakByUser = Object.fromEntries((allStreakRecs ?? []).map(r => [r.user_id, r]))

  // user_id → recent activity_feed rows (last 14 days)
  const activityByUser = {}
  for (const a of recentAct ?? []) {
    ;(activityByUser[a.user_id] ??= []).push(a)
  }

  // ── Aggregate per-user journal stats ─────────────────────────────────────

  const userRaw = {}   // user_id → { dates[], countries Set, peaty, rated, fullFlavor }
  for (const e of allEntries ?? []) {
    const s = (userRaw[e.user_id] ??= { dates: [], countries: new Set(), peaty: 0, rated: 0, fullFlavor: 0 })
    s.dates.push(e.created_at)
    if (e.origin) s.countries.add(e.origin)
    if ((e.ahumado   ?? 0) >= 4) s.peaty++
    if (e.rating  != null)       s.rated++
    if ((e.dulzor    ?? 0) > 0 && (e.ahumado   ?? 0) > 0 &&
        (e.cuerpo    ?? 0) > 0 && (e.frutado   ?? 0) > 0 &&
        (e.especiado ?? 0) > 0)  s.fullFlavor++
  }

  // ── Fetch all user emails via admin API ───────────────────────────────────

  // emailMap: user_id → { email, createdAt }
  const emailMap = {}
  let page = 1
  while (true) {
    const { data: { users }, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !users?.length) break
    for (const u of users) if (u.email) emailMap[u.id] = { email: u.email, createdAt: u.created_at, locale: u.user_metadata?.locale || 'en' }
    if (users.length < 1000) break
    page++
  }

  // ── Process each user ─────────────────────────────────────────────────────

  let sent = 0, skipped = 0, errors = 0

  function skip(email, reason) {
    console.log(`   · skip  ${email} — ${reason}`)
    skipped++
  }

  for (const [userId, { email, createdAt, locale }] of Object.entries(emailMap)) {
    const raw = userRaw[userId]

    // ── Users with no journal entries: onboarding nudge ───────────────────
    if (!raw) {
      // Give new users 48h before nudging
      const accountAgeDays = (today - new Date(createdAt)) / 86400000
      if (accountAgeDays < 2) { skip(email, 'too new (< 48h)'); continue }

      const existingRec = streakByUser[userId] ?? {}

      // Same sunset and frequency-cap rules as other segments
      if ((existingRec.reengagement_emails_sent ?? 0) >= 3) {
        skip(email, 'sunset (3 onboarding emails ignored)'); continue
      }
      if (existingRec.last_reengagement_sent_at) {
        const daysSinceEmail = (today - new Date(existingRec.last_reengagement_sent_at)) / 86400000
        if (daysSinceEmail < 7) { skip(email, `freq-cap (last email ${Math.round(daysSinceEmail)}d ago)`); continue }
      }

      if (!SEND_EMAILS) {
        console.log(`   [dry-run] would send onboarding → ${email}`)
        skipped++; continue
      }

      try {
        await sendReengagementEmail(email, 'onboarding', {}, locale)
        await sb.from('user_streaks').upsert({
          user_id:                   userId,
          current_streak:            0,
          best_streak:               0,
          reengagement_emails_sent:  (existingRec.reengagement_emails_sent ?? 0) + 1,
          last_reengagement_sent_at: today.toISOString(),
          updated_at:                today.toISOString(),
        })
        console.log(`   ✉ onboarding → ${email}`)
        sent++
      } catch (err) {
        console.error(`   ✗ Failed for ${email}: ${err.message}`)
        errors++
      }
      continue
    }

    const stats = {
      total:      raw.dates.length,
      countries:  raw.countries.size,
      peaty:      raw.peaty,
      rated:      raw.rated,
      fullFlavor: raw.fullFlavor,
      followers:  followerCountByUser[userId] ?? 0,
    }

    const lastEntryAt   = new Date(Math.max(...raw.dates.map(d => +new Date(d))))
    const daysSince     = (today - lastEntryAt) / 86400000
    const streak        = calcStreak(raw.dates, today)
    const loggedThisWk  = raw.dates.some(d => isoWeek(new Date(d)) === thisWeek)
    const prefDow       = calcPreferredDow(raw.dates)
    const existingRec   = streakByUser[userId] ?? {}

    // ── Segment ───────────────────────────────────────────────────────────
    const segment =
      daysSince <= 7  ? 'active'  :
      daysSince <= 14 ? 'at_risk' :
      daysSince <= 30 ? 'lapsed'  : 'churned'

    // ── Update streak record for ALL users (keeps data fresh for the UI) ──
    const streakRow = {
      user_id:                   userId,
      current_streak:            streak,
      best_streak:               Math.max(streak, existingRec.best_streak ?? 0),
      last_logged_week:          loggedThisWk ? thisWeek : (raw.dates.length ? isoWeek(lastEntryAt) : null),
      preferred_dow:             prefDow,
      // Reset re-engagement counter when user comes back
      reengagement_emails_sent:  segment === 'active' ? 0 : (existingRec.reengagement_emails_sent ?? 0),
      last_reengagement_sent_at: segment === 'active' ? null : (existingRec.last_reengagement_sent_at ?? null),
      streak_warned_week:        existingRec.streak_warned_week ?? null,
      updated_at:                today.toISOString(),
    }
    await sb.from('user_streaks').upsert(streakRow)

    // ── Skip active users — no nudge needed ──────────────────────────────
    if (segment === 'active') { skip(email, `active (last entry ${Math.round(daysSince)}d ago)`); continue }

    // ── Sunset policy: stop after 3 ignored emails for churned users ──────
    if (segment === 'churned' && (existingRec.reengagement_emails_sent ?? 0) >= 3) {
      skip(email, `sunset (${existingRec.reengagement_emails_sent} emails ignored)`); continue
    }

    // ── Frequency cap: max 1 re-engagement email per 7 days ──────────────
    if (existingRec.last_reengagement_sent_at) {
      const daysSinceEmail = (today - new Date(existingRec.last_reengagement_sent_at)) / 86400000
      if (daysSinceEmail < 7) {
        skip(email, `freq-cap (last email ${Math.round(daysSinceEmail)}d ago)`); continue
      }
    }

    // ── Personalized send-day filter ──────────────────────────────────────
    // If we know the user's preferred day, only send on that day —
    // unless it's a streak-warning situation (urgency overrides preference).
    const wantStreakWarn =
      streak >= 2 &&
      !loggedThisWk &&
      isLateWeek &&
      existingRec.streak_warned_week !== thisWeek

    if (prefDow !== null && todayDow !== prefDow && !wantStreakWarn) {
      const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
      skip(email, `wrong day (prefers ${DOW[prefDow]}, today is ${DOW[todayDow]})`); continue
    }

    // ── Decide which email to send ────────────────────────────────────────

    let emailType = null
    const payload = {}

    // Priority 1 — streak warning (loss aversion)
    if (wantStreakWarn) {
      emailType        = 'streak_warning'
      payload.streak   = streak
      payload.daysLeft = todayDow === 0 ? 0 : 7 - todayDow   // days until Sunday
      // Bonus hint if a badge is also within reach
      const badge = closestBadge(stats, badgesByUser[userId] ?? new Set())
      if (badge) payload.badge = badge
    }

    // Priority 2 — badge proximity
    if (!emailType) {
      const badge = closestBadge(stats, badgesByUser[userId] ?? new Set())
      if (badge) {
        emailType    = 'badge_proximity'
        payload.badge = badge
      }
    }

    // Priority 3 — lapsed social digest
    if (!emailType && segment === 'lapsed') {
      const friendIds      = followingByUser[userId] ?? []
      const friendActivity = friendIds
        .flatMap(fid => activityByUser[fid] ?? [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8)
      emailType            = 'lapsed'
      payload.friendActivity = friendActivity
      payload.stats          = stats
      payload.daysSince      = daysSince
    }

    // Priority 4 — final soft nudge for churned users
    if (!emailType && segment === 'churned') {
      emailType    = 'final'
      payload.stats = stats
    }

    if (!emailType) { skip(email, `no trigger (${segment}, streak=${streak}, no badge close)`); continue }

    // ── Send ──────────────────────────────────────────────────────────────

    if (!SEND_EMAILS) {
      console.log(`   [dry-run] would send ${emailType} → ${email} (${segment}, streak=${streak})`)
      skipped++
      continue
    }

    try {
      await sendReengagementEmail(email, emailType, payload, locale)

      // Persist send state
      const update = {
        reengagement_emails_sent:  (existingRec.reengagement_emails_sent ?? 0) + 1,
        last_reengagement_sent_at: today.toISOString(),
      }
      if (emailType === 'streak_warning') update.streak_warned_week = thisWeek
      await sb.from('user_streaks').update(update).eq('user_id', userId)

      console.log(`   ✉ ${emailType} → ${email} (${segment}, streak=${streak})`)
      sent++
    } catch (err) {
      console.error(`   ✗ Failed for ${email}: ${err.message}`)
      errors++
    }
  }

  console.log(`\n✓ Done — ${sent} sent, ${skipped} skipped, ${errors} errors`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
