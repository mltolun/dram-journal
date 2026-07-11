import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useBadges } from '../composables/useBadges.js'
import { whiskies } from '../composables/useWhiskies.js'
import { myFollowers } from '../composables/useSubscriptions.js'

function makeWhisky(overrides = {}) {
  return {
    list: 'journal',
    name: 'Test Whisky',
    origin: 'Scotland',
    dulzor: 3,
    ahumado: 1,
    cuerpo: 2,
    frutado: 3,
    especiado: 1,
    rating: 4,
    ...overrides,
  }
}

describe('badge progress and earned logic', () => {
  beforeEach(() => {
    whiskies.value = []
    myFollowers.value = []
  })

  it('first_dram shows progress 0 with empty journal', () => {
    const { badges } = useBadges()
    const firstDram = badges.value.find(b => b.id === 'first_dram')
    expect(firstDram.current).toBe(0)
    expect(firstDram.target).toBe(1)
    expect(firstDram.name).toBe('First Dram')
  })

  it('first_dram shows progress 1 with one whisky', () => {
    whiskies.value = [makeWhisky()]
    const { badges } = useBadges()
    const firstDram = badges.value.find(b => b.id === 'first_dram')
    expect(firstDram.current).toBe(1)
  })

  it('tenner shows progress capped at 10', () => {
    const items = Array.from({ length: 15 }, (_, i) => makeWhisky({ name: `Whisky ${i}` }))
    whiskies.value = items
    const { badges } = useBadges()
    const tenner = badges.value.find(b => b.id === 'tenner')
    expect(tenner.current).toBe(10)
    expect(tenner.target).toBe(10)
  })

  it('century shows progress capped at 100', () => {
    const items = Array.from({ length: 150 }, (_, i) => makeWhisky({ name: `Whisky ${i}` }))
    whiskies.value = items
    const { badges } = useBadges()
    const century = badges.value.find(b => b.id === 'century')
    expect(century.current).toBe(100)
    expect(century.target).toBe(100)
  })

  it('globe_trotter counts unique origins', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', origin: 'Scotland' }),
      makeWhisky({ name: 'B', origin: 'Scotland' }),
      makeWhisky({ name: 'C', origin: 'Japan' }),
      makeWhisky({ name: 'D', origin: 'Ireland' }),
      makeWhisky({ name: 'E', origin: 'USA' }),
    ]
    const { badges } = useBadges()
    const badge = badges.value.find(b => b.id === 'globe_trotter')
    expect(badge.current).toBe(4)
    expect(badge.target).toBe(5)
  })

  it('globe_trotter ignores empty origins', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', origin: '' }),
      makeWhisky({ name: 'B', origin: undefined }),
    ]
    const { badges } = useBadges()
    const badge = badges.value.find(b => b.id === 'globe_trotter')
    expect(badge.current).toBe(0)
  })

  it('peat_freak counts whiskies with smokiness >= 4', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', ahumado: 5 }),
      makeWhisky({ name: 'B', ahumado: 4 }),
      makeWhisky({ name: 'C', ahumado: 3 }),
    ]
    const { badges } = useBadges()
    const badge = badges.value.find(b => b.id === 'peat_freak')
    expect(badge.current).toBe(2)
    expect(badge.target).toBe(10)
  })

  it('the_critic counts whiskies with a rating', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', rating: 4 }),
      makeWhisky({ name: 'B', rating: null }),
      makeWhisky({ name: 'C', rating: 3 }),
    ]
    const { badges } = useBadges()
    const badge = badges.value.find(b => b.id === 'the_critic')
    expect(badge.current).toBe(2)
    expect(badge.target).toBe(50)
  })

  it('flavor_arch counts whiskies with all 5 attributes > 0', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', dulzor: 1, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }),
      makeWhisky({ name: 'B', dulzor: 0, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }),
      makeWhisky({ name: 'C', dulzor: 2, ahumado: 2, cuerpo: 2, frutado: 2, especiado: 2 }),
    ]
    const { badges } = useBadges()
    const badge = badges.value.find(b => b.id === 'flavor_arch')
    expect(badge.current).toBe(2) // A and C qualify, B doesn't (dulzor is 0)
    expect(badge.target).toBe(20)
  })

  it('social_butterfly counts followers', () => {
    myFollowers.value = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { badges } = useBadges()
    const badge = badges.value.find(b => b.id === 'social_butterfly')
    expect(badge.current).toBe(3)
    expect(badge.target).toBe(5)
  })

  it('all badges have expected structure', () => {
    const { badges, earnedCount } = useBadges()
    badges.value.forEach(b => {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('icon')
      expect(b).toHaveProperty('name')
      expect(b).toHaveProperty('desc')
      expect(b).toHaveProperty('target')
      expect(b).toHaveProperty('current')
      expect(b).toHaveProperty('earned')
    })
    expect(earnedCount.value).toBe(0) // no badges earned in DB
  })
})

