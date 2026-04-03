<template>
  <RouterView />
  <BadgeToast />
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="toastVisible" class="toast">{{ toastMsg }}</div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sb } from './lib/supabase.js'
import { currentUser } from './composables/useAuth.js'
import { useToast } from './composables/useToast.js'
import BadgeToast from './components/BadgeToast.vue'

const router = useRouter()
const { toastMsg, toastVisible } = useToast()

onMounted(() => {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      router.push('/reset')
    } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      currentUser.value = session?.user ?? null
    } else if (event === 'SIGNED_OUT') {
      currentUser.value = null
    }
  })
})
</script>

<style>
.toast-enter-active, .toast-leave-active { transition: all 0.3s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateY(20px); }
</style>
