import { ref, watch } from 'vue'

export const THEMES = ['dark', 'light']

const stored = localStorage.getItem('dram-theme')
// migrate anyone who had 'whisky' saved
const initial = stored === 'whisky' || !THEMES.includes(stored) ? 'dark' : stored
export const theme = ref(initial)

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t)
}

applyTheme(theme.value)

watch(theme, (t) => {
  applyTheme(t)
  localStorage.setItem('dram-theme', t)
})

export function useTheme() {
  function cycleTheme() {
    const idx = THEMES.indexOf(theme.value)
    theme.value = THEMES[(idx + 1) % THEMES.length]
  }

  return { theme, THEMES, cycleTheme }
}
