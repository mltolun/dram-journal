import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.resetModules()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts with dark theme when no theme is stored', async () => {
    const { theme } = await import('../composables/useTheme.js')
    expect(theme.value).toBe('dark')
  })

  it('starts with stored theme from localStorage', async () => {
    localStorage.setItem('dram-theme', 'light')
    vi.resetModules()
    const { theme } = await import('../composables/useTheme.js')
    expect(theme.value).toBe('light')
  })

  it('migrates "whisky" stored value to dark', async () => {
    localStorage.setItem('dram-theme', 'whisky')
    vi.resetModules()
    const { theme } = await import('../composables/useTheme.js')
    expect(theme.value).toBe('dark')
  })

  it('falls back to dark for invalid stored values', async () => {
    localStorage.setItem('dram-theme', 'invalid')
    vi.resetModules()
    const { theme } = await import('../composables/useTheme.js')
    expect(theme.value).toBe('dark')
  })

  it('applies the theme attribute on the document element', async () => {
    await import('../composables/useTheme.js')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('cycleTheme toggles between light and dark', async () => {
    const { useTheme, theme } = await import('../composables/useTheme.js')
    const { cycleTheme } = useTheme()
    expect(theme.value).toBe('dark')
    cycleTheme()
    expect(theme.value).toBe('light')
    cycleTheme()
    expect(theme.value).toBe('dark')
  })

  it('cycleTheme cycles through THEMES correctly', async () => {
    const { useTheme, theme, THEMES } = await import('../composables/useTheme.js')
    const { cycleTheme } = useTheme()

    const themeCount = THEMES.length
    for (let i = 0; i < themeCount; i++) {
      cycleTheme()
    }
    // After cycling through all themes, should be back to 'dark'
    expect(theme.value).toBe('dark')
  })

  it('updates theme value synchronously on cycle', async () => {
    localStorage.setItem('dram-theme', 'dark')
    vi.resetModules()
    const { useTheme, theme } = await import('../composables/useTheme.js')
    const { cycleTheme } = useTheme()
    expect(theme.value).toBe('dark')
    cycleTheme()
    expect(theme.value).toBe('light')
  })
})
