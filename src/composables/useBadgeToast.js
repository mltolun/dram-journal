import { ref } from 'vue'

export const badgeToastData    = ref(null)   // { icon, name, desc }
export const badgeToastVisible = ref(false)
let badgeTimer = null

export function useBadgeToast() {
  function badgeToast(icon, name, desc) {
    badgeToastData.value    = { icon, name, desc }
    badgeToastVisible.value = true
    clearTimeout(badgeTimer)
    badgeTimer = setTimeout(() => { badgeToastVisible.value = false }, 4000)
  }
  return { badgeToast, badgeToastData, badgeToastVisible }
}
