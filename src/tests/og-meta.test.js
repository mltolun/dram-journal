import { describe, it, expect } from 'vitest'
import { buildMeta, ID_RE } from '../../functions/_lib/og.js'

const ctx = { origin: 'https://dramjournal.online', path: '/share/abc123', supabaseUrl: 'https://abc.supabase.co' }

describe('buildMeta (whisky)', () => {
  it('builds title/description from the payload', () => {
    const m = buildMeta('share', { name: 'Kilkerran 12', distillery: 'Glengyle', origin: 'Scotland', age: '12', nose: 'Citrus, vanilla', palate: 'Honey' }, ctx)
    expect(m.title).toBe('Kilkerran 12 – Glengyle · The Dram Journal')
    expect(m.description).toContain('Nose: Citrus, vanilla')
    expect(m.url).toBe('https://dramjournal.online/share/abc123')
  })

  it('uses our own storage photo, otherwise the default og image', () => {
    const own = 'https://abc.supabase.co/storage/v1/object/public/whisky-photos/u/1.jpg'
    expect(buildMeta('share', { name: 'x', photo_url: own }, ctx).image).toBe(own)
    expect(buildMeta('share', { name: 'x', photo_url: 'https://evil.test/p.png' }, ctx).image).toBe('https://dramjournal.online/og.png')
  })

  it('never leaks private fields (user_id, notes) into metadata', () => {
    const m = buildMeta('share', { name: 'x', user_id: 'secret-uuid', notes: 'private note' }, ctx)
    expect(JSON.stringify(m)).not.toMatch(/secret-uuid|private note/)
  })

  it('caps lengths and survives junk', () => {
    expect(buildMeta('share', { name: 'n'.repeat(500) }, ctx).title.length).toBeLessThanOrEqual(90)
    expect(buildMeta('share', null, ctx).title).toContain('A whisky')
  })
})

describe('buildMeta (wishlist)', () => {
  it('summarises the items', () => {
    const m = buildMeta('wishlist', { items: [{ name: 'A' }, { name: 'B' }] }, { ...ctx, path: '/wishlist/abc123' })
    expect(m.title).toBe('2 whisky wishlist – The Dram Journal')
    expect(m.description).toContain('A, B')
  })
  it('handles an empty list', () => {
    expect(buildMeta('wishlist', { items: [] }, ctx).description).toContain('wishlist shared')
  })
})

describe('ID_RE', () => {
  it('accepts uuids/slugs and rejects junk', () => {
    expect(ID_RE.test('3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f')).toBe(true)
    expect(ID_RE.test('../../etc')).toBe(false)
    expect(ID_RE.test('a')).toBe(false)
  })
})
