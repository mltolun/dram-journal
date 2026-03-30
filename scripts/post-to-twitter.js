/**
 * post-to-twitter.js
 *
 * Daily cron script — run via GitHub Actions.
 *
 * 1. Picks a random whisky from the catalogue (avoiding repeats for 30 days).
 * 2. Generates engaging tweet copy via Gemini Flash.
 * 3. Posts to Twitter/X using Playwright (session persisted in Supabase).
 * 4. Records the post in the `twitter_posts` table.
 *
 * Required Supabase tables:
 *   twitter_session  — columns: id int (PK), cookies jsonb, updated_at timestamptz
 *   twitter_posts    — columns: id uuid (PK default), catalogue_id uuid, whisky_name text,
 *                               tweet_text text, posted_at timestamptz
 *
 * Required environment variables:
 *   TWITTER_USERNAME     — Twitter/X username or email
 *   TWITTER_PASSWORD     — Twitter/X password
 *   SUPABASE_URL         — your project URL
 *   SUPABASE_SERVICE_KEY — service role key
 *   GEMINI_KEY           — Google AI API key
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const TWITTER_USERNAME    = process.env.TWITTER_USERNAME
const TWITTER_PASSWORD    = process.env.TWITTER_PASSWORD
const SUPABASE_URL        = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const GEMINI_KEY          = process.env.GEMINI_KEY

if (!TWITTER_USERNAME || !TWITTER_PASSWORD) throw new Error('TWITTER_USERNAME and TWITTER_PASSWORD are required')
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required')

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

// ─── Session persistence via Supabase ────────────────────────────────────────

async function loadCookies() {
  const { data } = await sb
    .from('twitter_session')
    .select('cookies')
    .eq('id', 1)
    .maybeSingle()
  return data?.cookies || null
}

async function saveCookies(cookies) {
  await sb
    .from('twitter_session')
    .upsert({ id: 1, cookies, updated_at: new Date().toISOString() })
  console.log('   Session cookies saved')
}

// ─── Pick today's whisky ──────────────────────────────────────────────────────

async function pickWhisky() {
  // Avoid whiskies posted in the last 30 days
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: recent } = await sb
    .from('twitter_posts')
    .select('catalogue_id')
    .gte('posted_at', cutoff)

  const excludeIds = (recent || []).map(r => r.catalogue_id).filter(Boolean)

  let query = sb
    .from('catalogue')
    .select('id, name, distillery, type, country, region, age, price_band, dulzor, ahumado, cuerpo, frutado, especiado')
    .not('name', 'is', null)

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data: catalogue, error } = await query
  if (error)            throw new Error(`Failed to fetch catalogue: ${error.message}`)
  if (!catalogue?.length) throw new Error('No catalogue entries available')

  return catalogue[Math.floor(Math.random() * catalogue.length)]
}

// ─── Generate tweet copy via Gemini ──────────────────────────────────────────

const ATTR_LABELS = { dulzor: 'sweet', ahumado: 'smoky', cuerpo: 'full-bodied', frutado: 'fruity', especiado: 'spicy' }
const TYPE_HASHTAGS = { scotch: '#Scotch', irish: '#IrishWhiskey', bourbon: '#Bourbon', japanese: '#JapaneseWhisky', other: '#Whisky' }

async function generateTweet(whisky) {
  const topAttrs = Object.entries(ATTR_LABELS)
    .filter(([key]) => (whisky[key] || 0) >= 3)
    .map(([, label]) => label)
    .slice(0, 3)

  const prompt = `Write a short, enthusiastic tweet (max 180 characters, no hashtags, no quotes) spotlighting this whisky for a community of whisky enthusiasts:

Name: ${whisky.name}
Distillery: ${whisky.distillery || 'Unknown'}
Region: ${[whisky.region, whisky.country].filter(Boolean).join(', ') || 'Unknown'}
Age: ${whisky.age || 'No age statement'}
Key flavours: ${topAttrs.length ? topAttrs.join(', ') : 'balanced, complex'}

Output only the tweet text.`

  if (GEMINI_KEY) {
    const res = await fetch(GEMINI_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 120 },
      }),
    })

    const data = await res.json()
    if (res.ok) {
      const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
      if (generated) {
        const type = TYPE_HASHTAGS[whisky.type] || '#Whisky'
        return `${generated}\n\n${type} #DramJournal`.slice(0, 280)
      }
    }
    console.warn(`   Gemini failed (${res.status}), falling back to template`)
  }

  // Fallback template
  const region  = [whisky.region, whisky.country].filter(Boolean).join(', ') || 'Unknown region'
  const flavour = topAttrs.length ? topAttrs.join(' · ') : 'beautifully balanced'
  const age     = whisky.age ? `, ${whisky.age}` : ''
  const type    = TYPE_HASHTAGS[whisky.type] || '#Whisky'

  return `🥃 Whisky of the Day: ${whisky.name}${age}\n${region} · ${flavour}\n\n${type} #DramJournal`.slice(0, 280)
}

// ─── Login flow ───────────────────────────────────────────────────────────────

async function login(page) {
  console.log('   Logging in...')
  await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)

  // Step 1: username
  await page.fill('input[autocomplete="username"]', TWITTER_USERNAME)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(2000)

  // Step 1b: sometimes Twitter asks for phone/email to verify identity
  const verifyInput = page.locator('input[data-testid="ocfEnterTextTextInput"]')
  if (await verifyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await verifyInput.fill(TWITTER_USERNAME)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)
  }

  // Step 2: password
  await page.fill('input[name="password"]', TWITTER_PASSWORD)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(5000)

  console.log('   Login complete')
}

// ─── Post to Twitter via Playwright ──────────────────────────────────────────

async function postToTwitter(tweetText) {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  })

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport:  { width: 1280, height: 800 },
  })

  // Hide webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  try {
    const storedCookies = await loadCookies()
    if (storedCookies) {
      await context.addCookies(storedCookies)
      console.log('   Loaded stored session cookies')
    }

    const page = await context.newPage()
    await page.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)

    const composeBtn = page.locator('[data-testid="SideNav_NewTweet_Button"]')
    const isLoggedIn = await composeBtn.isVisible({ timeout: 8000 }).catch(() => false)

    if (!isLoggedIn) {
      await login(page)
      await page.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(3000)
    } else {
      console.log('   Session valid, already logged in')
    }

    // Persist refreshed cookies
    await saveCookies(await context.cookies())

    // Compose tweet
    await composeBtn.click()
    await page.waitForTimeout(1500)

    const tweetBox = page.locator('[data-testid="tweetTextarea_0"]').first()
    await tweetBox.click()
    await tweetBox.fill(tweetText)
    await page.waitForTimeout(800)

    // Post
    await page.locator('[data-testid="tweetButtonInline"]').click()
    await page.waitForTimeout(3000)

    console.log('   Tweet posted')
  } finally {
    await browser.close()
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🐦 Starting Twitter post...')

  const whisky = await pickWhisky()
  console.log(`   Whisky: ${whisky.name} (${whisky.distillery || '—'})`)

  const tweetText = await generateTweet(whisky)
  console.log(`   Tweet (${tweetText.length} chars):\n${tweetText}\n`)

  await postToTwitter(tweetText)

  await sb.from('twitter_posts').insert({
    catalogue_id: whisky.id,
    whisky_name:  whisky.name,
    tweet_text:   tweetText,
    posted_at:    new Date().toISOString(),
  })

  console.log('✓ Done')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
