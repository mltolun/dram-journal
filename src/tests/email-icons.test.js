import { describe, expect, it } from 'vitest'
import { emailIcon, emailIconImg, emailIconUrl } from '../../scripts/email-icons.js'

describe('emailIcon', () => {
  it('maps badge ids and icon ids to email-safe glyphs', () => {
    expect(emailIcon('first_dram')).toBe('🥃')
    expect(emailIcon('glass-water')).toBe('🥃')
    expect(emailIcon('Globe')).toBe('🌍')
    expect(emailIcon('flask-conical')).toBe('🧪')
    expect(emailIcon('social_butterfly')).toBe('👥')
  })

  it('falls back when an icon is unknown', () => {
    expect(emailIcon('not-a-real-icon')).toBe('◆')
    expect(emailIcon('', '★')).toBe('★')
  })

  it('maps icon ids to hosted image urls', () => {
    expect(emailIconUrl('first_dram', 'https://dramjournal.online')).toBe('https://dramjournal.online/icons/email/glass-water.png')
    expect(emailIconUrl('Globe', 'https://dramjournal.online')).toBe('https://dramjournal.online/icons/email/globe.png')
    expect(emailIconUrl('nope', 'https://dramjournal.online')).toBe(null)
  })

  it('renders hosted image html for supported icons', () => {
    expect(emailIconImg('star', 'https://dramjournal.online', { size: 20, alt: 'Star badge' })).toContain('src="https://dramjournal.online/icons/email/star.png"')
    expect(emailIconImg('star', 'https://dramjournal.online', { size: 20, alt: 'Star badge' })).toContain('width="20"')
    expect(emailIconImg('nope', 'https://dramjournal.online')).toBe('')
  })
})
