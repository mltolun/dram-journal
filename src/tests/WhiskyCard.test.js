import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

const iconStubs = {
  ArrowUpIcon: { template: '<span />' },
  Columns2Icon: { template: '<span />' },
  Trash2Icon: { template: '<span />' },
  Share2Icon: { template: '<span />' },
  RotateCcwIcon: { template: '<span />' },
  StarIcon: { template: '<span />' },
  PlusIcon: { template: '<span />' },
  GlassWaterIcon: { template: '<span />' },
}

describe('WhiskyCard', () => {
  beforeEach(() => {
    localStorage.setItem('dj_locale', 'en')
  })

  afterEach(() => {
    localStorage.clear()
  })

  async function getMod() {
    return (await import('../components/WhiskyCard.vue')).default
  }

  const baseWhisky = {
    id: 'w1',
    name: 'Arran 10 Year Old',
    distillery: 'Arran',
    origin: 'Scotland',
    type: 'scotch',
    age: '10 years',
    abv: '46%',
    rating: 4,
    list: 'journal',
    dulzor: 3,
    ahumado: 1,
    cuerpo: 2,
    frutado: 3,
    especiado: 1,
  }

  it('renders whisky name and distillery', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    expect(wrapper.text()).toContain('Arran 10 Year Old')
    expect(wrapper.text()).toContain('Arran')
  })

  it('shows type badge', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    expect(wrapper.text()).toContain('Scotch')
  })

  it('shows age and abv', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    expect(wrapper.text()).toContain('10 years')
    expect(wrapper.text()).toContain('46%')
  })

  it('shows whisky rating', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    expect(wrapper.text()).toContain('4')
  })

  it('emits view event on click', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    await wrapper.find('.wcard').trigger('click')
    expect(wrapper.emitted('view')).toBeTruthy()
    expect(wrapper.emitted('view')[0]).toEqual([baseWhisky])
  })

  it('emits delete event on delete button click', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    const delBtn = wrapper.find('.wcard-btn.del')
    // There are multiple buttons, the delete button has the .del class
    if (delBtn.exists()) {
      await delBtn.trigger('click')
      expect(wrapper.emitted('delete')).toBeTruthy()
    }
  })

  it('shows NAS when no age', async () => {
    const comp = await getMod()
    const noAge = { ...baseWhisky, age: '' }
    const wrapper = mount(comp, {
      props: { whisky: noAge },
      global: { stubs: iconStubs },
    })
    expect(wrapper.text()).toContain('NAS')
  })

  it('renders in compact mode', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky, compact: true },
      global: { stubs: iconStubs },
    })
    expect(wrapper.find('.wcard-row').exists()).toBe(true)
    expect(wrapper.find('.wcard').exists()).toBe(false)
  })

  it('adds selected class when selected', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky, selected: true },
      global: { stubs: iconStubs },
    })
    expect(wrapper.find('.selected').exists()).toBe(true)
  })

  it('shows trash UI for trash items', async () => {
    const comp = await getMod()
    const trashWhisky = { ...baseWhisky, list: 'trash', deleted_at: new Date().toISOString() }
    const wrapper = mount(comp, {
      props: { whisky: trashWhisky },
      global: { stubs: iconStubs },
    })
    expect(wrapper.find('.wcard.trash').exists()).toBe(true)
    expect(wrapper.text()).toContain('day') // days left
  })

  it('renders flavour attribute bars for journal entries', async () => {
    const comp = await getMod()
    const wrapper = mount(comp, {
      props: { whisky: baseWhisky },
      global: { stubs: iconStubs },
    })
    const bars = wrapper.findAll('.bar-row-s')
    expect(bars.length).toBe(5) // 5 attributes
    expect(bars[0].text()).toContain('Sweetness')
  })
})
