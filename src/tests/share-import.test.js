import { describe, it, expect } from 'vitest'
import { pickImportFields, sanitizePhoto, isOwnStorageUrl } from '../lib/shareImport.js'
import { legacyHashToPath } from '../lib/legacy-hash.js'

const SB = 'https://abc.supabase.co'

describe('pickImportFields', () => {
  it('copies only whitelisted columns', () => {
    const out = pickImportFields({
      id: 1, user_id: 'victim', created_at: 'x', list: 'journal', dram_count: 99, last_dram_at: 'x',
      is_admin: true, name: 'Lagavulin 16', distillery: 'Lagavulin', rating: 4, ahumado: 5,
    }, SB)
    expect(out).toEqual({ name: 'Lagavulin 16', distillery: 'Lagavulin', rating: 4, ahumado: 5, dulzor: 0, cuerpo: 0, frutado: 0, especiado: 0 })
    expect(out.user_id).toBeUndefined()
    expect(out.list).toBeUndefined()
    expect(out.dram_count).toBeUndefined()
  })

  it('clamps numeric attributes and caps text length', () => {
    const out = pickImportFields({ name: 'x'.repeat(500), ahumado: 99, rating: -3, notes: 'n'.repeat(9000) }, SB)
    expect(out.name).toHaveLength(200)
    expect(out.notes).toHaveLength(5000)
    expect(out.ahumado).toBe(5)
    expect(out.rating).toBe(0)
  })

  it('keeps photos only from our own storage bucket', () => {
    const ok = `${SB}/storage/v1/object/public/whisky-photos/u/1.jpg`
    expect(pickImportFields({ name: 'a', photo_url: ok }, SB).photo_url).toBe(ok)
    expect(pickImportFields({ name: 'a', photo_url: 'https://evil.test/pixel.gif' }, SB).photo_url).toBeUndefined()
    expect(pickImportFields({ name: 'a', photo_url: `${SB}/rest/v1/whiskies` }, SB).photo_url).toBeUndefined()
    expect(pickImportFields({ name: 'a', photo_url: 'javascript:alert(1)' }, SB).photo_url).toBeUndefined()
  })

  it('handles junk input', () => {
    expect(pickImportFields(null, SB)).toEqual({})
    expect(pickImportFields('str', SB)).toEqual({})
  })
})

describe('sanitizePhoto / isOwnStorageUrl', () => {
  it('strips foreign photo urls but keeps the rest', () => {
    expect(sanitizePhoto({ name: 'a', photo_url: 'http://evil.test/x.png' }, SB)).toEqual({ name: 'a' })
  })
  it('rejects http and look-alike hosts', () => {
    expect(isOwnStorageUrl('http://abc.supabase.co/storage/v1/object/public/x', SB)).toBe(false)
    expect(isOwnStorageUrl('https://abc.supabase.co.evil.test/storage/v1/object/public/x', SB)).toBe(false)
  })
})

describe('legacyHashToPath', () => {
  it('rewrites old hash links to real paths', () => {
    expect(legacyHashToPath('#/share/abc-123')).toBe('/share/abc-123')
    expect(legacyHashToPath('#/wishlist/xyz')).toBe('/wishlist/xyz')
    expect(legacyHashToPath('#/app')).toBe('/app')
    expect(legacyHashToPath('#/reset')).toBe('/reset')
  })
  it('respects a base path', () => {
    expect(legacyHashToPath('#/share/abc', '/dram-journal/')).toBe('/dram-journal/share/abc')
  })
  it('never touches auth fragments or unknown hashes', () => {
    expect(legacyHashToPath('#access_token=a&type=recovery')).toBeNull()
    expect(legacyHashToPath('#/share/x?access_token=1')).toBeNull()
    expect(legacyHashToPath('#/something-else')).toBeNull()
    expect(legacyHashToPath('')).toBeNull()
  })
})
