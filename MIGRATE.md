# Migration Guide — Single HTML → Vue + Vite + GitHub Pages

## Overview

You're moving from a single `whisky-tracker.html` served directly from GitHub Pages
to a proper Vue 3 + Vite project that builds to a `dist/` folder and deploys automatically.

Your Supabase project stays exactly the same — same URL, same key, same tables, same data.

---

## Step 1 — Set up the project locally

```bash
# Clone your existing GitHub repo (the one that has whisky-tracker.html)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# Copy the scaffolded project files into it
# (copy all files from the dram-journal/ folder you downloaded here)

# Install dependencies
npm install
```

---

## Step 2 — Add your Supabase credentials

Create a `.env` file in the root (never commit this):

```
VITE_SUPABASE_URL=https://cjoqrhiqveythplughqx.supabase.co
VITE_SUPABASE_KEY=sb_publishable_Udq4vXAPmVuu3jeTRdC4VA_ulfxYqKx
```

Test it runs locally:

```bash
npm run dev
# Open http://localhost:5173
```

Make sure login, adding whiskies, photos, and share links all work before deploying.

---

## Step 3 — Update vite.config.js with your repo name

Open `vite.config.js` and set the `base` to your GitHub repo name:

```js
base: process.env.NODE_ENV === 'production' ? '/YOUR_REPO_NAME/' : '/',
```

For example if your repo is `github.com/john/dram-journal`, use `/dram-journal/`.

---

## Step 4 — Update your Supabase redirect URLs

Because the URL is changing, you need to tell Supabase where to redirect after
password reset emails.

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Add your new GitHub Pages URL to **Redirect URLs**:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
   ```
3. Set **Site URL** to the same value.

---

## Step 5 — Add secrets to GitHub

Your Supabase credentials must not be in the code — they're passed via GitHub Secrets.

1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Add two secrets:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_KEY` → your Supabase publishable key

---

## Step 6 — Enable GitHub Pages with GitHub Actions

1. Go to your repo → **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

---

## Step 7 — Push and deploy

```bash
# Remove the old HTML file if you want (or keep it on a branch)
git rm whisky-tracker.html   # optional

git add .
git commit -m "Migrate to Vue + Vite"
git push origin main
```

GitHub Actions will automatically:
1. Install dependencies
2. Run `npm run build` with your secrets as env vars
3. Upload the `dist/` folder to GitHub Pages
4. Your app will be live at `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

You can watch the deploy progress under **Actions** tab in your repo.

---

## Step 8 — Verify share links still work

Share links now use hash-based routing, so they look like:

```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/#/share/SHARE_UUID
```

Any old share links from the HTML version (using `?share=UUID`) won't work —
but all your whisky data is untouched and you can regenerate share links.

---

## What stays the same

- All your Supabase tables (`whiskies`, `lookup_options`, `shared_whiskies`)
- All your data — nothing is migrated, it's all still in Supabase
- Storage bucket (`whisky-photos`)
- Your Supabase URL and key

## What changes

- The app URL gains the repo name as a path prefix (e.g. `/dram-journal/`)
- Share links use `#/share/ID` instead of `?share=ID`
- You edit `.vue` files instead of one big HTML file
- Deploys happen automatically on every `git push` to main