describe('passport and continentPassport', () => {
  beforeEach(() => {
    whiskies.value = []
  })

  it('passport counts whiskies per country', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', origin: 'Scotland' }),
      makeWhisky({ name: 'B', origin: 'Scotland' }),
      makeWhisky({ name: 'C', origin: 'Japan' }),
    ]
    const { passport } = useBadges()
    expect(passport.value).toEqual([
      { country: 'Scotland', count: 2 },
      { country: 'Japan', count: 1 },
    ])
  })

  it('passport sorts by count descending', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', origin: 'Japan' }),
      makeWhisky({ name: 'B', origin: 'Scotland' }),
      makeWhisky({ name: 'C', origin: 'Scotland' }),
      makeWhisky({ name: 'D', origin: 'Scotland' }),
    ]
    const { passport } = useBadges()
    expect(passport.value[0]).toEqual({ country: 'Scotland', count: 3 })
    expect(passport.value[1]).toEqual({ country: 'Japan', count: 1 })
  })

  it('passport returns empty array for empty journal', () => {
    const { passport } = useBadges()
    expect(passport.value).toEqual([])
  })

  it('passport ignores entries without origin', () => {
    whiskies.value = [
      makeWhisky({ origin: '' }),
      makeWhisky({ origin: undefined }),
    ]
    const { passport } = useBadges()
    expect(passport.value).toEqual([])
  })

  it('continentPassport groups by continent', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', origin: 'Scotland' }),
      makeWhisky({ name: 'B', origin: 'Ireland' }),
      makeWhisky({ name: 'C', origin: 'Japan' }),
      makeWhisky({ name: 'D', origin: 'USA' }),
    ]
    const { continentPassport } = useBadges()
    const continents = continentPassport.value
    const britishIsles = continents.find(c => c.continent === 'British Isles')
    expect(britishIsles).toBeDefined()
    expect(britishIsles.countries.length).toBe(2)
    expect(continents.some(c => c.continent === 'Americas')).toBe(true)
    expect(continents.some(c => c.continent === 'Asia')).toBe(true)
  })
})

describe('flavorProfile', () => {
  beforeEach(() => {
    whiskies.value = []
  })

  it('returns null when fewer than 3 entries have all attributes', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', dulzor: 1, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }),
    ]
    const { flavorProfile } = useBadges()
    expect(flavorProfile.value).toBeNull()
  })

  it('returns averages when 3+ entries have all attributes', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', dulzor: 4, ahumado: 2, cuerpo: 3, frutado: 1, especiado: 2 }),
      makeWhisky({ name: 'B', dulzor: 2, ahumado: 3, cuerpo: 1, frutado: 4, especiado: 3 }),
      makeWhisky({ name: 'C', dulzor: 3, ahumado: 1, cuerpo: 2, frutado: 3, especiado: 1 }),
    ]
    const { flavorProfile } = useBadges()
    expect(flavorProfile.value).not.toBeNull()
    expect(flavorProfile.value.dulzor).toBe(3) // (4+2+3)/3
    expect(flavorProfile.value.ahumado).toBe(2) // (2+3+1)/3
    expect(flavorProfile.value.cuerpo).toBe(2) // (3+1+2)/3
    expect(flavorProfile.value.frutado).toBeCloseTo(2.67, 1) // (1+4+3)/3
    expect(flavorProfile.value.especiado).toBe(2) // (2+3+1)/3
    expect(flavorProfile.value.count).toBe(3)
  })

  it('excludes entries missing any attribute', () => {
    whiskies.value = [
      makeWhisky({ name: 'A', dulzor: 1, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }),
      makeWhisky({ name: 'B', dulzor: 0, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }), // excluded (dulzor=0)
      makeWhisky({ name: 'C', dulzor: 1, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }),
      makeWhisky({ name: 'D', dulzor: 1, ahumado: 1, cuerpo: 1, frutado: 1, especiado: 1 }),
    ]
    const { flavorProfile } = useBadges()
    expect(flavorProfile.value).not.toBeNull()
    expect(flavorProfile.value.count).toBe(3) // A, C, D qualify
  })
})

describe('earnedCount', () => {
  beforeEach(() => {
    whiskies.value = []
    myFollowers.value = []
  })

  it('earnedCount is 0 when no badges are in DB', () => {
    const { earnedCount } = useBadges()
    expect(earnedCount.value).toBe(0)
  })
})
