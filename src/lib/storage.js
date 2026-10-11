// localStorage can throw (Safari "Block all cookies", some in-app browsers,
// sandboxed iframes, quota errors). Every access goes through these helpers
// so a blocked store degrades to "nothing persisted" instead of a blank page.

export const storage = {
  get(key) {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { localStorage.setItem(key, String(value)); return true } catch { return false }
  },
  remove(key) {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
  },
  /** Remove every key that starts with `prefix` (e.g. per-entry drafts). */
  removeByPrefix(prefix) {
    try {
      const doomed = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(prefix)) doomed.push(k)
      }
      doomed.forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
  },
}
