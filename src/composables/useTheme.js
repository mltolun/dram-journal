import { ref, watch } from 'vue'

const THEMES = ['whisky', 'light', 'dark']
const stored = localStorage.getItem('dram-theme') || 'whisky'
const theme = ref(THEMES.includes(stored) ? stored : 'whisky')

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

  return { theme, cycleTheme, THEMES }
}
