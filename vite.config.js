import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Content-Security-Policy injected into the built index.html so it applies even
// on hosts that can't send headers (GitHub Pages). On Cloudflare Pages the same
// policy (plus frame-ancestors, which <meta> can't express) is sent from
// public/_headers. Keep both in sync.
function cspPlugin(env) {
  const supabase = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL) : null
  const connect = ["'self'"]
  if (supabase) connect.push(supabase.origin, `wss://${supabase.host}`)
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",        // Vue :style bindings emit inline style attributes
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",       // catalogue photos can be hosted anywhere over https
    `connect-src ${connect.join(' ')}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'dj-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(
        /<meta charset="UTF-8">/i,
        `<meta charset="UTF-8">\n  <meta http-equiv="Content-Security-Policy" content="${policy}">`,
      ),
    },
  }
}

// GitHub Pages has no SPA fallback: unknown paths (e.g. a refresh on /app) get
// 404.html, so make it a copy of index.html. Cloudflare Pages uses
// public/_redirects instead, so this is opt-in (GITHUB_PAGES=true in CI).
function spaFallbackPlugin() {
  return {
    name: 'dj-spa-404',
    apply: 'build',
    closeBundle() {
      if (process.env.GITHUB_PAGES !== 'true') return
      copyFileSync(resolve('dist/index.html'), resolve('dist/404.html'))
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue(), cspPlugin(env), spaFallbackPlugin()],
    base: process.env.VITE_BASE_PATH || '/',
    build: {
      // Matches "browserslist" in package.json (iOS/Safari 15+, evergreen others).
      target: ['es2020', 'chrome90', 'edge90', 'firefox90', 'safari15'],
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@supabase')) return 'supabase'
            if (/node_modules\/(vue|@vue|vue-router)\//.test(id)) return 'vue'
          },
        },
      },
    },
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./src/tests/setup.js'],
      env: {
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_KEY: 'test-anon-key',
      },
    },
  }
})
