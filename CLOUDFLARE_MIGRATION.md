# Migration Guide: GitHub Pages → Cloudflare Pages

## Overview

This project is a **Vue 3 + Vite SPA** with a custom domain, built via GitHub Actions using secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_ADMIN_EMAILS`). The steps below cover everything from account setup to cutting over your domain.

---

## Step 1 — Create a Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up (free plan is sufficient).
2. Verify your email address.

---

## Step 2 — Add Your Custom Domain to Cloudflare

> This is required to manage DNS through Cloudflare, which is how you'll point your domain to Cloudflare Pages.

1. In the Cloudflare dashboard, click **Add a site**.
2. Enter your custom domain (e.g., `yourdomain.com`) and click **Continue**.
3. Choose the **Free plan**.
4. Cloudflare will scan your existing DNS records. Review them — make sure all records from your current DNS provider are present (A, CNAME, MX, TXT, etc.).
5. Cloudflare will give you **two nameservers** (e.g., `ada.ns.cloudflare.com`). Copy them.
6. Go to your domain registrar (GoDaddy, Namecheap, etc.) and replace the existing nameservers with the two Cloudflare ones.
7. Wait for propagation — this can take a few minutes to a few hours. Cloudflare will email you when it's active.

---

## Step 3 — Create a Cloudflare Pages Project

1. In the Cloudflare dashboard, go to **Workers & Pages** → **Pages** → **Create a project**.
2. Choose **Connect to Git**.
3. Authorize Cloudflare to access your GitHub account.
4. Select the `dram-journal` repository and click **Begin setup**.

---

## Step 4 — Configure the Build

On the build settings screen:

| Setting | Value |
|---|---|
| **Framework preset** | Vue |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | *(leave blank)* |
| **Node.js version** | `20` (set under Environment Variables as `NODE_VERSION = 20`) |

---

## Step 5 — Add Environment Variables (Secrets)

These replace the GitHub Actions secrets. Still on the setup screen (or later in **Settings → Environment variables**):

| Variable name | Value | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | your Supabase project URL | Production + Preview |
| `VITE_SUPABASE_KEY` | your Supabase anon/public key | Production + Preview |
| `VITE_ADMIN_EMAILS` | your admin email list | Production + Preview |

> Mark them as **Encrypted** (the lock icon) since they're secrets.

---

## Step 6 — Fix SPA Routing (Critical for Vue Router)

Cloudflare Pages needs a `_redirects` file to handle client-side routing, otherwise direct URL access to routes like `/entries/123` will return a 404.

Create the file `public/_redirects` with this content:

```
/* /index.html 200
```

Vite will copy everything in `public/` to `dist/` automatically, so this will be included in the build output.

---

## Step 7 — Remove the `VITE_BASE_PATH` if Set for GitHub Pages

GitHub Pages projects sometimes need a base path like `/repo-name/` because the site is served from a subdirectory. With Cloudflare Pages + a custom domain, your site is served from the root (`/`).

Check `vite.config.js`: if `base` is set to anything other than `'/'`, update it:

```js
// vite.config.js
export default defineConfig({
  base: '/',  // ensure this is '/' for Cloudflare Pages
  // ...
})
```

If it reads from `VITE_BASE_PATH`, you can either remove the env var entirely or set it to `/` in Cloudflare's environment variables.

---

## Step 8 — Deploy for the First Time

Click **Save and Deploy**. Cloudflare will:
1. Clone your repo
2. Run `npm install`
3. Run `npm run build` (which also runs your tests)
4. Deploy the `dist/` folder

You'll get a preview URL like `dram-journal.pages.dev`. Verify the app works correctly there before cutting over DNS.

---

## Step 9 — Add Your Custom Domain to the Pages Project

1. In your Pages project, go to **Custom domains** → **Set up a custom domain**.
2. Enter your domain (e.g., `yourdomain.com` or `app.yourdomain.com`).
3. Since your domain is already on Cloudflare DNS (Step 2), it will automatically add the required CNAME record pointing to your Pages project.
4. SSL is provisioned automatically — no action needed.

---

## Step 10 — Update or Disable the GitHub Actions Workflow

Now that Cloudflare Pages deploys on every push to `main`, your GitHub Actions workflow is redundant. You have two options:

**Option A — Disable it entirely** (recommended):
- Go to your repo on GitHub → **Actions** → find the `Deploy to GitHub Pages` workflow → **Disable workflow**.
- Also go to **Settings → Pages** and set the source to **None** to turn off GitHub Pages.

**Option B — Keep it for testing** (e.g., if you use PR preview comments):
- Delete or comment out the deploy steps, keeping only the build/test steps.

---

## Step 11 — Verify Everything

- [ ] Custom domain loads correctly over HTTPS
- [ ] Vue Router navigation works (direct URL access, browser back/forward)
- [ ] Supabase authentication and data loading works (env vars are injected)
- [ ] Admin emails restriction works (`VITE_ADMIN_EMAILS`)
- [ ] New pushes to `main` trigger an automatic Cloudflare Pages deploy (check the Pages dashboard)

---

## Summary of Key Differences vs GitHub Pages

| | GitHub Pages | Cloudflare Pages |
|---|---|---|
| **Deploys** | GitHub Actions workflow | Cloudflare builds on push automatically |
| **Secrets** | GitHub repo secrets | Cloudflare Environment Variables |
| **SPA routing** | Requires `404.html` hack | Use `public/_redirects` |
| **Base path** | Often needs `/repo-name/` | Always `/` with custom domain |
| **Preview deploys** | No | Yes — every PR gets a preview URL |
| **Build logs** | GitHub Actions tab | Cloudflare Pages dashboard |

---

## Code Changes Required in This Repo

The only file changes needed before deploying:

1. **Add** `public/_redirects` (Step 6) — required for Vue Router to work.
2. **Verify** `vite.config.js` has `base: '/'` (Step 7) — or remove the `VITE_BASE_PATH` env var.
