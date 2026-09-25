import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

describe('useDialog', () => {
  beforeEach(() => {
    localStorage.setItem('dj_locale', 'en')
  })

  afterEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
  })

  async function getMod() {
    return await import('../composables/useDialog.js')
  }

  function mountDialog(options = {}) {
    const { useDialog } = options.mod
    return mount(
      defineComponent({
        setup() {
          const rootEl = ref(null)
          useDialog(rootEl, { onClose: options.onClose })
          return () =>
            h('div', { ref: rootEl, role: 'dialog', 'aria-modal': 'true' }, [
              h('button', { class: 'first' }, 'first'),
              h('button', { class: 'second' }, 'second'),
            ])
        },
      }),
      { attachTo: document.body }
    )
  }

  it('moves initial focus inside the dialog on mount', async () => {
    const mod = await getMod()
    const onClose = vi.fn()
    const wrapper = mountDialog({ mod, onClose })
    await nextTick()
    await nextTick()
    expect(wrapper.element.contains(document.activeElement)).toBe(true)
    wrapper.unmount()
  })

  it('calls onClose on Escape', async () => {
    const mod = await getMod()
    const onClose = vi.fn()
    const wrapper = mountDialog({ mod, onClose })
    await nextTick()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('traps Tab inside the dialog', async () => {
    const mod = await getMod()
    const wrapper = mountDialog({ mod, onClose: vi.fn() })
    await nextTick()
    await nextTick()
    const btns = wrapper.findAll('button')
    expect(btns.length).toBe(2)
    // happy-dom has no layout engine (offsetWidth is always 0), so stub visibility
    for (const b of btns) {
      Object.defineProperty(b.element, 'offsetWidth', { value: 40, configurable: true })
      Object.defineProperty(b.element, 'offsetHeight', { value: 40, configurable: true })
    }
    btns[1].element.focus()
    expect(document.activeElement).toBe(btns[1].element)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    expect(document.activeElement).toBe(btns[0].element)
    // Shift+Tab from first wraps to last
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    expect(document.activeElement).toBe(btns[1].element)
    wrapper.unmount()
  })

  it('restores focus to the previously focused element on unmount', async () => {
    const mod = await getMod()
    const outside = document.createElement('button')
    outside.textContent = 'outside'
    document.body.appendChild(outside)
    outside.focus()
    expect(document.activeElement).toBe(outside)
    const wrapper = mountDialog({ mod, onClose: vi.fn() })
    await nextTick()
    await nextTick()
    expect(document.activeElement).not.toBe(outside)
    wrapper.unmount()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('pushDialog closes only the topmost layer on Escape', async () => {
    const mod = await getMod()
    const first = vi.fn()
    const second = vi.fn()
    const pop1 = mod.pushDialog(() => document.body, first)
    const pop2 = mod.pushDialog(() => document.body, second)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    pop2()
    pop1()
  })
})
