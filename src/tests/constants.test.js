import { describe, it, expect } from 'vitest'
import { COLOR_HEX, ATTRS, ATTR_LABELS, DEFAULTS, TYPE_LABELS, TYPE_BADGE_STYLE } from '../lib/constants.js'

describe('COLOR_HEX', () => {
  it('has 4 colors', () => {
    expect(COLOR_HEX).toHaveLength(4)
  })

  it('each entry is a valid 6-digit hex color', () => {
    COLOR_HEX.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/))
  })
})

describe('ATTRS', () => {
  it('has exactly 5 attribute keys', () => {
    expect(ATTRS).toEqual(['dulzor', 'ahumado', 'cuerpo', 'frutado', 'especiado'])
  })
})

describe('ATTR_LABELS', () => {
  it('has a label for every attribute', () => {
    ATTRS.forEach(a => expect(ATTR_LABELS[a]).toBeTypeOf('string'))
  })

  it('labels have correct values', () => {
    expect(ATTR_LABELS.dulzor).toBe('Sweetness')
    expect(ATTR_LABELS.ahumado).toBe('Smokiness')
    expect(ATTR_LABELS.cuerpo).toBe('Body')
    expect(ATTR_LABELS.frutado).toBe('Fruitiness')
    expect(ATTR_LABELS.especiado).toBe('Spiciness')
  })
})

describe('DEFAULTS', () => {
  it('all attributes default to 0', () => {
    ATTRS.forEach(a => expect(DEFAULTS[a]).toBe(0))
  })

  it('has no extra keys beyond attributes', () => {
    expect(Object.keys(DEFAULTS)).toEqual(ATTRS)
  })
})

describe('TYPE_LABELS', () => {
  const expected = { scotch: 'Scotch', irish: 'Irish', bourbon: 'Bourbon', japanese: 'Japanese', other: 'Other' }
  it('maps every style to a label', () => {
    expect(TYPE_LABELS).toEqual(expected)
  })
})

describe('TYPE_BADGE_STYLE', () => {
  it('has a style for every type', () => {
    Object.keys(TYPE_LABELS).forEach(t => expect(TYPE_BADGE_STYLE[t]).toBeTypeOf('string'))
  })

  it('each style contains colour CSS', () => {
    Object.values(TYPE_BADGE_STYLE).forEach(s => expect(s).toMatch(/^background:rgba/))
  })
})
