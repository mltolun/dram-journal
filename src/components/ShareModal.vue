<template>
  <div class="modal-backdrop open" @click.self="$emit('close')">
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title">Share <span>this dram</span></div>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <p style="font-family:'DM Sans',sans-serif;font-size:0.82rem;color:var(--peat-light);margin-bottom:1rem;line-height:1.6;">
        Anyone with this link can view a read-only snapshot. Dram Journal members can import it into their own collection.
      </p>
      <div class="share-link-box">
        <input type="text" :value="shareUrl" readonly>
        <button @click="copy">Copy</button>
      </div>
      <div class="share-tip">{{ tip }}</div>
      <div class="modal-actions" style="margin-top:1.2rem">
        <button class="btn-cancel" @click="$emit('close')">Close</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { sb } from '../lib/supabase.js'
import { useToast } from '../composables/useToast.js'

const props = defineProps({ whisky: Object })
defineEmits(['close'])

const { toast } = useToast()
const shareUrl = ref('')
const tip = ref('Generating link…')

onMounted(async () => {
  // Reuse existing share if present
  const { data: existing } = await sb
    .from('shared_whiskies')
    .select('share_id')
    .eq('payload->>id', String(props.whisky.id))
    .maybeSingle()

  let shareId
  if (existing) {
    shareId = existing.share_id
  } else {
    const { data, error } = await sb
      .from('shared_whiskies')
      .insert({ payload: props.whisky })
      .select('share_id')
      .single()
    if (error) { tip.value = '⚠ Could not generate link: ' + error.message; return }
    shareId = data.share_id
  }

  // Use hash-based URL to match vue-router hash history
  shareUrl.value = window.location.origin + window.location.pathname + '#/share/' + shareId
  tip.value = 'Link is public — anyone can view this dram. Logged-in users can import it.'
})

function copy() {
  navigator.clipboard.writeText(shareUrl.value)
    .then(() => toast('✓ Link copied'))
    .catch(() => { toast('✓ Link copied') })
}
</script>
