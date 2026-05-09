import { ref } from 'vue'
import { sb } from '../lib/supabase.js'

const SCRAPE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-whisky`

export function useCatalogueScraper() {
  const scraping   = ref(false)
  const lastResult = ref(null)
  const lastError  = ref(null)

  async function scrapeUrl(url) {
    if (!url?.trim()) return

    scraping.value   = true
    lastError.value  = null
    lastResult.value = null

    try {
      const { data: { session } } = await sb.auth.getSession()

      const res = await fetch(SCRAPE_FN, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        lastError.value = data.error || 'Unknown error'
        return
      }

      if (data.duplicate) {
        lastResult.value = { type: 'duplicate', name: data.name }
      } else {
        lastResult.value = { type: 'success', name: data.name }
      }
    } catch (err) {
      lastError.value = err.message
    } finally {
      scraping.value = false
    }
  }

  function clearResult() {
    lastResult.value = null
    lastError.value  = null
  }

  return { scrapeUrl, scraping, lastResult, lastError, clearResult }
}
