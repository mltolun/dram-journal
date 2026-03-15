import { createApp } from 'vue'
import { router } from './router.js'
import App from './App.vue'
import './styles/global.css'

// Apply saved theme before mount to avoid flash
const savedTheme = localStorage.getItem('dram-theme') || 'whisky'
document.documentElement.setAttribute('data-theme', savedTheme)

createApp(App).use(router).mount('#app')
