import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

describe('BadgeToast', () => {
  beforeEach(() => {
    localStorage.setItem('dj_locale', 'en')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  async function getMods() {
    const BadgeToast = (await import('../components/BadgeToast.vue')).default
    const { useBadgeToast } = await import('../composables/useBadgeToast.js')
    return { BadgeToast, useBadgeToast }
  }

  it('renders nothing when invisible', async () => {
    const { BadgeToast, useBadgeToast } = await getMods()
    const { badgeToastVisible, badgeToastData } = useBadgeToast()

    expect(badgeToastVisible.value).toBe(false)
    expect(badgeToastData.value).toBeNull()

    const wrapper = mount(BadgeToast, {
      global: { stubs: { Teleport: false, Transition: false } },
    })
    expect(wrapper.find('.badge-toast').exists()).toBe(false)
  })

  it('renders badge info when badgeToast fires', async () => {
    const { BadgeToast, useBadgeToast } = await getMods()
    const { badgeToast } = useBadgeToast()

    badgeToast('Trophy', 'Century Club', '100 whiskies in your journal')

    const wrapper = mount(BadgeToast, {
      global: {
        stubs: {
          Teleport: { template: '<div><slot /></div>' },
          Transition: { template: '<div><slot /></div>' },
        },
      },
    })
    expect(wrapper.find('.badge-toast').exists()).toBe(true)
    expect(wrapper.text()).toContain('Century Club')
    expect(wrapper.text()).toContain('100 whiskies')
  })

  it('hides after 4000ms', async () => {
    const { BadgeToast, useBadgeToast } = await getMods()
    const { badgeToast, badgeToastVisible } = useBadgeToast()

    badgeToast('Trophy', 'Century Club', '100 whiskies')
    expect(badgeToastVisible.value).toBe(true)

    vi.advanceTimersByTime(4000)
    expect(badgeToastVisible.value).toBe(false)
  })
})
