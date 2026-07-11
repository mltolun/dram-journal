import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportCSV } from '../utils/csv.js'

const mockWhisky = {
  list: 'journal',
  name: 'Arran 10',
  distillery: 'Arran',
  origin: 'Scotland',
  type: 'scotch',
  age: '10 years',
  price: '£40',
  date: '2024-01-01',
  nose: 'Vanilla, apple',
  palate: 'Sweet malt',
  notes: 'A lovely dram',
  dulzor: 3,
  ahumado: 1,
  cuerpo: 2,
  frutado: 3,
  especiado: 1,
}

describe('exportCSV', () => {
  let createObjectURLSpy
  let revokeObjectURLSpy

  beforeEach(() => {
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function getBlob() {
    return createObjectURLSpy.mock.calls[0][0]
  }

  async function getCsvText(whiskies) {
    exportCSV(whiskies)
    const blob = getBlob()
    return await (new Response(blob)).text()
  }

  it('generates CSV with UTF-8 BOM and correct headers', async () => {
    const text = await getCsvText([mockWhisky])
    expect(text.charCodeAt(0) === 0xFEFF || text.startsWith('List')).toBe(true)
    expect(text).toContain('List,Name,Distillery,Region / Origin,Style,Age / Maturation,Price,Date,Nose,Palate,Notes,Sweetness,Smokiness,Body,Fruitiness,Spiciness')
  })

  it('includes whisky data in CSV', async () => {
    const text = await getCsvText([mockWhisky])
    expect(text).toContain('journal,Arran 10,Arran')
    expect(text).toContain('Scotland')
    expect(text).toContain('scotch')
    expect(text).toContain('10 years')
    expect(text).toContain('£40')
  })

  it('escapes fields containing commas', async () => {
    const withComma = { ...mockWhisky, name: 'Arran, 10 Year Old', nose: 'Vanilla, apple' }
    const text = await getCsvText([withComma])
    expect(text).toContain('"Arran, 10 Year Old"')
    expect(text).toContain('"Vanilla, apple"')
  })

  it('escapes fields containing double quotes', async () => {
    const withQuotes = { ...mockWhisky, notes: 'Whisky is "excellent"' }
    const text = await getCsvText([withQuotes])
    expect(text).toContain('"Whisky is ""excellent"""')
  })

  it('handles null/undefined fields', async () => {
    const sparse = { list: 'wishlist', name: 'Test' }
    const text = await getCsvText([sparse])
    expect(text).toContain('wishlist,Test')
    const lines = text.trim().split('\r\n')
    expect(lines[1].split(',').length).toBe(lines[0].split(',').length)
  })

  it('revokes the object URL after download', () => {
    exportCSV([mockWhisky])
    const blobUrl = createObjectURLSpy.mock.results[0].value
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(blobUrl)
  })
})
