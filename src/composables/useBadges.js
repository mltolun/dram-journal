import { ref, computed } from 'vue'
import { sb } from '../lib/supabase.js'
import { journal } from './useWhiskies.js'
import { myFollowers } from './useSubscriptions.js'
import { currentUser } from './useAuth.js'
import { useToast } from './useToast.js'
import { useBadgeToast } from './useBadgeToast.js'

// ── Continent mapping for passport grouping ───────────────────────────────────

const CONTINENT_MAP = {
  // British Isles
  Scotland: 'British Isles', Ireland: 'British Isles',
  England: 'British Isles', Wales: 'British Isles',
  // Americas
  USA: 'Americas', 'United States': 'Americas', Canada: 'Americas',
  Mexico: 'Americas', 'United States of America': 'Americas',
  // Asia
  Japan: 'Asia', India: 'Asia', Taiwan: 'Asia',
  'South Korea': 'Asia', Korea: 'Asia', China: 'Asia',
  // Europe
  France: 'Europe', Germany: 'Europe', Belgium: 'Europe',
  Netherlands: 'Europe', Sweden: 'Europe', Finland: 'Europe',
  Denmark: 'Europe', Switzerland: 'Europe', Austria: 'Europe',
  Spain: 'Europe', Italy: 'Europe', Norway: 'Europe',
  Iceland: 'Europe', 'Czech Republic': 'Europe', Czechia: 'Europe',
  // Rest of World
  Australia: 'Rest of World', 'New Zealand': 'Rest of World',
  'South Africa': 'Rest of World', Israel: 'Rest of World',
}

const CONTINENT_ORDER = ['British Isles', 'Americas', 'Asia', 'Europe', 'Rest of World']

// ── Badge definitions ─────────────────────────────────────────────────────────

const BADGE_DEFS = [
  {
    id:     'first_dram',
    icon: 'GlassWater',
    name:   'First Dram',
    desc:   'Log your first whisky',
    target: 1,
    progress: (j)    => Math.min(j.length, 1),
    earned:   (j)    => j.length >= 1,
  },
  {
    id:     'tenner',
    icon: 'Hash',
    name:   'The Tenner',
    desc:   '10 whiskies in your journal',
    target: 10,
    progress: (j)    => Math.min(j.length, 10),
    earned:   (j)    => j.length >= 10,
  },
  {
    id:     'century',
    icon: 'Trophy',
    name:   'Century Club',
    desc:   '100 whiskies in your journal',
    target: 100,
    progress: (j)    => Math.min(j.length, 100),
    earned:   (j)    => j.length >= 100,
  },
  {
    id:     'globe_trotter',
    icon: 'Globe',
    name:   'Globe Trotter',
    desc:   'Taste whiskies from 5+ countries',
    target: 5,
    progress: (j)    => Math.min(new Set(j.map(w => w.origin).filter(Boolean)).size, 5),
    earned:   (j)    => new Set(j.map(w => w.origin).filter(Boolean)).size >= 5,
  },
  {
    id:     'peat_freak',
    icon: 'Flame',
    name:   'Peat Freak',
    desc:   '10 whiskies with smokiness rated 4+',
    target: 10,
    progress: (j)    => Math.min(j.filter(w => (w.ahumado ?? 0) >= 4).length, 10),
    earned:   (j)    => j.filter(w => (w.ahumado ?? 0) >= 4).length >= 10,
  },
  {
    id:     'the_critic',
    icon: 'Star',
    name:   'The Critic',
    desc:   'Rate 50 whiskies',
    target: 50,
    progress: (j)    => Math.min(j.filter(w => w.rating != null).length, 50),
    earned:   (j)    => j.filter(w => w.rating != null).length >= 50,
  },
  {
    id:     'flavor_arch',
    icon: 'FlaskConical',
    name:   'Flavor Archaeologist',
    desc:   'Complete all 5 flavor attributes on 20 entries',
    target: 20,
    progress: (j)    => Math.min(j.filter(w =>
      (w.dulzor ?? 0) > 0 && (w.ahumado ?? 0) > 0 && (w.cuerpo ?? 0) > 0 &&
      (w.frutado ?? 0) > 0 && (w.especiado ?? 0) > 0
    ).length, 20),
    earned:   (j)    => j.filter(w =>
      (w.dulzor ?? 0) > 0 && (w.ahumado ?? 0) > 0 && (w.cuerpo ?? 0) > 0 &&
      (w.frutado ?? 0) > 0 && (w.especiado ?? 0) > 0
    ).length >= 20,
  },
  {
    id:     'social_butterfly',
    icon: 'Users',
    name:   'Social Butterfly',
    desc:   '5 people follow your journal',
    target: 5,
    progress: (j, f) => Math.min(f.length, 5),
    earned:   (j, f) => f.length >= 5,
  },
]

