import { ref } from 'vue'

// Shared panel open-state so both AppHeader (mobile) and AppSidebar (desktop)
// can trigger the same panel overlays.
export const statsOpen   = ref(false)
export const subsOpen    = ref(false)
export const featureOpen = ref(false)
