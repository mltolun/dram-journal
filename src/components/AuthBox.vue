<template>
  <div class="auth-box">
    <div class="auth-logo">The <span>Dram</span> Journal</div>
    <div class="auth-tagline">{{ t.brandSub }}</div>
    <div class="auth-tabs" role="tablist" :aria-label="t.authTabsLabel">
      <button class="auth-tab" role="tab" :aria-selected="tab === 'login'" :class="{ active: tab === 'login' }" @click="tab = 'login'">{{ t.signIn }}</button>
      <button class="auth-tab" role="tab" :aria-selected="tab === 'register'" :class="{ active: tab === 'register' }" @click="tab = 'register'">{{ t.register }}</button>
    </div>
    <div v-if="error"   class="auth-msg auth-error" role="alert">{{ error }}</div>
    <div v-if="success" class="auth-msg auth-success" role="status">{{ success }}</div>
    <div class="form-row">
      <label for="auth-email">{{ t.emailAddress }}</label>
      <input id="auth-email" type="email" v-model="email" placeholder="you@email.com" autocomplete="email" @keydown.enter="submit">
    </div>
    <div class="form-row">
      <label for="auth-password">{{ t.password }}</label>
      <input id="auth-password" type="password" v-model="password" placeholder="········" :autocomplete="tab === 'login' ? 'current-password' : 'new-password'" @keydown.enter="submit">
    </div>
    <div v-if="tab === 'register'" class="form-row">
      <label for="auth-password2">{{ t.confirmPassword }}</label>
      <input id="auth-password2" type="password" v-model="password2" placeholder="········" autocomplete="new-password" @keydown.enter="submit">
    </div>
    <button class="btn-auth" :disabled="loading" :aria-busy="loading" @click="submit">
      {{ loading ? (tab === 'login' ? t.signingIn : t.creatingAccount) : (tab === 'login' ? t.signIn : t.createAccount) }}
    </button>
    <button v-if="tab === 'login'" type="button" class="forgot-link" @click="forgot">{{ t.forgotPassword }}</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { useWhiskies } from '../composables/useWhiskies.js'
import { useI18n } from '../composables/useI18n.js'

const props = defineProps({ initialTab: { type: String, default: 'login' } })

const { signIn, signUp, forgotPassword } = useAuth()
const { loadWhiskies } = useWhiskies()
const { t } = useI18n()

const tab       = ref(props.initialTab)
const email     = ref('')
const password  = ref('')
const password2 = ref('')
const loading   = ref(false)
const error     = ref('')
const success   = ref('')

// Map raw Supabase auth errors to friendly, translated messages
function friendlyAuthError(e) {
  const msg = String(e?.message || '')
  const lower = msg.toLowerCase()
  if (lower.includes('invalid login credentials')) return t.value.invalidCredentials
  if (lower.includes('email not confirmed')) return t.value.emailNotConfirmed
  if (lower.includes('already registered') || lower.includes('already been registered')) return t.value.userAlreadyRegistered
  if (lower.includes('rate limit')) return t.value.tooManyAttempts
  if (lower.includes('password should be at least')) return t.value.passwordTooShort
  if (lower.includes('unable to validate email') || lower.includes('invalid email')) return t.value.invalidEmail
  console.error('Auth error:', e)
  return msg || t.value.genericError
}

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
        // Email confirmation required — guide the user to their inbox, then to login
        success.value = t.value.accountCreated
        password.value = ''
        password2.value = ''
        tab.value = 'login'
      }
    }
  } catch (e) {
    error.value = friendlyAuthError(e)
  } finally {
    loading.value = false
  }
}

async function forgot() {
  if (!email.value) { error.value = t.value.enterEmailFirst; return }
  error.value = ''
  try {
    await forgotPassword(email.value)
    success.value = t.value.passwordResetSent
  } catch (e) {
    error.value = friendlyAuthError(e)
  }
}
</script>
