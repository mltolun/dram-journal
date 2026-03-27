<template>
  <div style="position:fixed;inset:0;background:var(--peat);display:flex;align-items:center;justify-content:center;z-index:500;">
    <div class="auth-box">
      <div class="auth-logo">The <span>Dram</span> Journal</div>
      <div class="auth-tagline">Set your new password</div>
      <div v-if="error" class="auth-msg auth-error">{{ error }}</div>
      <div v-if="success" class="auth-msg auth-success">{{ success }}</div>
      <div class="form-row">
        <label>New password</label>
        <input type="password" v-model="pass" placeholder="········" @keydown.enter="submit">
      </div>
      <div class="form-row">
        <label>Confirm new password</label>
        <input type="password" v-model="pass2" placeholder="········" @keydown.enter="submit">
      </div>
      <button class="btn-auth" :disabled="saving" @click="submit">
        {{ saving ? 'Saving…' : 'Save new password' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'

const { updatePassword, getSession } = useAuth()
const router = useRouter()

const pass   = ref('')
const pass2  = ref('')
const saving = ref(false)
const error  = ref('')
const success= ref('')

async function submit() {
  error.value = ''; success.value = ''
  if (!pass.value || pass.value.length < 6) { error.value = 'Password must be at least 6 characters'; return }
  if (pass.value !== pass2.value) { error.value = 'Passwords do not match'; return }
  saving.value = true
  try {
    await updatePassword(pass.value)
    success.value = 'Password updated! Signing you in…'
    setTimeout(async () => {
      await getSession()
      router.push('/')
    }, 1500)
  } catch (e) {
    error.value = e.message
    saving.value = false
  }
}
</script>