// ── Module-level state (persisted badge IDs from DB) ──────────────────────────

const earnedInDB = ref(new Set())

// ── Load already-earned badges from Supabase ──────────────────────────────────

export async function loadEarnedBadges() {
  if (!currentUser.value) return
  const { data } = await sb
    .from('user_badges')
    .select('badge_id')
    .eq('user_id', currentUser.value.id)
  if (data) earnedInDB.value = new Set(data.map(r => r.badge_id))
}

// ── Check for newly unlocked badges and persist them ─────────────────────────
// Call this after any mutation that could unlock a badge.

export async function checkBadges() {
  if (!currentUser.value) return
  const { toast } = useToast()
  const { badgeToast } = useBadgeToast()
  const j = journal.value
  const f = myFollowers.value

  for (const def of BADGE_DEFS) {
    if (earnedInDB.value.has(def.id)) continue  // already earned
    if (!def.earned(j, f)) continue             // not yet earned

    // Optimistically mark earned to prevent duplicate triggers
    earnedInDB.value = new Set([...earnedInDB.value, def.id])

    // Persist to DB
    const { error } = await sb.from('user_badges').insert({
      user_id:  currentUser.value.id,
      badge_id: def.id,
    })
    if (error) {
      // Roll back optimistic update on failure (e.g. unique constraint race)
      if (error.code !== '23505') {
        earnedInDB.value.delete(def.id)
        continue
      }
    }

    // In-app badge celebration toast
    badgeToast(def.icon, def.name, def.desc)

    // Queue email — picked up by the daily process-notifications cron
    await sb.from('pending_notifications').insert({
      type:      'badge_earned',
      to_email:  currentUser.value.email,
      meta:      JSON.stringify({ badge_icon: def.id, badge_name: def.name, badge_desc: def.desc }),
    }).catch(err => console.warn('badge notification queue failed:', err?.message))
  }
}

// ── Composable for StatsPanel ─────────────────────────────────────────────────

export function useBadges() {
  const badges = computed(() => {
    const j = journal.value
    const f = myFollowers.value
    return BADGE_DEFS.map(def => ({
      id:      def.id,
      icon:    def.icon,
      name:    def.name,
      desc:    def.desc,
      target:  def.target,
      current: def.progress(j, f),
      earned:  earnedInDB.value.has(def.id),
    }))
  })

  const earnedCount = computed(() => badges.value.filter(b => b.earned).length)

  const passport = computed(() => {
    const counts = {}
    for (const w of journal.value) {
      const country = w.origin?.trim()
      if (country) counts[country] = (counts[country] || 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }))
  })

  const flavorProfile = computed(() => {
    const entries = journal.value.filter(w =>
      (w.dulzor ?? 0) > 0 && (w.ahumado ?? 0) > 0 && (w.cuerpo ?? 0) > 0 &&
      (w.frutado ?? 0) > 0 && (w.especiado ?? 0) > 0
    )
    if (entries.length < 3) return null
    const avg = key => entries.reduce((s, w) => s + (w[key] ?? 0), 0) / entries.length
    return {
      dulzor:    avg('dulzor'),
      ahumado:   avg('ahumado'),
      cuerpo:    avg('cuerpo'),
      frutado:   avg('frutado'),
      especiado: avg('especiado'),
      count:     entries.length,
    }
  })

  const continentPassport = computed(() => {
    const byContinent = {}
    for (const p of passport.value) {
      const continent = CONTINENT_MAP[p.country] || 'Rest of World'
      if (!byContinent[continent]) byContinent[continent] = []
      byContinent[continent].push(p)
    }
    return CONTINENT_ORDER
      .filter(c => byContinent[c])
      .map(c => ({ continent: c, countries: byContinent[c] }))
  })

  return { badges, earnedCount, passport, flavorProfile, continentPassport }
}
