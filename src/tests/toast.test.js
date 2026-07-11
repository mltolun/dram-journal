import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

describe('useToast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a toast message', async () => {
    const { useToast } = await import('../composables/useToast.js')
    const { toast, toastMsg, toastVisible } = useToast()
    toast('Hello')
    expect(toastMsg.value).toBe('Hello')
    expect(toastVisible.value).toBe(true)
  })

  it('hides the toast after 2400ms', async () => {
    const { useToast } = await import('../composables/useToast.js')
    const { toast, toastVisible } = useToast()
    toast('Hello')
    expect(toastVisible.value).toBe(true)
    vi.advanceTimersByTime(2400)
    expect(toastVisible.value).toBe(false)
  })

  it('replaces previous toast and resets timer', async () => {
    const { useToast } = await import('../composables/useToast.js')
    const { toast, toastMsg, toastVisible } = useToast()
    toast('First')
    vi.advanceTimersByTime(1000)
    toast('Second')
    expect(toastMsg.value).toBe('Second')
    // Should not have been hidden at 2400ms from first call
    vi.advanceTimersByTime(1400)
    expect(toastVisible.value).toBe(true)
    // Should hide 2400ms from second call
    vi.advanceTimersByTime(1000)
    expect(toastVisible.value).toBe(false)
  })
})

describe('useBadgeToast', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows badge toast with icon, name, and description', async () => {
    const { useBadgeToast } = await import('../composables/useBadgeToast.js')
    const { badgeToast, badgeToastData, badgeToastVisible } = useBadgeToast()
    badgeToast('Trophy', 'Century Club', '100 whiskies')
    expect(badgeToastData.value).toEqual({ icon: 'Trophy', name: 'Century Club', desc: '100 whiskies' })
    expect(badgeToastVisible.value).toBe(true)
  })

  it('hides badge toast after 4000ms', async () => {
    const { useBadgeToast } = await import('../composables/useBadgeToast.js')
    const { badgeToast, badgeToastVisible } = useBadgeToast()
    badgeToast('Trophy', 'Test', 'Test desc')
    expect(badgeToastVisible.value).toBe(true)
    vi.advanceTimersByTime(4000)
    expect(badgeToastVisible.value).toBe(false)
  })

  it('replaces previous badge toast and resets timer', async () => {
    const { useBadgeToast } = await import('../composables/useBadgeToast.js')
    const { badgeToast, badgeToastData, badgeToastVisible } = useBadgeToast()
    badgeToast('GlassWater', 'First Dram', 'Log your first whisky')
    vi.advanceTimersByTime(1000)
    badgeToast('Trophy', 'Century Club', '100 whiskies')
    expect(badgeToastData.value).toEqual({ icon: 'Trophy', name: 'Century Club', desc: '100 whiskies' })
    // Should still be visible at 4000ms from first call
    vi.advanceTimersByTime(3000)
    expect(badgeToastVisible.value).toBe(true)
    // Should hide 4000ms from second call
    vi.advanceTimersByTime(1000)
    expect(badgeToastVisible.value).toBe(false)
  })
})
