<template>
  <div class="auth-box">
    <div class="auth-logo">The <span>Dram</span> Journal</div>
    <div class="auth-tagline">Whisky tasting & comparison log</div>
    <div class="auth-tabs">
      <button class="auth-tab" :class="{ active: tab === 'login' }" @click="tab = 'login'">Sign in</button>
      <button class="auth-tab" :class="{ active: tab === 'register' }" @click="tab = 'register'">Register</button>
    </div>
    <div v-if="error"   class="auth-msg auth-error">{{ error }}</div>
    <div v-if="success" class="auth-msg auth-success">{{ success }}</div>
    <div class="form-row">
      <label>Email address</label>
      <input type="email" v-model="email" placeholder="you@email.com" @keydown.enter="submit">
    </div>
    <div class="form-row">
      <label>Password</label>
      <input type="password" v-model="password" placeholder="········" @keydown.enter="submit">
    </div>
    <div v-if="tab === 'register'" class="form-row">
      <label>Confirm password</label>
      <input type="password" v-model="password2" placeholder="········" @keydown.enter="submit">
    </div>
    <button class="btn-auth" :disabled="loading" @click="submit">
      {{ loading ? '…' : (tab === 'login' ? 'Sign in' : 'Create account') }}
    </button>
    <div v-if="tab === 'login'" class="forgot-link" @click="forgot">Forgot your password?</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useLookups } from '../composables/useLookups.js'

const { signIn, signUp, forgotPassword } = useAuth()
const { loadWhiskies } = useWhiskies()
const { loadLookups } = useLookups()

const tab       = ref('login')
const email     = ref('')
const password  = ref('')
const password2 = ref('')
const loading   = ref(false)
const error     = ref('')
const success   = ref('')

async function submit() {
  error.value = ''; success.value = ''
  if (!email.value || !password.value) { error.value = 'Please fill in all fields'; return }
  if (tab.value === 'register' && password.value !== password2.value) { error.value = 'Passwords do not match'; return }
  if (tab.value === 'register' && password.value.length < 6) { error.value = 'Password must be at least 6 characters'; return }
  loading.value = true
  try {
    if (tab.value === 'login') {
      await signIn(email.value, password.value)
      await Promise.all([loadWhiskies(), loadLookups()])
    } else {
      const data = await signUp(email.value, password.value)
      if (data.user && data.session) {
        await Promise.all([loadWhiskies(), loadLookups()])
      } else {
        success.value = 'Account created! Check your email to confirm.'
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function forgot() {
  if (!email.value) { error.value = 'Enter your email first'; return }
  try {
    await forgotPassword(email.value)
    success.value = 'Password reset email sent.'
  } catch (e) {
    error.value = e.message
  }
}
</script>
