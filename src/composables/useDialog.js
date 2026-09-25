import { onMounted, onBeforeUnmount, nextTick } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// Stack of open dialogs so nested overlays behave: Escape closes the topmost
// only, and Tab is trapped inside the topmost dialog.
const stack = []
let listenerAttached = false

function visibleFocusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
  )
}

function handleKeydown(e) {
  const top = stack[stack.length - 1]
  if (!top) return

  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    if (top.onClose) top.onClose()
    return
  }

  if (e.key !== 'Tab') return

  const root = top.getRoot()
  if (!root) return
  const nodes = visibleFocusables(root)
  if (nodes.length === 0) {
    e.preventDefault()
    return
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (e.shiftKey && (active === first || !root.contains(active))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (active === last || !root.contains(active))) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * Imperatively register a dialog layer (for components that stay mounted
 * while the overlay is toggled, e.g. via v-model). Returns an unregister fn.
 */
export function pushDialog(getRoot, onClose) {
  const entry = { getRoot, onClose }
  stack.push(entry)
  if (!listenerAttached) {
    document.addEventListener('keydown', handleKeydown, true)
    listenerAttached = true
  }
  return () => {
    const idx = stack.indexOf(entry)
    if (idx >= 0) stack.splice(idx, 1)
    if (stack.length === 0 && listenerAttached) {
      document.removeEventListener('keydown', handleKeydown, true)
      listenerAttached = false
    }
  }
}

/**
 * Dialog behavior for overlay components: Escape-to-close, focus trapping,
 * initial focus, and focus restoration on unmount.
 *
 * Usage:
 *   const dialogRef = ref(null)
 *   useDialog(dialogRef, { onClose: () => emit('close') })
 *   <div ref="dialogRef" role="dialog" aria-modal="true">…</div>
 *
 * `target` may also be a function returning the current overlay element, for
 * components whose topmost layer changes (teleported overlays, lightboxes).
 */
export function useDialog(target, { onClose, initialFocus } = {}) {
  let previouslyFocused = null
  let pop = null
  const getRoot = () => (typeof target === 'function' ? target() : target?.value)

  onMounted(async () => {
    previouslyFocused = document.activeElement
    const root = getRoot()
    pop = pushDialog(getRoot, onClose)
    if (!root) return
    await nextTick()
    const focusTarget =
      (typeof initialFocus === 'function' ? initialFocus() : initialFocus) ||
      root.querySelector('[data-autofocus]') ||
      visibleFocusables(root)[0]
    if (focusTarget) {
      focusTarget.focus()
    } else {
      root.setAttribute('tabindex', '-1')
      root.focus()
    }
  })

  onBeforeUnmount(() => {
    if (pop) pop()
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus()
    }
  })
}

export { visibleFocusables }
