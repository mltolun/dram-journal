<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title">{{ t.shareWishlist }}</div>
        <button class="modal-close" @click="$emit('close')"><XIcon :size="14" /></button>
      </div>

      <div v-if="loading" style="text-align:center;padding:1.5rem 0;font-family:'JetBrains Mono',monospace;font-size:0.65rem;color:var(--peat-light);">
        {{ t.generatingLink }}
      </div>

      <template v-else>
        <p style="font-family:'Inter',sans-serif;font-size:0.82rem;color:var(--peat-light);margin-bottom:0.6rem;line-height:1.6;"
          v-html="t.sharingBottles(count)">
        </p>
        <div class="share-link-box">
          <input type="text" :value="shareUrl" readonly>
          <button @click="copy">{{ t.copy }}</button>
        </div>
        <div class="share-tip">{{ tip }}</div>
      </template>

      <div class="modal-actions" style="margin-top:1.2rem">
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

const props = defineProps({ items: Array })
defineEmits(['close'])

const { toast } = useToast()
const { t } = useI18n()
const shareUrl = ref('')
const tip = ref('')
const loading = ref(true)
const count = ref(props.items?.length ?? 0)

onMounted(async () => {
  try {
    const payload = {
      user_id: currentUser.value?.id,
      items: props.items,
      shared_at: new Date().toISOString(),
    }

    const { data, error } = await sb
      .from('shared_wishlists')
      .insert({ payload })
      .select('share_id')
      .single()

    if (error) throw error

    shareUrl.value = window.location.origin + window.location.pathname + '#/wishlist/' + data.share_id
    tip.value = t.value.linkPublicWishlist
  } catch (e) {
    tip.value = t.value.couldNotGenerateLink + e.message
  } finally {
    loading.value = false
  }
})

function copy() {
  navigator.clipboard.writeText(shareUrl.value)
    .then(() => toast(t.value.linkCopied))
    .catch(() => toast(t.value.linkCopied))
}
</script>
