// Absolute, crawlable URLs for shared pages.
export function appUrl(path = '') {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : base + '/'
  return window.location.origin + prefix + path.replace(/^\//, '')
}

export const shareUrlFor    = (id) => appUrl(`share/${id}`)
export const wishlistUrlFor = (id) => appUrl(`wishlist/${id}`)
