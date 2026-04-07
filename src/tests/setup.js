// Mock localStorage for the test environment.
// useI18n.js (and other composables) call localStorage at module-init time,
// so this must run before any component imports.
if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') {
  const store = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key) => store[key] ?? null,
      setItem: (key, value) => { store[key] = String(value) },
      removeItem: (key) => { delete store[key] },
      clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    },
    writable: true,
  })
}
