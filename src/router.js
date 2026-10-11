import { createRouter, createWebHistory } from 'vue-router'
import { currentUser } from './composables/useAuth.js'
import { migrateLegacyHash } from './lib/legacy-hash.js'

// Views are lazy-loaded so the landing page ships without the app bundle.
const LandingView       = () => import('./views/LandingView.vue')
const AppView           = () => import('./views/AppView.vue')
const ShareView         = () => import('./views/ShareView.vue')
const ResetView         = () => import('./views/ResetView.vue')
const WishlistShareView = () => import('./views/WishlistShareView.vue')
const NotFoundView      = () => import('./views/NotFoundView.vue')

const BASE_TITLE = 'The Dram Journal'

const routes = [
  { path: '/',                component: LandingView },
  { path: '/app',             component: AppView,           meta: { title: `My Journal – ${BASE_TITLE}` } },
  { path: '/share/:id',       component: ShareView,         meta: { title: `Shared dram – ${BASE_TITLE}` } },
  { path: '/wishlist/:id',    component: WishlistShareView, meta: { title: `Shared wishlist – ${BASE_TITLE}` } },
  { path: '/reset',           component: ResetView,         meta: { title: `Reset password – ${BASE_TITLE}` } },
  { path: '/:pathMatch(.*)*', component: NotFoundView,      meta: { title: `Page not found – ${BASE_TITLE}` } },
]

// Links shared before the move to path routing used "#/share/<id>".
migrateLegacyHash()

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: (_to, _from, saved) => saved || { top: 0 },
})

// Logged-in users landing on the marketing page are sent straight into the app.
router.beforeEach((to) => {
  if (to.path === '/' && currentUser.value) {
    return { path: '/app' }
  }
  return true
})

router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta?.title) document.title = to.meta.title
})
