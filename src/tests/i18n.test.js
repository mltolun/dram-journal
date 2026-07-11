import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mapToSupportedLocale } from '../composables/useI18n.js'

describe('mapToSupportedLocale', () => {
  it('maps "en" to English', () => {
    expect(mapToSupportedLocale('en')).toBe('en')
  })

  it('maps "es" to Spanish', () => {
    expect(mapToSupportedLocale('es')).toBe('es')
  })

  it('maps "en-US" to English', () => {
    expect(mapToSupportedLocale('en-US')).toBe('en')
  })

  it('maps "es-ES" to Spanish', () => {
    expect(mapToSupportedLocale('es-ES')).toBe('es')
  })

  it('maps Spanish-speaking country codes to Spanish', () => {
    const spanishCountries = ['MX', 'AR', 'ES', 'CL', 'CO', 'PE', 'VE', 'CU', 'DO', 'EC', 'GT', 'HN', 'NI', 'PA', 'PY', 'SV', 'UY', 'BO', 'CR', 'GQ']
    spanishCountries.forEach(code => {
      expect(mapToSupportedLocale(code)).toBe('es')
    })
  })

  it('maps non-Spanish country codes to null', () => {
    expect(mapToSupportedLocale('US')).toBeNull()
    expect(mapToSupportedLocale('GB')).toBeNull()
    expect(mapToSupportedLocale('FR')).toBeNull()
    expect(mapToSupportedLocale('DE')).toBeNull()
  })

  it('returns null for unsupported languages', () => {
    expect(mapToSupportedLocale('fr')).toBeNull()
    expect(mapToSupportedLocale('de')).toBeNull()
    expect(mapToSupportedLocale('ja')).toBeNull()
    expect(mapToSupportedLocale('zh')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(mapToSupportedLocale('')).toBeNull()
  })

  it('returns null for null input', () => {
    expect(mapToSupportedLocale(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(mapToSupportedLocale(undefined)).toBeNull()
  })
})

describe('useI18n basic reactivity', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('defaults to English when no locale is stored', async () => {
    vi.resetModules()
    const { useI18n } = await import('../composables/useI18n.js')
    const { locale } = useI18n()
    expect(locale.value).toBe('en')
  })

  it('reads stored locale from localStorage', async () => {
    localStorage.setItem('dj_locale', 'es')
    vi.resetModules()
    const { useI18n } = await import('../composables/useI18n.js')
    const { locale } = useI18n()
    expect(locale.value).toBe('es')
  })
})
