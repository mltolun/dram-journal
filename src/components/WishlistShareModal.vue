<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title">Share <span>wishlist</span></div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div v-if="loading" style="text-align:center;padding:1.5rem 0;font-family:'DM Mono',monospace;font-size:0.65rem;color:var(--peat-light);">
        Generating link…
      </div>

      <template v-else>
        <p style="font-family:'DM Sans',sans-serif;font-size:0.82rem;color:var(--peat-light);margin-bottom:0.6rem;line-height:1.6;">
          Sharing <strong style="color:var(--amber-light)">{{ count }} {{ count === 1 ? 'bottle' : 'bottles' }}</strong> from your wishlist. Anyone with this link can view and import them.
        </p>
        <div class="share-link-box">
          <input type="text" :value="shareUrl" readonly>
          <button @click="copy">Copy</button>
        </div>
        <div class="share-tip">{{ tip }}</div>
      </template>

      <div class="modal-actions" style="margin-top:1.2rem">
        <button class="btn-cancel" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { sb } from '../lib/supabase.js'
import { currentUser } from '../composables/useAuth.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({ items: Array })
defineEmits(['close'])

const { toast } = useToast()
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
    tip.value = 'Link is public — anyone can view and import your wishlist.'
  } catch (e) {
    tip.value = '⚠ Could not generate link: ' + e.message
  } finally {
    loading.value = false
  }
})

function copy() {
  navigator.clipboard.writeText(shareUrl.value)
    .then(() => toast('✓ Link copied'))
    .catch(() => toast('✓ Link copied'))
}
</script>
