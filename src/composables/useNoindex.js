import { onUnmounted } from 'vue'

/**
 * Adds <meta name="robots" content="noindex, nofollow"> while the component is
 * mounted. Crawlers that execute JS honour it; the server also sends an
 * X-Robots-Tag header for these paths (see public/_headers).
 */
export function useNoindex() {
  if (typeof document === 'undefined') return
  const meta = document.createElement('meta')
  meta.name = 'robots'
  meta.content = 'noindex, nofollow'
  document.head.appendChild(meta)
  onUnmounted(() => meta.remove())
}
