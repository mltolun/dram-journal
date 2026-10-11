# Audit follow-ups: what changed and what you still need to do

Everything that can be fixed in the repo is fixed (see the PR/diff). The items
below need access to Supabase, DNS, GitHub or Cloudflare, so they are manual.
**Order matters — do them in this order.**

## 1. Apply the database migration FIRST
`supabase/migrations/20261011_audit_hardening.sql` (review it, then `supabase db push`
or paste into the SQL editor). It adds:

| Item | What it enforces |
|---|---|
| S1 `guard_subscriptions` | clients can only create **pending** follows; only the followed user can accept |
| S1 `autofollow_admin` | admin auto-follow on signup now happens server-side |
| S4 `guard_pending_notifications`, `guard_direct_messages` | sender is stamped from the JWT; recipients must be real followers (no e-mail relay) |
| S8 `is_admin()` | the UI asks the server instead of reading an e-mail from the bundle |
| S9 `get_shared_whisky/_wishlist` | share pages fetch ONE share by id; world-readable SELECT policies are dropped |
| S10 `get_user_id_by_email` | authenticated only, 30 calls/hour/user |
| P6 `whiskies_user_date_idx` | index for the gallery query |

Then set your admin address (used by `is_admin()` and the signup auto-follow):

```sql
INSERT INTO public.app_settings (key, value)
VALUES ('admin_email', 'you@example.com')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
```

> The old frontend keeps working with the migration applied (except share links
> briefly, until the new frontend is deployed). The new frontend **requires** the
> migration (`get_shared_*`, `is_admin`).

## 2. Deploy the edge functions
```bash
supabase secrets set SCRAPE_ADMIN_EMAILS=you@example.com
# optional: SCRAPE_ALLOWED_HOSTS=distilld.io  ALLOWED_ORIGINS=https://dramjournal.online
supabase functions deploy gemini-proxy scrape-whisky --no-verify-jwt
```
* `scrape-whisky` is now admin-only, host-allow-listed (`distilld.io` by default),
  re-validates every redirect + DNS answer, and caps response size.
* `gemini-proxy` now allow-lists models/MIME types, caps image size, holds the
  prompt server-side, reserves quota *before* calling Gemini and fails closed.
  CORS is limited to your origins (add dev origins via `ALLOWED_ORIGINS`).

## 3. Supabase Auth settings (dashboard or `supabase config push`)
`supabase/config.toml` now has an `[auth]` block: min password length 10, redirect
allow-list (`https://dramjournal.online/**`), email confirmations on. Mirror them in
**Authentication → Providers/URL Configuration**, and turn on *leaked password
protection* (Pro plan) and review **Rate Limits**.

## 4. GitHub secrets
* Add `GEMINI_KEY` (the workflows fall back to `VITE_GEMINI_KEY`; delete the old
  name once the new one works).
* Optional: `ADMIN_EMAILS` — extra check in `process-notifications.js`.
* `VITE_ADMIN_EMAILS` is no longer used anywhere; delete it.

## 5. Deploy the frontend
Either keep GitHub Pages (CSP is injected as a `<meta>` tag; `404.html` fallback is
generated) **or** finish the Cloudflare Pages move (`CLOUDFLARE_MIGRATION.md`), which
additionally gives you real headers (`public/_headers`: HSTS, frame-ancestors,
X-Content-Type-Options, Referrer/Permissions-Policy, immutable asset caching, Brotli)
and per-share link previews (`functions/share/[id].js`, `functions/wishlist/[id].js`).
On Cloudflare also set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` as variables so
the Functions can read them at runtime.

Old `https://dramjournal.online/#/share/<id>` links keep working (rewritten to
`/share/<id>` on load).

## 6. DNS / e-mail (registrar or Cloudflare DNS)
* **DMARC**: change `_dmarc` to `v=DMARC1; p=none; rua=mailto:dmarc@dramjournal.online`,
  watch reports for 2–4 weeks, then move to `p=quarantine`.
* **SPF**: confirm Resend's records (return-path/`send.` subdomain) in the Resend
  dashboard → Domains; add the apex SPF it asks for.
* **MX / reply handling**: `hello@dramjournal.online` has no MX — add Cloudflare Email
  Routing (or similar) or use a `no-reply@` From address.
* **CAA** (optional): `0 issue "letsencrypt.org"`.

## 7. Not done in code (and why)
| Audit item | Status |
|---|---|
| S7 private photo bucket + signed URLs | **Partially done.** File names are now unguessable (random suffix), uploads never overwrite, replaced photos are deleted. Making the bucket private needs signed URLs in feeds, shares and e-mails — a larger change; do it per-bucket in Supabase if journal photos are sensitive. |
| P3 defer `supabase-js` on the landing page | Not done: the landing page needs the session check to redirect signed-in users. Locale split + vendor chunking are done (Spanish is a lazy 25 kB chunk). |
| SEO `hreflang` | Not done: needs separate crawlable URLs per language (e.g. `/es/`). |
| Full SSR/prerender | Landing has crawlable fallback HTML + JSON-LD; add `vite-ssg` later if you want rich content pages. |
| `supabase/.temp/*` is tracked in git | Run `git rm -r --cached supabase/.temp` (they are in `.gitignore` already). |
| Dev-only `npm audit` findings (vite/esbuild, vitest) | Need a Vite major upgrade; production deps audit clean. |

## 8. Verification
```bash
npm test && npm run build         # 297 tests + build
npm audit --omit=dev              # 0 vulnerabilities
```
Then: securityheaders.com, SSL Labs, Google Rich Results Test (JSON-LD), Search Console
URL Inspection on `/`, Lighthouse (mobile), and the Facebook/Twitter card validators
on a real `/share/<id>` link (Cloudflare only).
