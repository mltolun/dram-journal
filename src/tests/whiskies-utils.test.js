import { describe, it, expect } from 'vitest'
import { daysUntilFlush, mergeWithCatalogue } from '../composables/useWhiskies.js'

describe('daysUntilFlush', () => {
  it('returns TRASH_TTL_DAYS when deleted_at is missing', () => {
    const w = { list: 'trash' }
    expect(daysUntilFlush(w)).toBe(5)
  })

  it('returns TRASH_TTL_DAYS when deleted_at is invalid', () => {
    const w = { list: 'trash', deleted_at: 'not-a-date' }
    expect(daysUntilFlush(w)).toBe(5)
  })

  it('returns positive days for recent trash', () => {
    const w = { list: 'trash', deleted_at: new Date(Date.now() - 86400000).toISOString() } // 1 day ago
    const result = daysUntilFlush(w)
    expect(result).toBeGreaterThanOrEqual(3)
    expect(result).toBeLessThanOrEqual(5)
  })

  it('returns 0 for expired trash (>= 5 days old)', () => {
    const w = { list: 'trash', deleted_at: new Date(Date.now() - 5 * 86400000).toISOString() }
    const result = daysUntilFlush(w)
    expect(result).toBe(0)
  })

  it('returns 0 for very old trash', () => {
    const w = { list: 'trash', deleted_at: new Date(Date.now() - 10 * 86400000).toISOString() }
    expect(daysUntilFlush(w)).toBe(0)
  })
})

describe('mergeWithCatalogue', () => {
  it('returns the whisky unchanged if no catalogue data', () => {
    const w = { id: '1', name: 'Test', distillery: 'Test Distillery' }
    expect(mergeWithCatalogue(w)).toEqual(w)
  })

  it('fills missing whisky fields from catalogue', () => {
    const w = { id: '1', name: 'Test', catalogue: { name: 'Catalogue Name', country: 'Scotland', region: 'Speyside' } }
    const merged = mergeWithCatalogue(w)
    expect(merged.name).toBe('Test') // whisky name takes priority
    expect(merged.origin).toBe('Scotland') // filled from catalogue.country
    expect(merged.region).toBe('Speyside') // filled from catalogue.region
  })

  it('uses whisky values over catalogue when both present', () => {
    const w = {
      id: '1',
      name: 'Override Name',
      distillery: 'Override Distillery',
      origin: 'Override Origin',
      catalogue: { name: 'Catalogue Name', distillery: 'Catalogue Distillery', country: 'Scotland' },
    }
    const merged = mergeWithCatalogue(w)
    expect(merged.name).toBe('Override Name')
    expect(merged.distillery).toBe('Override Distillery')
    expect(merged.origin).toBe('Override Origin')
  })

  it('maps catalogue.country to origin', () => {
    const w = { id: '1', catalogue: { country: 'Japan' } }
    expect(mergeWithCatalogue(w).origin).toBe('Japan')
  })

  it('maps catalogue fields: age, abv, price_band, photo_url, nose, palate', () => {
    const w = { id: '1', catalogue: { age: '12 years', abv: '46%', price_band: '£50-60', photo_url: 'http://example.com/pic.jpg', nose: 'Fruity', palate: 'Spicy' } }
    const merged = mergeWithCatalogue(w)
    expect(merged.age).toBe('12 years')
    expect(merged.abv).toBe('46%')
    expect(merged.price).toBe('£50-60')
    expect(merged.photo_url).toBe('http://example.com/pic.jpg')
    expect(merged.nose).toBe('Fruity')
    expect(merged.palate).toBe('Spicy')
  })

  it('maps flavour attributes from catalogue with null-coalescing', () => {
    const w = { id: '1', dulzor: 3, catalogue: { dulzor: 2, ahumado: 4, cuerpo: 3, frutado: 5, especiado: 1 } }
    const merged = mergeWithCatalogue(w)
    expect(merged.dulzor).toBe(3) // whisky value takes priority
    expect(merged.ahumado).toBe(4) // filled from catalogue
    expect(merged.cuerpo).toBe(3)
    expect(merged.frutado).toBe(5)
    expect(merged.especiado).toBe(1)
  })

  it('handles whisky with 0 values for flavour attributes', () => {
    const w = { id: '1', dulzor: 0, ahumado: 0, catalogue: { dulzor: 3, ahumado: 4 } }
    const merged = mergeWithCatalogue(w)
    expect(merged.dulzor).toBe(0) // 0 should NOT be overridden (nullish coalescing)
    expect(merged.ahumado).toBe(0)
  })

  it('handles null whisky values with catalogue fallback', () => {
    const w = { id: '1', dulzor: null, catalogue: { dulzor: 3, ahumado: 4 } }
    const merged = mergeWithCatalogue(w)
    expect(merged.dulzor).toBe(3) // null gets overridden
    expect(merged.ahumado).toBe(4)
  })

  it('handles undefined whisky values with catalogue fallback', () => {
    const w = { id: '1', catalogue: { dulzor: 3, ahumado: 4 } }
    const merged = mergeWithCatalogue(w)
    expect(merged.dulzor).toBe(3)
    expect(merged.ahumado).toBe(4)
  })
})
