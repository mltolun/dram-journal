<template>
  <div class="auth-box">
    <div class="auth-logo">The <span>Dram</span> Journal</div>
    <div class="auth-tagline">{{ t.brandSub }}</div>
    <div class="auth-tabs">
      <button class="auth-tab" :class="{ active: tab === 'login' }" @click="tab = 'login'">{{ t.signIn }}</button>
      <button class="auth-tab" :class="{ active: tab === 'register' }" @click="tab = 'register'">{{ t.register }}</button>
    </div>
    <div v-if="error"   class="auth-msg auth-error">{{ error }}</div>
    <div v-if="success" class="auth-msg auth-success">{{ success }}</div>
    <div class="form-row">
      <label>{{ t.emailAddress }}</label>
      <input type="email" v-model="email" placeholder="you@email.com" @keydown.enter="submit">
    </div>
    <div class="form-row">
      <label>{{ t.password }}</label>
      <input type="password" v-model="password" placeholder="········" @keydown.enter="submit">
    </div>
    <div v-if="tab === 'register'" class="form-row">
      <label>{{ t.confirmPassword }}</label>
      <input type="password" v-model="password2" placeholder="········" @keydown.enter="submit">
    </div>
    <button class="btn-auth" :disabled="loading" @click="submit">
      {{ loading ? '…' : (tab === 'login' ? t.signIn : t.createAccount) }}
    </button>
    <div v-if="tab === 'login'" class="forgot-link" @click="forgot">{{ t.forgotPassword }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useI18n } from '../composables/useI18n.js'

const { signIn, signUp, forgotPassword } = useAuth()
const { loadWhiskies } = useWhiskies()
const { t } = useI18n()

const tab       = ref('login')
const email     = ref('')
const password  = ref('')
const password2 = ref('')
const loading   = ref(false)
const error     = ref('')
const success   = ref('')

async function submit() {
  error.value = ''; success.value = ''
  if (!email.value || !password.value) { error.value = t.value.fillAllFields; return }
  if (tab.value === 'register' && password.value !== password2.value) { error.value = t.value.passwordsNoMatch; return }
  if (tab.value === 'register' && password.value.length < 6) { error.value = t.value.passwordTooShort; return }
  loading.value = true
  try {
    if (tab.value === 'login') {
      await signIn(email.value, password.value)
      await loadWhiskies()
    } else {
      const data = await signUp(email.value, password.value)
      if (data.user && data.session) {
        await loadWhiskies()
      } else {
        success.value = t.value.accountCreated
      }
    }
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function forgot() {
  if (!email.value) { error.value = t.value.enterEmailFirst; return }
  try {
    await forgotPassword(email.value)
    success.value = t.value.passwordResetSent
  } catch (e) {
    error.value = e.message
  }
}
</script>
