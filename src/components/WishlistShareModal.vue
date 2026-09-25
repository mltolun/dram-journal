<template>
  <div class="modal-backdrop open" ref="rootEl" role="dialog" aria-modal="true" :aria-label="t.shareWishlist" @click.self="$emit('close')">
    <div class="modal modal--sm">
      <div class="modal-header">
        <div class="modal-title">{{ t.shareWishlist }}</div>
        <button class="modal-close" :aria-label="t.close" @click="$emit('close')"><XIcon :size="14" aria-hidden="true" /></button>
      </div>

      <div v-if="loading" class="ws-loading" role="status">
        {{ t.generatingLink }}
      </div>

      <template v-else>
        <p class="ws-count">
          <strong>{{ count }}</strong> {{ t.wishlistBottles(count) }}
        </p>
        <div class="share-link-box">
          <input ref="linkInput" type="text" :value="shareUrl" readonly :aria-label="t.shareWishlist" @focus="$event.target.select()">
          <button @click="copy">{{ t.copy }}</button>
        </div>
        <div class="share-tip" :class="{ 'share-error-text': linkError }" :role="linkError ? 'alert' : undefined">{{ tip }}</div>
      </template>

      <div class="modal-actions modal-actions--single">
        <button class="btn-cancel" @click="$emit('close')">{{ t.close }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { X as XIcon } from 'lucide-vue-next'
import { sb } from '../lib/supabase.js'
import { currentUser } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'
import { useI18n } from '../composables/useI18n.js'
import { useDialog } from '../composables/useDialog.js'

const props = defineProps({ items: Array })
const emit = defineEmits(['close'])

const { toast } = useToast()
const { t } = useI18n()
const shareUrl = ref('')
const tip = ref('')
const loading = ref(true)
const linkError = ref(false)
const count = ref(props.items?.length ?? 0)
const linkInput = ref(null)
const rootEl = ref(null)
useDialog(rootEl, { onClose: () => emit('close') })

onMounted(async () => {
  try {
    const uid = currentUser.value?.id
    // Reuse one row per user so old links stay valid and rows don't pile up.
    // The payload carries no user id — share_id alone grants access.
    let lookup = sb
      .from('shared_wishlists')
      .select('share_id')
      .order('created_at', { ascending: false })
      .limit(1)
    if (uid) lookup = lookup.eq('payload->>owner', uid)
    const { data: existing } = await lookup.maybeSingle()

    let shareId
    if (existing) {
      const payload = {
        owner: uid ?? null,
        items: props.items,
        shared_at: new Date().toISOString(),
      }
      const { error: upErr } = await sb
        .from('shared_wishlists')
        .update({ payload })
        .eq('share_id', existing.share_id)
      if (upErr) throw upErr
      shareId = existing.share_id
    } else {
      const payload = {
        owner: uid ?? null,
        items: props.items,
        shared_at: new Date().toISOString(),
      }
      const { data, error } = await sb
        .from('shared_wishlists')
        .insert({ payload })
        .select('share_id')
        .single()
      if (error) throw error
      shareId = data.share_id
    }

    shareUrl.value = window.location.origin + window.location.pathname + '#/wishlist/' + shareId
    tip.value = t.value.linkPublicWishlist
  } catch (e) {
    console.error('Could not generate wishlist link:', e)
    linkError.value = true
    tip.value = t.value.couldNotGenerateLink
  } finally {
    loading.value = false
  }
})

function copy() {
  if (!shareUrl.value) return
  navigator.clipboard.writeText(shareUrl.value)
    .then(() => toast(t.value.linkCopied))
    .catch((e) => {
      console.error('Clipboard copy failed:', e)
      linkInput.value?.focus()
      linkInput.value?.select()
      toast(t.value.linkCopyFailed)
    })
}
</script>

<style scoped>
.ws-loading {
  text-align: center;
  padding: 1.5rem 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  color: var(--peat-light);
}
.ws-count {
  font-family: 'Inter', sans-serif;
  font-size: 0.82rem;
  color: var(--peat-light);
  margin-bottom: 0.6rem;
  line-height: 1.6;
}
</style>
