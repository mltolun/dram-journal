<template>
  <div style="position:fixed;inset:0;background:var(--peat);display:flex;align-items:center;justify-content:center;z-index:500;">
    <div class="auth-box">
      <div class="auth-logo">The <span>Dram</span> Journal</div>
      <div class="auth-tagline">{{ t.resetTitle }}</div>
      <div v-if="noSession" class="auth-msg auth-error" role="alert">{{ t.resetNoSession }}</div>
      <div v-if="error" class="auth-msg auth-error" role="alert">{{ error }}</div>
      <div v-if="success" class="auth-msg auth-success" role="status">{{ success }}</div>
      <template v-if="!noSession">
        <div class="form-row">
          <label for="reset-pass">{{ t.newPassword }}</label>
          <input id="reset-pass" type="password" v-model="pass" placeholder="········" autocomplete="new-password" @keydown.enter="submit">
        </div>
        <div class="form-row">
          <label for="reset-pass2">{{ t.confirmNewPassword }}</label>
          <input id="reset-pass2" type="password" v-model="pass2" placeholder="········" autocomplete="new-password" @keydown.enter="submit">
        </div>
        <button class="btn-auth" :disabled="saving" :aria-busy="saving" @click="submit">
          {{ saving ? t.savingPassword : t.saveNewPassword }}
        </button>
      </template>
      <button v-else class="btn-auth" @click="router.push('/app')">{{ t.signIn }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { MIN_PASSWORD_LENGTH } from '../lib/constants.js'
import { useI18n } from '../composables/useI18n.js'

const { updatePassword, getSession } = useAuth()
const { t } = useI18n()
const router = useRouter()

const pass   = ref('')
const pass2  = ref('')
const saving = ref(false)
const error  = ref('')
const success= ref('')
const noSession = ref(false)

onMounted(async () => {
  const session = await getSession()
  if (!session) noSession.value = true
})

async function submit() {
  error.value = ''; success.value = ''
  if (!pass.value || pass.value.length < MIN_PASSWORD_LENGTH) { error.value = t.value.passwordTooShort; return }
  if (pass.value !== pass2.value) { error.value = t.value.passwordsNoMatch; return }
  saving.value = true
  try {
    await updatePassword(pass.value)
    success.value = t.value.passwordUpdated
    try {
      await getSession()
      setTimeout(() => router.push('/app'), 1200)
    } catch (navErr) {
      console.error('Post-reset navigation failed:', navErr)
      saving.value = false
      error.value = t.value.resetRedirectFailed
      success.value = ''
    }
  } catch (e) {
    console.error('Password update failed:', e)
    error.value = t.value.passwordUpdateFailed
    saving.value = false
  }
}
</script>
