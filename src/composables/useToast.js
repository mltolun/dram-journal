import { ref } from 'vue'

export const toastMsg = ref('')
export const toastVisible = ref(false)
let toastTimer = null

export function useToast() {
  function toast(msg) {
    toastMsg.value = msg
    toastVisible.value = true
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastVisible.value = false }, 2400)
  }
  return { toast, toastMsg, toastVisible }
}
