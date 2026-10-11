import { storage } from '../lib/storage.js'
import { ref, computed, shallowRef, watch } from 'vue'
import en from '../locales/en.js'

// ─── Supported locales ────────────────────────────────────────────────────────
const SUPPORTED = ['en', 'es']

// Countries where Spanish is the primary/official language
const SPANISH_COUNTRIES = new Set([
  'AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ',
  'GT','HN','MX','NI','PA','PY','PE','ES','UY','VE',
])

/**
 * Map a BCP-47 language tag or ISO-3166-1 country code to one of our supported
 * locale keys. Returns null if we can't confidently map it.
 */
function mapToSupportedLocale(langOrCountry) {
  if (!langOrCountry) return null
  const base = langOrCountry.split(/[-_]/)[0].toLowerCase()
  if (base === 'es') return 'es'
  if (base === 'en') return 'en'
  // country code path (uppercase two-letter)
  if (SPANISH_COUNTRIES.has(langOrCountry.toUpperCase())) return 'es'
  return null
}

export { mapToSupportedLocale }

/**
 * Detect the best locale for a first-time visitor from the browser's language
 * preferences only (no network, no third-party IP lookup). Falls back to
 * English. Only acts when there is no stored 'dj_locale'.
 */
export async function detectLocale() {
  if (storage.get('dj_locale')) return  // already set by user or previous visit

  const browserLangs = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || '']

  for (const lang of browserLangs) {
    const mapped = mapToSupportedLocale(lang)
    if (mapped) {
      _applyLocale(mapped)
      return
    }
  }

  _applyLocale('en')
}

function _applyLocale(l) {
  if (!SUPPORTED.includes(l)) return
  locale.value = l
  storage.set('dj_locale', l)
  ensureLocaleLoaded(l)
}

// ─── Message catalogues ───────────────────────────────────────────────────────
// English ships in the main bundle (fallback); other locales are lazy chunks.
const loaders = { es: () => import('../locales/es.js') }
const messages = shallowRef({ en })

export async function ensureLocaleLoaded(l) {
  if (messages.value[l] || !loaders[l]) return
  try {
    const mod = await loaders[l]()
    messages.value = { ...messages.value, [l]: mod.default }
  } catch (e) {
    console.warn(`Could not load locale "${l}":`, e)
  }
}

// ─── Reactive locale ──────────────────────────────────────────────────────────
export const locale = ref(storage.get('dj_locale') || 'en')
ensureLocaleLoaded(locale.value)

if (typeof document !== 'undefined') {
  watch(locale, (l) => { document.documentElement.lang = l }, { immediate: true })
}

export function useI18n() {
  function setLocale(l) {
    if (!SUPPORTED.includes(l)) return
    locale.value = l
    storage.set('dj_locale', l)
    ensureLocaleLoaded(l)
  }

  function toggleLocale() {
    setLocale(locale.value === 'en' ? 'es' : 'en')
  }

  const t = computed(() => messages.value[locale.value] || messages.value.en)

  return { locale, t, setLocale, toggleLocale }
}
