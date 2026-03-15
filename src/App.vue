<template>
  <RouterView />
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

const router = useRouter()
const { toastMsg, toastVisible } = useToast()

onMounted(() => {
  // Supabase puts recovery tokens in the URL hash as
  // #access_token=...&type=recovery — parse and handle them
  const hash = window.location.hash
  if (hash && hash.includes('type=recovery')) {
    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken) {
      sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
        .then(() => {
          // Clear the token from the URL, then navigate to reset
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
          router.push('/reset')
        })
    }
  }

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
