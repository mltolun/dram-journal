import { createRouter, createWebHashHistory } from 'vue-router'
import { currentUser } from './composables/useAuth.js'

// Views are lazy-loaded so the landing page ships without the app bundle.
const LandingView       = () => import('./views/LandingView.vue')
const AppView           = () => import('./views/AppView.vue')
const ShareView         = () => import('./views/ShareView.vue')
const ResetView         = () => import('./views/ResetView.vue')
const WishlistShareView = () => import('./views/WishlistShareView.vue')

// We use hash history (#/) so GitHub Pages works without a 404 redirect hack
const routes = [
  { path: '/',                component: LandingView },
  { path: '/app',             component: AppView },
  { path: '/share/:id',       component: ShareView },
  { path: '/wishlist/:id',    component: WishlistShareView },
  { path: '/reset',           component: ResetView },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// Logged-in users landing on the marketing page are sent straight into the app.
router.beforeEach((to) => {
  if (to.path === '/' && currentUser.value) {
    return { path: '/app' }
  }
  return true
})
