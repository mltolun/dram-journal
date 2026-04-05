import { createRouter, createWebHashHistory } from 'vue-router'
import LandingView        from './views/LandingView.vue'
import AppView            from './views/AppView.vue'
import ShareView          from './views/ShareView.vue'
import ResetView          from './views/ResetView.vue'
import WishlistShareView  from './views/WishlistShareView.vue'

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