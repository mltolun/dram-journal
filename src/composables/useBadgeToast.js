import { ref } from 'vue'

export const badgeToastData    = ref(null)   // { icon, name, desc }
export const badgeToastVisible = ref(false)

// Queue so rapid consecutive unlocks each get shown instead of replacing one another.
const queue = []
let badgeTimer = null
let showing = false

function showNext() {
  const next = queue.shift()
  if (!next) {
    showing = false
    return
  }
  showing = true
  badgeToastData.value    = next
  badgeToastVisible.value = true
  clearTimeout(badgeTimer)
  badgeTimer = setTimeout(() => {
    badgeToastVisible.value = false
    // brief gap before the next celebration
    badgeTimer = setTimeout(showNext, 350)
  }, 4000)
}

export function useBadgeToast() {
  function badgeToast(icon, name, desc) {
    queue.push({ icon, name, desc })
    if (!showing) showNext()
  }
  return { badgeToast, badgeToastData, badgeToastVisible }
}
