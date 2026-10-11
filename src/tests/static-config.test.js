// Guards the non-code hardening from the audit so it can't silently regress.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')

describe('index.html (SEO + privacy)', () => {
  const html = read('index.html')
  it('has canonical, OG/Twitter tags and JSON-LD', () => {
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/dramjournal\.online\/">/)
    for (const p of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) expect(html).toContain(p)
    const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(() => JSON.parse(ld[1])).not.toThrow()
    const types = JSON.parse(ld[1])['@graph'].map(n => n['@type'])
    expect(types).toEqual(expect.arrayContaining(['WebSite', 'WebApplication']))
  })
  it('has a crawlable fallback with exactly one h1', () => {
    expect((html.match(/<h1>/g) || []).length).toBe(1)
  })
  it('does not load Google Fonts or other third-party origins', () => {
    expect(html).not.toMatch(/fonts\.googleapis|fonts\.gstatic/)
  })
  it('favicon links point at files that exist', () => {
    for (const m of html.matchAll(/rel="(?:icon|apple-touch-icon)"[^>]*href="(\/[^"]+)"/g)) {
      expect(existsSync('public' + m[1]), m[1]).toBe(true)
    }
    expect(existsSync('public/og.png')).toBe(true)
  })
})

describe('public/_headers', () => {
  const h = read('public/_headers')
  it('sends the core security headers', () => {
    for (const k of ['Strict-Transport-Security', 'X-Content-Type-Options: nosniff', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy', "frame-ancestors 'none'", "object-src 'none'"]) {
      expect(h, k).toContain(k)
    }
  })
  it('CSP has no unsafe-eval and no wildcard script sources', () => {
    const csp = h.match(/Content-Security-Policy: (.*)/)[1]
    expect(csp).not.toMatch(/unsafe-eval/)
    expect(csp).toMatch(/script-src 'self';/)
  })
  it('caches fingerprinted assets immutably and keeps shares out of the index', () => {
    expect(h).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/)
    expect(h).toMatch(/\/share\/\*\n\s+X-Robots-Tag: noindex/)
    expect(h).toMatch(/\/wishlist\/\*\n\s+X-Robots-Tag: noindex/)
  })
})

describe('robots.txt / sitemap.xml', () => {
  it('robots.txt has no inert #fragment rules, declares the sitemap, and keeps share previews fetchable', () => {
    const r = read('public/robots.txt')
    expect(r).not.toMatch(/#\//)
    expect(r).toMatch(/Sitemap: https:\/\/dramjournal\.online\/sitemap\.xml/)
    expect(r).not.toMatch(/Disallow: \/share/)
    expect(r).not.toMatch(/Disallow: \/wishlist/)
  })
  it('sitemap lists the canonical home page', () => {
    expect(read('public/sitemap.xml')).toContain('<loc>https://dramjournal.online/</loc>')
  })
})

describe('build + CI config', () => {
  it('targets Safari/iOS 15+ and uses autoprefixer', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.browserslist.join(' ')).toMatch(/safari >= 15/)
    expect(read('vite.config.js')).toMatch(/target: \[.*safari15/)
    expect(read('postcss.config.js')).toMatch(/autoprefixer/)
  })
  it('ships no admin e-mail or Gemini key env var to the client', () => {
    expect(read('.env.example')).not.toMatch(/^VITE_ADMIN_EMAILS/m)
    expect(read('.github/workflows/deploy.yml')).not.toMatch(/VITE_ADMIN_EMAILS/)
  })
  it('all GitHub Actions are pinned to commit SHAs and installs use npm ci', () => {
    for (const f of readdirSync('.github/workflows').filter(f => f.endsWith('.yml'))) {
      const y = read('.github/workflows/' + f)
      for (const m of y.matchAll(/uses:\s*(\S+)/g)) expect(m[1], `${f}: ${m[1]}`).toMatch(/@[0-9a-f]{40}$/)
      expect(y, f).not.toMatch(/run: npm install/)
      expect(y, f).toMatch(/permissions:/)
    }
  })
  it('CSS has dvh fallbacks for every 100vh and responsive viewport meta', () => {
    for (const f of ['src/styles/global.css', 'src/components/AppSidebar.vue', 'src/views/LandingView.vue']) {
      const css = read(f)
      const vh = (css.match(/100vh/g) || []).length
      const dvh = (css.match(/100dvh/g) || []).length
      expect(dvh, f).toBeGreaterThanOrEqual(vh)
    }
    expect(read('index.html')).toContain('viewport-fit=cover')
  })
})

describe('SQL migration (S1/S4/S9/S10)', () => {
  const sql = read('supabase/migrations/20261011_audit_hardening.sql')
  it('forces pending status and sender identity server-side', () => {
    expect(sql).toMatch(/NEW\.status\s+:= 'pending'/)
    expect(sql).toMatch(/NEW\.from_email := me/)
    expect(sql).toMatch(/trig_guard_subscriptions/)
    expect(sql).toMatch(/trig_guard_pending_notifications/)
    expect(sql).toMatch(/trig_guard_direct_messages/)
  })
  it('guard_direct_messages is SECURITY INVOKER (relies on caller RLS)', () => {
    const fn = sql.match(/CREATE OR REPLACE FUNCTION public\.guard_direct_messages\(\)[\s\S]*?\$\$;/)[0]
    expect(fn).not.toMatch(/SECURITY DEFINER/)
  })
  it('definer functions pin search_path and are not callable by anon where sensitive', () => {
    expect((sql.match(/SECURITY DEFINER/g) || []).length).toBeGreaterThan(0)
    for (const fn of sql.match(/CREATE (?:OR REPLACE )?FUNCTION[\s\S]*?\$\$;/g)) {
      if (/SECURITY DEFINER/.test(fn)) expect(fn.split('\n').slice(0, 12).join('\n')).toMatch(/SET search_path = ''/)
    }
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_user_id_by_email\(text\) FROM PUBLIC, anon/)
  })
  it('replaces world-readable share policies with RPCs', () => {
    expect(sql).toMatch(/get_shared_whisky/)
    expect(sql).toMatch(/get_shared_wishlist/)
    expect(sql).toMatch(/shared_whiskies_owner_select/)
  })
})
