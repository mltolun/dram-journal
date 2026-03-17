import { createRouter, createWebHashHistory } from 'vue-router'
import AppView            from './views/AppView.vue'
import ShareView          from './views/ShareView.vue'
import ResetView          from './views/ResetView.vue'
import WishlistShareView  from './views/WishlistShareView.vue'
import AdminView          from './views/AdminView.vue'

// We use hash history (#/) so GitHub Pages works without a 404 redirect hack
const routes = [
  { path: '/',                component: AppView },
  { path: '/share/:id',       component: ShareView },
  { path: '/wishlist/:id',    component: WishlistShareView },
  { path: '/reset',           component: ResetView },
  { path: '/admin',           component: AdminView },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
